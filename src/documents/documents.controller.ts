import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async registerDocument(@Body('hash') hash: string) {
    return this.documentsService.registerDocument(hash);
  }

  @Get('verify/:hash')
  async verifyDocument(@Param('hash') hash: string) {
    return this.documentsService.verifyDocument(hash);
  }
}
