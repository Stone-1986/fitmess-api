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

## Calidad de código

- NUNCA aprobar código que no pase ESLint y Prettier — es un gate duro del Líder Técnico
- El QA ejecuta `pnpm run lint` y `npx prettier --check` e incluye los resultados en su reporte
- El Líder Técnico analiza los resultados de linting sin ejecutar comandos

## Escaneo de seguridad automatizado

- El QA invoca `/security-review` como parte del paso de detección de vulnerabilidades
- `/security-review` usa acceso git de solo lectura internamente — esto es una excepción permitida a la regla de que los agentes no ejecutan comandos git
- Un hallazgo HIGH confirmado por el Líder Técnico bloquea el flujo, igual que una vulnerabilidad CRÍTICA/ALTA manual
- Los hallazgos MEDIUM confirmados se documentan pero no bloquean
- Los hallazgos LOW se omiten del reporte
- El QA puede descartar falsos positivos pero debe justificar cada descarte
- El Líder Técnico valida todos los descartes del QA

## Control de versiones

- Git es operado **exclusivamente por el desarrollador humano**
- Los agentes leen y escriben archivos directamente en el repositorio local pero NUNCA ejecutan comandos git