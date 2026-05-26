/**
 * @file health.controller.ts
 * @module health
 * @description Controlador de health checks. Expone el endpoint GET /health,
 *   que comprueba activamente el estado de las dependencias de infraestructura
 *   compartidas por el sistema: Redis (necesario para la cola BullMQ y el
 *   mutex distribuido Redlock) y Vault (necesario para que el adaptador de
 *   blockchain obtenga la clave privada del firmante).
 *
 *   Este módulo es transversal y no pertenece a ningún contexto.
 *   Comprueba dependencias de infraestructura, no lógica de negocio.
 *
 *   Un código 200 indica que todas las dependencias están operativas.
 *   Cualquier fallo devuelve 503, lo que permite a Docker Swarm o Kubernetes
 *   decidir si reiniciar el contenedor automáticamente.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private configService: ConfigService,
  ) {}

  /**
   * Ejecuta los health checks de las dependencias de infraestructura en
   * paralelo y devuelve un resumen del estado de cada una.
   *
   * Comprobaciones incluidas:
   *   - **redis**  Ping TCP al servidor Redis.
   *   - **vault**  Petición HTTP al endpoint /v1/sys/health de HashiCorp Vault,
   *     que devuelve 200 solo cuando está inicializado, desbloqueado y activo.
   *
   * @returns Objeto HealthCheckResult con el estado global y el detalle de
   *   cada indicador. Terminus fija el código HTTP (200 / 503).
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary:
      'Comprueba el estado del servicio y sus dependencias de infraestructura',
  })
  check() {
    return this.health.check([
      () =>
        this.microservice.pingCheck('redis', {
          transport: Transport.REDIS,
          options: {
            host: this.configService.get<string>('REDIS_HOST', 'localhost'),
            port: this.configService.get<number>('REDIS_PORT', 6379),
          },
        }),
      () =>
        this.http.pingCheck(
          'vault',
          `${this.configService.get<string>('VAULT_ENDPOINT', 'http://localhost:8200')}/v1/sys/health`,
        ),
    ]);
  }
}
