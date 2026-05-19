import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents') 
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('register')
  async registerDocument(@Body('hash') hash: string) {
    return this.documentsService.registerDocument(hash);
  }

  @Get('verify/:hash')
  async verifyDocument(@Param('hash') hash: string) {
    return this.documentsService.verifyDocument(hash);
  }
}