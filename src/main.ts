/**
 * @file main.ts
 * @description Punto de entrada principal de la aplicación. Configura el bootstrap,
 * la seguridad (CORS), los prefijos de API, la validación de datos global y
 * la documentación interactiva (Swagger).
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // Prefijo global para versionado de API, excluyendo la ruta de salud
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Validación automática de DTOs mediante class-validator
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Configuración de la especificación OpenAPI (Swagger)
  const config = new DocumentBuilder()
    .setTitle('Servicio de Registro Documental')
    .setDescription(
      'API para registro y verificación de documentos en blockchain',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  console.error('Error arrancando la aplicación:', err);
  process.exit(1);
});
