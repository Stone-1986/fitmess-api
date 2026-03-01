# Rules — Código

Estas reglas son absolutas. Aplican en toda sesión, a todo agente y al desarrollador humano.
No tienen excepciones salvo decisión explícita documentada en este archivo.

---

## Manejo de excepciones

- Los services NUNCA lanzan excepciones HTTP nativas de NestJS (`BadRequestException`, `NotFoundException`, `ConflictException`, etc.) directamente
- Los services SIEMPRE usan `BusinessException` + `BusinessError` para errores de dominio
- Los services SIEMPRE usan `TechnicalException` + `TechnicalError` para errores de infraestructura
- NUNCA crear clases de excepción por módulo — el catálogo de errores vive únicamente en `src/modules/common/exceptions/`
- Para agregar un error nuevo: agregar un entry al enum correspondiente, NUNCA crear una clase nueva
- Los controllers NUNCA hacen try/catch — las excepciones fluyen a los exception filters
- Los listeners de eventos SÍ hacen try/catch porque no pasan por el pipeline HTTP

## Acceso a datos

- Los controllers NUNCA acceden a `PrismaService` directamente
- Solo los services acceden a `PrismaService`
- El import del cliente Prisma SIEMPRE desde `generated/prisma` (raíz del proyecto), NUNCA desde `@prisma/client` — la ruta relativa varía según la profundidad del archivo

## Comunicación entre módulos

- Los módulos NUNCA importan services de otros módulos directamente
- La comunicación entre módulos se hace ÚNICAMENTE vía `@nestjs/event-emitter`
- Los módulos `prisma` y `common` son la única excepción: pueden ser importados por cualquier módulo

## Controllers

- Los controllers son THIN: solo reciben, delegan al service y retornan
- La lógica de negocio vive ÚNICAMENTE en los services
- Los controllers NUNCA construyen queries, modifican datos ni toman decisiones de negocio

## DTOs y Validadores

- Cada operación define DTOs separados: `CreateXxxDto`, `UpdateXxxDto`, `XxxResponseDto`
- Los DTOs de respuesta NUNCA exponen campos internos: `archivedAt`, passwords, tokens, refresh tokens, datos sensibles de salud
- Los validadores personalizados van en `src/modules/[module]/validators/`
- NUNCA duplicar la lógica de validación entre DTOs y services — el DTO valida estructura, el service valida negocio
- Los DTOs SIEMPRE usan decoradores de `class-validator` para validación y `class-transformer` para transformación

## Interceptores, Middlewares y Pipes

- Los interceptores, middlewares y pipes NUNCA contienen lógica de negocio — solo cross-cutting concerns (logging, timing, transformación de respuesta)
- Los interceptores globales viven en `src/modules/common/interceptors/`
- Los middlewares globales se registran en `main.ts`
- Los pipes globales viven en `src/modules/common/pipes/`
- NUNCA acceder a `PrismaService` desde interceptores, middlewares o pipes

## Respuestas

- Los controllers retornan solo `data`, `{ data, meta }` o `{ data, message }` — el `ResponseInterceptor` hace el envelope
- NUNCA construir manualmente el envelope `{ success, statusCode, data, timestamp }` en un controller o service
- Los errores SIEMPRE usan `Content-Type: application/problem+json` (RFC 9457) — esto lo manejan los filters automáticamente

## Lenguaje

- Los mensajes de error (`detail`), comentarios de código, entradas del catálogo y mensajes de validación van en **español**
- Los nombres de variables, funciones, clases, métodos y archivos van en **inglés**