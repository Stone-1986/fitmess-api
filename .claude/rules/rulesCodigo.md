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

## Enums

- NUNCA crear enums locales que dupliquen enums definidos en el schema de Prisma — usar siempre los enums generados en `generated/prisma`
- Los enums SIEMPRE se importan desde `generated/prisma` (con ruta relativa según profundidad del archivo), igual que el resto del cliente Prisma
- Si un DTO necesita un enum que existe en Prisma, importar el de Prisma — no crear una copia local
- Motivo: TypeScript usa tipado nominal — dos enums con los mismos valores pero en archivos distintos son tipos incompatibles, lo que causa errores de compilación silenciosos que SWC/Vitest no detecta

## Comunicación entre módulos

- Los módulos NUNCA importan services de otros módulos directamente
- La comunicación entre módulos se hace ÚNICAMENTE vía `@nestjs/event-emitter`
- Los módulos `prisma` y `common` son la única excepción: pueden ser importados por cualquier módulo. Ambos son `@Global`, así que en la práctica no hace falta importarlos
- Los guards compartidos (`JwtAuthGuard`, `RolesGuard`), los decoradores (`@Roles`, `@Public`, `@CurrentUser`) y el tipo `AuthUser` viven en `src/modules/common/` — NUNCA en `auth/`. Un módulo de dominio que necesite proteger sus endpoints los importa desde `common` y **no importa `AuthModule`**
- `AuthModule` no exporta nada y ningún módulo debe importarlo. Hasta EPICA-02 exportaba los guards junto con `AuthService`, así que cualquier módulo que quisiera proteger un endpoint terminaba con `AuthService` inyectable — el acoplamiento que esta sección prohíbe, entrando por la puerta de atrás
- `LocalAuthGuard` sí se queda en `auth`: solo lo usa el endpoint de login

## Controllers

- Los controllers son THIN: solo reciben, delegan al service y retornan
- La lógica de negocio vive ÚNICAMENTE en los services
- Los controllers NUNCA construyen queries, modifican datos ni toman decisiones de negocio

## DTOs y Validadores

- Cada operación define DTOs separados: `CreateXxxDto`, `UpdateXxxDto`, `XxxResponseDto`
- Los DTOs de respuesta NUNCA exponen campos internos: `archivedAt`, passwords, tokens, refresh tokens, datos sensibles de salud
- Los validadores personalizados van en `src/modules/[module]/validators/` o en `src/modules/[module]/[feature]/validators/` para módulos multi-feature
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

## Variables de entorno

- Los nombres en `.env` DEBEN coincidir EXACTAMENTE con los usados en `configService.getOrThrow()` y `configService.get()` — si el código usa `JWT_SECRET`, el `.env` debe tener `JWT_SECRET`, nunca variantes como `JWT_ACCESS_SECRET`
- El archivo `.env.example` es la fuente de verdad para los nombres de variables — mantenerlo sincronizado con el código
- NUNCA hardcodear valores de configuración que deberían venir de `.env` — usar siempre `ConfigService`

## Lenguaje

- Los mensajes de error (`detail`), comentarios de código, entradas del catálogo y mensajes de validación van en **español**
- Los nombres de variables, funciones, clases, métodos y archivos van en **inglés**