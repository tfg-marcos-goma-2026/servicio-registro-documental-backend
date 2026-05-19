import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { SecretManager } from '../vault/secret-manager.interface';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider!: ethers.JsonRpcProvider;
  private readOnlyContract!: ethers.Contract;
  private contractAddress!: string;

  private readonly abi = [
    'function registrar(bytes32 _hash) public',
    'function verificar(bytes32 _hash) public view returns (bool, address, uint256)',
  ];

  constructor(
    private configService: ConfigService,
    private secretManager: SecretManager,
  ) {}

  onModuleInit() {
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
  }

  async registrarHash(hash: string): Promise<string> {
    console.log(
      '[BlockchainService] Pidiendo autorización al gestor de secretos...',
    );
    const privateKey = await this.secretManager.getPrivateKey();

    const tempWallet = new ethers.Wallet(privateKey, this.provider);
    const writableContract = new ethers.Contract(
      this.contractAddress,
      this.abi,
      tempWallet,
    );

    console.log(
      '[BlockchainService] Firmando transacción y enviando al nodo...',
    );

    const tx = (await writableContract.registrar(
      hash,
    )) as ethers.ContractTransactionResponse;
    const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

    return receipt.hash;
  }

  async verificarHash(hash: string) {
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
