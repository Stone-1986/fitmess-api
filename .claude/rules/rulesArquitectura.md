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

### Rastro de habeas data en lecturas de datos de terceros

- Todo endpoint que devuelva datos personales de **terceros** y cuyos IDs NO viajen en la URL DEBE llevar `@AuditResources('<Entidad>')` en el handler
- El decorador vive en `src/modules/common/decorators/audit-resources.decorator.ts`; `AuditResourcesInterceptor` recoge los IDs devueltos y `AuditMiddleware` los persiste en `audit_logs.resource_ids`. El mecanismo YA está construido — marcar el endpoint es lo único que hace falta, nunca modificar el interceptor ni el middleware
- El criterio es **de quién son los datos**, no qué rol los pide: `GET /subscriptions/pending` lo lleva porque un entrenador ve nombres de atletas; `GET /subscriptions` NO lo lleva porque el atleta consulta lo suyo
- Sin el decorador, la fila de auditoría registra que alguien consultó pero no **a quién** — y la pregunta de habeas data ("¿quién consultó mis datos?") queda sin responder para esas rutas. Es el hallazgo #9, cerrado para `POST /coach-requests/search` y reabierto por omisión en EPICA-04 pese a que la entrada de mantenimiento que lo cerró ya había dejado escrito que HU-013 lo necesitaría. Una anotación en el execution log no es una regla: nadie la leyó al implementar

## Verificación antes de reportar

- Ningún agente reporta un trabajo como completo sin haberlo confirmado **contra el disco**
- Con Bash disponible: `ls --time-style=full-iso` sobre el archivo, o `git status --short`. El mtime y el tamaño son la evidencia
- Sin Bash (Arquitecto, Líder Técnico, DBA, Analistas): un `Read` explícito del archivo después del Write
- NUNCA vale como confirmación el valor de retorno del propio `Write`, ni un grep del contenido que ya está en el contexto de la conversación — ese grep coincide con lo que el agente redactó, no prueba que el archivo en disco haya cambiado
- Motivo: en EPICA-04 esto ocurrió **seis veces en una sola épica**, en agentes con y sin Bash. El Arquitecto reportó una enmienda al plan que nunca escribió (detectado por mtime); el Desarrollador se declaró terminado dos minutos antes de escribir los listeners; dos subagentes de análisis se fueron a idle sin entregar reporte; el Líder Técnico confirmó su revisión con el retorno del Write en vez de releerla. Ninguno se detectó por los reportes — todos por verificación externa
- Un artefacto que no se escribió es indistinguible de uno que sí, igual que un gate que no corre es indistinguible de uno que pasa

## Testing

- Cobertura mínima de dominio/lógica de negocio: **80%**
- Cobertura mínima de adaptadores: **70%**
- La cobertura se mide **POR ARCHIVO**, no sobre el promedio del proyecto: `vitest.config.ts` tiene `thresholds.perFile: true`. Un archivo nuevo sin tests hace fallar el gate por sí solo, y el mensaje de error lo nombra
- Umbrales efectivos que aplica la herramienta a cada archivo: lines 80%, functions 80%, statements 80%, branches 75%
- NUNCA volver a `perFile: false`. Con el agregado, un archivo en 0% pasa escondido tras el promedio: así sobrevivió `response.interceptor.ts` durante dos épicas, envolviendo TODAS las respuestas de la API con un bug adentro que solo apareció cuando EPICA-02 estrenó el patrón `{ data: null, message }`
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

## Validación del contrato OpenAPI

- `pnpm run openapi:validate` DEBE pasar sin errores — es un gate duro, verificado por el orquestador en el Paso 2.5 además de por el QA
- `openapi:export` genera el contrato a partir de `dist/`, NO del código fuente: se ejecuta `build` primero. El artefacto documentado es el mismo que se despliega
- NUNCA volver a ejecutar el export con `tsx`: esbuild no soporta `emitDecoratorMetadata`, así que Nest no puede resolver dependencias por tipo y el bootstrap muere con `Cannot read properties of undefined`. El comando estuvo roto desde su creación por esta causa y Spectral no corrió ni una vez en EPICA-01 ni en EPICA-09
- Las reglas de `.spectral.yaml` que apuntan a `$.components.schemas[*]` alcanzan DTOs de entrada y de respuesta por igual. Si una regla solo aplica a respuestas, filtrar por el sufijo `ResponseDto` en el `given`

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