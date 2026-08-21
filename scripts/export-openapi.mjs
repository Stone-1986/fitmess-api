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

// Descripciones curadas de los tags. NO es la lista autoritativa de que tags
// existen: cualquier tag que un controller use via @ApiTags() y que no este
// aqui se declara igualmente en el documento (ver reconcileTags), con una
// descripcion generica y un aviso en consola.
//
// Antes esto era una lista de `.addTag(...)` encadenados que hacia las veces de
// registro unico, y habia que acordarse de ampliarla en cada epica. Nadie se
// acordo en EPICA-03: sus 17 operaciones quedaron con tags no declarados y
// Spectral las reporto todas con `operation-tag-defined`. Es el mismo tipo de
// hueco que los hallazgos #4 y #8: una lista manual que debe seguirle el paso
// al codigo y que falla en silencio hasta que alguien mira los warnings.
const TAG_DESCRIPTIONS = {
  health: 'Estado de la API y sus dependencias',
  auth: 'Registro de usuarios y autenticacion',
  'coach-requests': 'Solicitudes de registro de entrenadores',
  'admin-invitations': 'Invitaciones para crear administradores',
  exercises: 'Biblioteca global de ejercicios',
  plans:
    'Construccion, publicacion y ciclo de vida de planes de entrenamiento (COACH)',
  'plans-catalog':
    'Catalogo publico de planes publicados, para cualquier usuario autenticado',
  subscriptions:
    'Inscripcion de atletas a planes, aprobacion del entrenador y aceptacion del consentimiento informado',
};

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

/**
 * Devuelve los tags realmente usados por alguna operacion del documento.
 *
 * Recorre `paths` filtrando por metodo HTTP: un item de path tambien puede
 * traer claves que no son operaciones (`parameters`, `servers`, `$ref`), y
 * leerles `.tags` daria basura.
 */
function collectUsedTags(document) {
  const used = new Set();

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const [key, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(key)) continue;
      for (const tag of operation?.tags ?? []) used.add(tag);
    }
  }

  return used;
}

/**
 * Declara en la raiz del documento cualquier tag que las operaciones usen y que
 * no este ya declarado. Sin esto, OpenAPI considera el tag indefinido y un
 * cliente generado a partir del contrato agrupa esos endpoints bajo un tag
 * anonimo.
 *
 * Los tags declarados pero sin uso NO se eliminan (podrian corresponder a un
 * modulo temporalmente deshabilitado), solo se avisan.
 */
function reconcileTags(document) {
  // Sin ningun `.addTag()` en el DocumentBuilder, Swagger no crea la clave.
  document.tags ??= [];

  const declared = new Map(document.tags.map((t) => [t.name, t]));
  const used = collectUsedTags(document);

  const missing = [...used].filter((name) => !declared.has(name)).sort();

  let sinDescripcion = 0;

  for (const name of missing) {
    const description = TAG_DESCRIPTIONS[name];
    document.tags.push({
      name,
      description: description ?? `Operaciones de ${name}`,
    });

    // El tag queda declarado igual — el contrato es valido y Spectral pasa.
    // El aviso es solo de calidad: una descripcion generica no le dice nada a
    // quien lea el contrato.
    if (!description) {
      sinDescripcion++;
      console.warn(
        `  aviso: el tag '${name}' no tiene descripcion propia. ` +
          `Agregalo a TAG_DESCRIPTIONS en scripts/export-openapi.mjs.`,
      );
    }
  }

  const unused = [...declared.keys()].filter((name) => !used.has(name)).sort();
  for (const name of unused) {
    console.warn(
      `  aviso: el tag '${name}' esta declarado pero ninguna operacion lo usa.`,
    );
  }

  return {
    declaredCount: document.tags.length,
    autoAdded: missing.length,
    sinDescripcion,
  };
}

async function exportOpenApi() {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api');

  // Mantener alineado con la configuración de main.ts.
  // Los tags NO se declaran aqui: se derivan del documento generado, a partir
  // de los @ApiTags() que los controllers ya declaran. Ver reconcileTags.
  const config = new DocumentBuilder()
    .setTitle('fitmess API')
    .setDescription('API de la plataforma de fitness fitmess')
    .setVersion(pkg.version)
    .addServer('http://localhost:3000', 'Desarrollo local')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // El contrato es la fuente de verdad de que tags existen, no una lista
  // paralela que hay que recordar actualizar en cada epica.
  const { declaredCount, sinDescripcion } = reconcileTags(document);

  mkdirSync('./outputs', { recursive: true });
  writeFileSync('./outputs/openapi.json', JSON.stringify(document, null, 2));
  console.log(
    `Contrato OpenAPI v${pkg.version} exportado en outputs/openapi.json ` +
      `(${declaredCount} tags derivados del contrato` +
      `${sinDescripcion ? `, ${sinDescripcion} sin descripcion propia` : ''})`,
  );

  await app.close();
}

exportOpenApi().catch((error) => {
  console.error('Error exportando contrato OpenAPI:', error);
  process.exit(1);
});
