// scripts/export-openapi.mjs
//
// Exporta el contrato OpenAPI a partir de la aplicacion YA COMPILADA (`dist/`),
// no del codigo fuente.
//
// Por que no es un .ts ejecutado con tsx: tsx usa esbuild, y esbuild no soporta
// `emitDecoratorMetadata`. Sin esa metadata TypeScript no emite `design:paramtypes`,
// asi que Nest no puede resolver las dependencias por tipo e inyecta `undefined`.
// El sintoma era este, y tumbaba el bootstrap antes de generar nada:
//
//   TypeError: Cannot read properties of undefined (reading 'getOrThrow')
//       at new JwtStrategy (... configService.getOrThrow('JWT_SECRET'))
//
// El comando llevaba roto desde que existe: `openapi:validate` nunca llego a
// ejecutar Spectral, ni en EPICA-01 ni en EPICA-09 (hallazgo abierto #8).
//
// Leer de `dist/` no es solo un rodeo al problema: el contrato queda generado a
// partir del mismo artefacto que se despliega, no de una version transpilada de
// otra forma. `openapi:export` corre `build` antes, asi que `dist/` siempre esta
// fresco.

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { AppModule } from '../dist/app.module.js';

async function exportOpenApi() {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api');

  // Mantener alineado con la configuración de main.ts
  // Los tags se declaran globalmente porque cada operacion referencia uno y
  // OpenAPI espera que existan en la raiz del documento. Sin esto, un cliente
  // generado a partir del contrato agrupa los endpoints con tags anonimos.
  const config = new DocumentBuilder()
    .setTitle('fitmess API')
    .setDescription('API de la plataforma de fitness fitmess')
    .setVersion(pkg.version)
    .addServer('http://localhost:3000', 'Desarrollo local')
    .addTag('health', 'Estado de la API y sus dependencias')
    .addTag('auth', 'Registro de usuarios y autenticacion')
    .addTag('coach-requests', 'Solicitudes de registro de entrenadores')
    .addTag('admin-invitations', 'Invitaciones para crear administradores')
    .addTag('exercises', 'Biblioteca global de ejercicios')
    .addTag(
      'plans',
      'Construccion, publicacion y ciclo de vida de planes de entrenamiento (COACH)',
    )
    .addTag(
      'plans-catalog',
      'Catalogo publico de planes publicados, para cualquier usuario autenticado',
    )
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

exportOpenApi().catch((error) => {
  console.error('Error exportando contrato OpenAPI:', error);
  process.exit(1);
});
