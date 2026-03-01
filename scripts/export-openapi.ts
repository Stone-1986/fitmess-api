// scripts/export-openapi.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { AppModule } from '../src/app.module.js';

async function exportOpenApi() {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
    version: string;
  };

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api');

  // Mantener alineado con la configuración de main.ts
  const config = new DocumentBuilder()
    .setTitle('fitmess API')
    .setDescription('API de la plataforma de fitness fitmess')
    .setVersion(pkg.version)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  mkdirSync('./outputs', { recursive: true });
  writeFileSync('./outputs/openapi.json', JSON.stringify(document, null, 2));
  console.log(
    `Contrato OpenAPI v${pkg.version} exportado en outputs/openapi.json`,
  );

  await app.close();
}

exportOpenApi().catch((error: unknown) => {
  console.error('Error exportando contrato OpenAPI:', error);
  process.exit(1);
});
