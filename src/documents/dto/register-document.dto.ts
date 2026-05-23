/**
 * @file register-document.dto.ts
 * @module documents/dto
 * @description DTO de entrada para el endpoint POST /documents/register.
 *   Valida que el hash recibido en el cuerpo de la petición sea un valor
 *   bytes32 bien formado antes de que llegue al servicio.
 */

import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDocumentDto {
  @ApiProperty({
    description: 'Hash SHA-256 del documento en formato bytes32',
    example:
      '0xe8c6b5b48b78e66a103cd2c79aa19cd869a7e53fe31bba832f4592bf92e567c8',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'hash debe ser un bytes32 hex válido',
  })
  hash!: string;
}
