/**
 * @file blockchain.service.ts
 * @module blockchain
 * @description Implementación real de IBlockchainService. Se comunica con un
 *   nodo EVM a través de ethers.js, obtiene la clave privada del firmante
 *   desde el Secret Manager y usa Redlock (mutex distribuido sobre Redis) para
 *   serializar las transacciones y evitar colisiones de nonce cuando hay
 *   múltiples workers procesando la cola en paralelo.
 *
 * Variables de entorno requeridas:
 *   - BLOCKCHAIN_RPC_URL          URL JSON-RPC del nodo.
 *   - REGISTRO_CONTRATO_ADDRESS   Dirección del contrato inteligente desplegado.
 *   - REDIS_HOST / REDIS_PORT     Conexión a Redis para el lock distribuido.
 */

import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { SecretManager } from '../vault/secret-manager.interface';
import { IBlockchainService } from './blockchain.interface';
import Redis from 'ioredis';
import Redlock from 'redlock';

interface IRedlockLock {
  release(): Promise<void>;
}

interface IRedlock {
  acquire(resources: string[], duration: number): Promise<IRedlockLock>;
}

type RedlockCtor = new (clients: Redis[], options?: object) => IRedlock;

@Injectable()
export class BlockchainService implements IBlockchainService, OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  private provider!: ethers.JsonRpcProvider;
  private readOnlyContract!: ethers.Contract;
  /** Inicializado de forma diferida en getWritableContract() para evitar
   *  una llamada al Secret Manager en cada arranque del módulo. */
  private writableContract: ethers.Contract | null = null;
  private contractAddress!: string;
  private redlock!: IRedlock;

  private readonly abi = [
    'function registrar(bytes32 _hash) public',
    'function verificar(bytes32 _hash) public view returns (bool, address, uint256)',
  ];

  /** Clave del mutex distribuido. Un solo lock por toda la aplicación
   *  garantiza que solo un worker envíe una transacción a la vez. */
  private readonly lockKey = 'locks:blockchain-tx';

  constructor(
    private configService: ConfigService,
    private secretManager: SecretManager,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) {}

  /**
   * Inicializa el proveedor JSON-RPC, el contrato de solo lectura y la
   * instancia de Redlock. Se ejecuta automáticamente al arrancar el módulo.
   * @throws Error si faltan las variables de entorno obligatorias.
   */
  onModuleInit(): void {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    this.contractAddress = this.configService.get<string>(
      'REGISTRO_CONTRATO_ADDRESS',
    )!;

    if (!rpcUrl || !this.contractAddress) {
      throw new Error(
        '[BlockchainService] Faltan variables RPC o Contract Address en el .env',
      );
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.readOnlyContract = new ethers.Contract(
      this.contractAddress,
      this.abi,
      this.provider,
    );

    const SafeRedlock = Redlock as unknown as RedlockCtor;
    this.redlock = new SafeRedlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 120,
      retryDelay: 500,
      retryJitter: 200,
    });
  }

  /**
   * Devuelve el contrato escribible, creándolo la primera vez que se necesita.
   * Esto evita una llamada al Secret en cada arranque y centraliza
   * la construcción del Wallet.
   */
  private async getWritableContract(): Promise<ethers.Contract> {
    if (!this.writableContract) {
      const privateKey = await this.secretManager.getPrivateKey();
      const wallet = new ethers.Wallet(privateKey, this.provider);
      this.writableContract = new ethers.Contract(
        this.contractAddress,
        this.abi,
        wallet,
      );
    }
    return this.writableContract;
  }

  /**
   * Firma y envía una transacción para registrar el hash en el contrato.
   * El flujo es:
   *   1. Obtener el contrato.
   *   2. Adquirir el mutex distribuido (Redlock) para serializar el nonce.
   *   3. Leer el nonce actual del nodo para evitar colisiones.
   *   4. Llamar a `registrar` y esperar la confirmación de la transacción.
   *   5. Liberar el lock en el bloque finally.
   *
   * @param hash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns Hash de la transacción confirmada.
   * @throws Error('DUPLICATE_HASH') si el contrato rechaza el hash por duplicado.
   * @throws Error('SYSTEM_BUSY_LOCK_ACQUISITION_FAILED') si Redlock no puede
   *   adquirir el lock tras todos los reintentos configurados.
   */
  async registrarHash(hash: string): Promise<string> {
    const writableContract = await this.getWritableContract();
    const wallet = writableContract.runner as ethers.Wallet;

    let lock: IRedlockLock | null = null;

    try {
      lock = await this.redlock.acquire([this.lockKey], 15000);

      const nonceHex = (await this.provider.send('eth_getTransactionCount', [
        wallet.address,
        'latest',
      ])) as string;
      const trueNonce = parseInt(nonceHex, 16);

      const tx = (await writableContract.registrar(hash, {
        nonce: trueNonce,
      })) as ethers.ContractTransactionResponse;
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      return receipt.hash;
    } catch (error: unknown) {
      if (ethers.isError(error, 'CALL_EXCEPTION')) {
        const DUPLICATE_REASON = 'El documento ya esta registrado';
        const typedError = error as { reason?: string; shortMessage?: string };
        const isDuplicate =
          typedError.reason?.includes(DUPLICATE_REASON) ||
          typedError.shortMessage?.includes(DUPLICATE_REASON);
        if (isDuplicate) throw new Error('DUPLICATE_HASH');
      }

      if (
        error !== null &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ExecutionError'
      ) {
        throw new Error('SYSTEM_BUSY_LOCK_ACQUISITION_FAILED');
      }

      throw error;
    } finally {
      if (lock !== null) {
        await lock.release().catch((err: unknown) => this.logger.error(err));
      }
    }
  }

  /**
   * Consulta el contrato en modo lectura para comprobar si un hash ya fue
   * registrado. No requiere firma ni lock, por lo que es una operación ligera.
   *
   * @param hash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns `existe`, dirección del `emisor` y `timestamp` Unix en segundos.
   */
  async verificarHash(
    hash: string,
  ): Promise<{ existe: boolean; emisor: string; timestamp: number }> {
    const result = (await this.readOnlyContract.verificar(hash)) as [
      boolean,
      string,
      bigint,
    ];
    return {
      existe: result[0],
      emisor: result[1],
      timestamp: Number(result[2]),
    };
  }
}
