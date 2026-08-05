# Rules — Arquitectura

Estas reglas son absolutas. Aplican en toda sesión, a todo agente y al desarrollador humano.
No tienen excepciones salvo decisión explícita documentada en este archivo.

---

## Estructura de módulos

- Cada módulo de dominio vive en `src/modules/[module-name]/`
- Los módulos de dominio mapean a las épicas definidas — no crear módulos fuera de este mapa sin justificación
- La estructura interna de cada módulo sigue el patrón definido en el skill `nestjs-conventions`

## Patrones de diseño

- NUNCA implementar repositorios genéricos (`GenericRepository<T>`) — usar services por módulo con queries Prisma específicas
- NUNCA implementar CQRS — la escala del proyecto no lo justifica
- NUNCA implementar Event Sourcing — append-only + frozen flags cubren los requisitos de inmutabilidad
- NUNCA usar el Saga Pattern — `$transaction` de Prisma cubre las operaciones multi-tabla
- NUNCA usar Winston para logging — el proyecto usa Pino (`nestjs-pino`)
- NUNCA usar XState u otras librerías de state machine — implementar con enum + métodos explícitos por transición

## API

- El patrón es **API First**: el contrato OpenAPI se define ANTES de que el desarrollador escriba código
- NUNCA exponer campos internos en DTOs de respuesta: `archivedAt`, passwords, tokens, refresh tokens, datos sensibles de salud
- Todos los endpoints documentan sus respuestas de error con `@ApiProblemResponse(status, description)`

## Acceso a Supabase

- El frontend y el mobile NUNCA llaman a la API de PostgREST de Supabase directamente
- Toda interacción con datos ocurre a través de la API de NestJS (`/api/...`)
- El cliente `@supabase/supabase-js` NO se instala en el backend — Prisma maneja toda la persistencia
- Las tablas de dominio no tienen permisos para los roles `anon` y `authenticated` de Supabase

## Gestión de secretos

- NUNCA commitear archivos `.env` con valores reales — usar `.env.example` con placeholders
- Las variables de entorno SIEMPRE se validan al startup vía `@nestjs/config` con schema de validación
- Los secretos en producción se inyectan desde el entorno del hosting (Supabase/Vercel), NUNCA desde archivos en el repo
- NUNCA hardcodear secretos (API keys, passwords, connection strings) en código fuente

## Seguridad y privacidad (Ley 1581/2012, Ley 1273/2009)

- NUNCA loggear passwords, tokens, refresh tokens ni headers de autorización
- NUNCA loggear datos sensibles de salud (RPE, dolor muscular, motivación) en producción
- NUNCA loggear datos personales completos — solo IDs, nunca nombres, emails ni documentos
- NUNCA loggear el body completo de requests en producción — solo en nivel `debug` en desarrollo
- El `originalError` de `TechnicalException` se loggea pero NUNCA se expone en la respuesta al cliente

## Testing

- Cobertura mínima de dominio/lógica de negocio: **80%**
- Cobertura mínima de adaptadores: **70%**
- Si la cobertura no se alcanza, el flujo de implementación se bloquea y regresa al QA
- Los tests unitarios van en `*.spec.ts` dentro de `src/`
- Los tests e2e van en `*.e2e-spec.ts` dentro de `test/`
- `pnpm run test:e2e` DEBE pasar sin fallos — es un gate duro equivalente a la cobertura y al linting
- La suite e2e es la ÚNICA capa que ejercita el pipeline HTTP completo: `ValidationPipe` (y por tanto los decoradores de los DTOs), guards, interceptores y exception filters. Los tests unitarios llaman a los services directamente y no pueden detectar nada de eso
- Todo endpoint nuevo o modificado se cubre en la suite e2e: happy path, rechazo de validación y, si es protegido, respuesta sin autenticación
- Si `test:e2e` no puede ejecutarse porque la base de datos no está disponible, el gate queda **sin verificar** y se escala al humano — NUNCA se reporta como aprobado. Un e2e que no corre es indistinguible de uno que pasa
- El hook `.husky/pre-commit` también ejecuta `test:e2e`, pero solo cuando el commit toca `src/`, `test/`, `prisma/`, `package.json` o `vitest.config*`. Si la DB no está disponible el hook **avisa y deja pasar**: bloquear empujaría a usar `git commit --no-verify`, que apagaría además lint-staged y `tsc --noEmit`. El hook es una red de conveniencia; el gate autoritativo es el Paso 2.5 de `implementar-epica`

## Calidad de código

- NUNCA aprobar código que no pase ESLint y Prettier — es un gate duro del Líder Técnico
- El QA ejecuta `pnpm run lint` y `pnpm run format:check` e incluye los resultados en su reporte — `format:check` cubre `src/` y `test/`, a diferencia de un `prettier --check` limitado a `src/`
- El Líder Técnico analiza los resultados de linting sin ejecutar comandos

## Compilación

- `pnpm run build` DEBE pasar sin errores — es un gate duro equivalente a linting
- Los tests con Vitest/SWC NO sustituyen la verificación de tipos — SWC transpila sin type-checking
- El Desarrollador verifica con `npx tsc --noEmit` antes de entregar; el QA verifica con `pnpm run build` como parte de su proceso
- `tsconfig.build.json` define su propio `exclude` que REEMPLAZA (no hereda) el `exclude` del `tsconfig.json` padre — si se agrega una exclusión a `tsconfig.json`, TAMBIÉN debe agregarse a `tsconfig.build.json`
- Cualquier archivo `.ts` en la raíz del proyecto (ej: `prisma.config.ts`, `vitest.config.ts`) DEBE estar excluido en `tsconfig.build.json`, de lo contrario TypeScript usa la raíz como `rootDir` y genera `dist/src/` en vez de `dist/`

## Escaneo de seguridad automatizado

- El QA invoca `/security-review` como parte del paso de detección de vulnerabilidades
- `/security-review` usa acceso git de solo lectura internamente — esto es una excepción permitida a la regla de que los agentes no ejecutan comandos git
- Un hallazgo HIGH confirmado por el Líder Técnico bloquea el flujo, igual que una vulnerabilidad CRÍTICA/ALTA manual
- Los hallazgos MEDIUM confirmados se documentan pero no bloquean
- Los hallazgos LOW se omiten del reporte
- El QA puede descartar falsos positivos pero debe justificar cada descarte
- El Líder Técnico valida todos los descartes del QA

## Commits estandarizados

- `/commit` crea commits con formato Conventional Commits y tags de trazabilidad
- `/commit` ejecuta comandos git (add, commit, tag) — esto es una excepción permitida a la regla de que los agentes no ejecutan comandos git, porque el humano lo invoca explícitamente
- NUNCA stagear archivos `.env` con valores reales, `node_modules/`, `dist/` ni `coverage/`
- Los tags de épica siguen el formato `EPICA-XX/checkpoint-N` (annotated tags)

## Control de versiones

- Git es operado **exclusivamente por el desarrollador humano**
- Los agentes leen y escriben archivos directamente en el repositorio local pero NUNCA ejecutan comandos git