/**
 * @file documents.controller.ts
 * @module documents
 * @description Controlador HTTP del módulo de documentos. Expone dos endpoints
 *   bajo el prefijo /api/v1/documents:
 *     - POST /register  Encola el hash de un documento para su registro en
 *                       blockchain y devuelve 202 Accepted de forma inmediata.
 *     - GET  /verify/:hash  Consulta si un hash ya está registrado en el
 *                       contrato inteligente y devuelve el resultado.
 *
 *   La validación de entrada se delega en los DTOs mediante el ValidationPipe
 *   global configurado en main.ts.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Recibe el hash de un documento, comprueba que no esté ya registrado y lo
   * encola para su procesamiento asíncrono. Devuelve 202 inmediatamente sin
   * esperar la confirmación de la blockchain.
   *
   * @param dto - Cuerpo de la petición con el hash bytes32 del documento.
   * @returns Objeto con el jobId asignado y el estado inicial (pending/deferred).
   */
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Registrar un documento en la blockchain' })
  @ApiBody({ type: RegisterDocumentDto })
  @ApiResponse({ status: 202, description: 'Documento encolado para registro' })
  @ApiResponse({ status: 409, description: 'El documento ya está registrado' })
  @ApiResponse({
    status: 503,
    description: 'Servicio saturado, reintentar más tarde',
  })
  async registerDocument(@Body() dto: RegisterDocumentDto) {
    return this.documentsService.registerDocument(dto.hash);
  }

  /**
   * Consulta el contrato inteligente para verificar si el hash proporcionado
   * fue previamente registrado, devolviendo el emisor y la marca de tiempo
   * en caso afirmativo.
   *
   * @param dto - Parámetro de ruta con el hash bytes32 del documento.
   * @returns Objeto con isVerified, emisor y timestamp si el documento existe.
   */
  @Get('verify/:hash')
  @ApiOperation({
    summary: 'Verificar si un documento está registrado en la blockchain',
  })
  @ApiParam({
    name: 'hash',
    description: 'Hash bytes32 del documento (0x + 64 hex)',
    example: '0xabc123...',
  })
  @ApiResponse({ status: 200, description: 'Resultado de la verificación' })
  async verifyDocument(@Param() dto: VerifyDocumentDto) {
    return this.documentsService.verifyDocument(dto.hash);
  }
}
