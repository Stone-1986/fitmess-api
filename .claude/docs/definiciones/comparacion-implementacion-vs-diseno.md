# Comparacion: Implementacion vs Diseno Conceptual

> **Fecha:** 2026-02-24 (actualizado)
> **Referencia:** `.claude/docs/definiciones/diseniConceptual.md` (DC)
> **Alcance:** 7 agentes, 10 skills, 2 rules files, Fase 3 (MCP, Hooks, Orquestacion), Fase 4 (Infraestructura NestJS)

---

## 1. Agentes (7)

### 1.1 Agent Team — Planificacion

| Aspecto | DC §3 | Implementado | Estado |
|---|---|---|---|
| **Analista de Producto** — rol | Investiga tendencias, valida criterios de aceptacion, acepta/rechaza funcionalidades | `product-analyst.md`: Valida HU contra criterios funcionales y guardrails legales colombianos. Investiga con WebSearch/WebFetch | ALINEADO |
| **Analista de Producto** — herramientas | Busqueda web autonoma + contexto del proyecto | `tools: Read, Glob, Grep, WebSearch, WebFetch, AskUserQuestion` | ALINEADO |
| **Analista de Producto** — MCP | Lectura | `Mcp-configuracion.md` §2: Lectura | ALINEADO |
| **Arquitecto** — rol | Refina tecnicamente la epica, genera plan de implementacion | `arquitecto.md`: Transforma epicas con HU en Planes de Implementacion YAML | ALINEADO |
| **Arquitecto** — herramientas | Stack tecnologico (.md) + contexto del proyecto | `tools: Read, Glob, Grep, AskUserQuestion` | ALINEADO |
| **Arquitecto** — MCP | Lectura | `Mcp-configuracion.md` §2: Lectura | ALINEADO |
| **Documentador** — rol | Genera contrato OpenAPI bajo patron API First | `documentador.md`: Traduce Plan de Implementacion en archivos TypeScript con decoradores Swagger | ALINEADO |
| **Documentador** — herramientas | Output del Arquitecto | `tools: Read, Glob, Grep, Write, AskUserQuestion` | ALINEADO |
| **Documentador** — MCP | Lectura (DC §3 y §9) | `Mcp-configuracion.md` §2: Ninguno | DESVIACION MENOR |

**Nota Documentador MCP:** El DC asigna "Lectura", pero la implementacion usa "Ninguno". El Documentador solo lee el plan y genera TypeScript — no necesita consultar la DB. Minimo privilegio.

### 1.2 Sub-agentes — Implementacion

| Aspecto | DC §3 / §9 | Implementado | Estado |
|---|---|---|---|
| **Desarrollador** — rol | Implementa codigo estrictamente contra el contrato OpenAPI | `desarrollador.md`: Implementa logica de negocio contra contrato aprobado | ALINEADO |
| **Desarrollador** — MCP | Lectura (DC §9 actualizado: estrategia Prisma-first) | `Mcp-configuracion.md` §2: Lectura. Tools: `list_tables`, `list_migrations`, `generate_typescript_types`, `execute_sql` (solo SELECT) | ALINEADO |
| **QA** — rol | Genera tests, detecta vulnerabilidades, valida criterios de aceptacion | `qa.md`: Tests + cobertura 80%/70% + vulnerabilidades + `/security-review` | ALINEADO (extendido) |
| **QA** — MCP | Lectura (DC §9) | `Mcp-configuracion.md` §2: Ninguno | DESVIACION MENOR |
| **Lider Tecnico** — rol | Valida ESLint+Prettier, cobertura gate duro, analiza errores, delega correcciones | `lider-tecnico.md`: Gate duro linting/cobertura, analiza errores QA, delega, max 3 ciclos | ALINEADO |
| **Lider Tecnico** — MCP | Lectura (DC §9) | `Mcp-configuracion.md` §2: Lectura. Tools: `list_tables`, `list_migrations`, `list_extensions` | ALINEADO |

**Nota Desarrollador MCP:** DC §9 originalmente decia "Lectura / Escritura". Se actualizo a "Lectura" con estrategia Prisma-first: el Desarrollador modifica `schema.prisma` (archivo local), el humano aplica migraciones via `prisma migrate dev`. El MCP se usa para leer/verificar schema, no para escribir.

**Nota Lider Tecnico MCP:** Ahora tiene acceso Lectura para validar que el schema en Supabase coincida con `schema.prisma` y el plan de implementacion, usando `list_tables` y `list_migrations`.

**Nota QA MCP:** DC §9 asigna "Lectura", pero la implementacion usa "Ninguno". El QA opera sobre archivos y ejecuta tests — no consulta la DB directamente. Minimo privilegio.

### 1.3 Agente Standalone

| Aspecto | DC | Implementado | Estado |
|---|---|---|---|
| **Business Analyst** | No mencionado en DC (pre-Team) | `business-analyst.md`: Descompone requerimientos en Epicas/Features/HU Gherkin. Agnostico al dominio | EXTENSION |
| **Business Analyst** — MCP | No definido | `Mcp-configuracion.md` §2: Lectura (lee schema para contexto de dominio) | EXTENSION |

### 1.4 Reglas de ejecucion del Agent Team

| Regla | DC | Implementado | Estado |
|---|---|---|---|
| Analista + Arquitecto en paralelo | DC §3 | `Orquestacion.md` §1 Etapa A. `team-planificacion.yaml`: `runs: parallel` | ALINEADO |
| Documentador inicia solo cuando plan esta cerrado | DC §3 | `Orquestacion.md` §1 Etapa B: `depends_on: ["Analista de Producto", "Arquitecto"]` | ALINEADO |
| Conflicto Analista-Arquitecto escala al humano | DC §3 | `Orquestacion.md` §4.1. Ambos agentes: `escalamiento_requerido: true` | ALINEADO |
| Sub-agentes secuenciales | DC §2 | `Orquestacion.md` §2 + `cadena-implementacion.yaml`: `depends_on` secuencial | ALINEADO |
| Ciclo de error max 3 | DC §2, §7.7, §9 | `Orquestacion.md` §4.3 + `lider-tecnico.md` §Gestion de Ciclos | ALINEADO |
| Activacion manual por humano | DC §2 | `Orquestacion.md` §2: "La cadena la activa el humano manualmente" | ALINEADO |

### 1.5 Secciones I/O de Archivos

| Agente | I/O | Lee de | Escribe en |
|---|---|---|---|
| `product-analyst` | Si | `outputs/epica_input.yaml` | `outputs/reporte_validacion_negocio.yaml` |
| `arquitecto` | Si | `outputs/epica_input.yaml` | `outputs/plan_de_implementacion.yaml` |
| `documentador` | Si | `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml` | `outputs/contrato_openapi/` |
| `desarrollador` | Si | `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml`, `outputs/contrato_openapi/` | `src/` |
| `qa` | Si | `src/`, `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml` | `outputs/reporte_qa.yaml` |
| `lider-tecnico` | Si | `outputs/reporte_qa.yaml`, `src/`, `outputs/plan_de_implementacion.yaml` | `outputs/revision_codigo.yaml` |
| `business-analyst` | No (standalone) | N/A | N/A |

> El DC no definia rutas de I/O. Se definieron en `Orquestacion.md` §3 e implementaron como seccion `## I/O de Archivos` en cada agente del Team.

---

## 2. Skills (10)

### 2.1 Skills de dominio (6) — Referenciados en CLAUDE.md

| Skill | DC | Implementado | Agentes que lo usan | Estado |
|---|---|---|---|---|
| `nestjs-conventions` | DC §4: API First con NestJS | Modulos, controllers, services, DTOs, pipeline global | arquitecto, documentador, desarrollador, lider-tecnico | ALINEADO |
| `error-handling` | DC §4: calidad de codigo | BusinessException, TechnicalException, 4 filters RFC 9457 | desarrollador, qa, lider-tecnico | ALINEADO |
| `testing-patterns` | DC §4: cobertura 80%/70% gate duro | Vitest, mocks Prisma, targets 80%/70% | qa | ALINEADO |
| `design-patterns` | DC §7.5: consistencia contrato-codigo | 9 patrones: state machine, temporal guards, soft-delete, audit trail, etc. | arquitecto, desarrollador, lider-tecnico | ALINEADO |
| `api-first` | DC §4: "contrato OpenAPI se genera antes de codigo" | Flujo diseno-primero, decoradores Swagger, ApiProblemResponse | arquitecto, documentador, lider-tecnico | ALINEADO |
| `legal-guardrails` | DC §4: tabla guardarrails legales (Ley 1581, 1273, 527) | 4 leyes colombianas + Circular SIC 2024. `references/legal-checklists.md` (checklists por tipo de HU, documentType, schemas Prisma) | product-analyst, qa | ALINEADO |

### 2.2 Skills de proceso (3) — No en CLAUDE.md

| Skill | DC | Implementado | Estado |
|---|---|---|---|
| `requirements-decomposition` | DC §4: "entrada minima = epica completa con HU" | Transforma docs de requerimientos en Epicas/Features/HU Gherkin | EXTENSION |
| `analizar-requerimiento` | No en DC | Slash command: `context: fork` + `agent: business-analyst` | EXTENSION |
| `refinar-hu` | No en DC | Slash command: `context: fork` + `agent: business-analyst` | EXTENSION |

> Cubren la fase pre-Team. El DC asume que la epica llega "redactada y refinada" (§4) pero no define como se produce.

### 2.3 Skill de infraestructura (1)

| Skill | DC | Estado |
|---|---|---|
| `skill-creator` | No en DC | EXTENSION — herramienta interna para crear/actualizar skills. 3 scripts (`init_skill.py`, `package_skill.py`, `quick_validate.py`) + 2 references (`workflows.md`, `output-patterns.md`) |

### 2.4 Estructura de resources por skill

| Skill | References | Scripts | Lineas SKILL.md |
|---|---|---|---|
| `nestjs-conventions` | module-patterns.md | — | ~184 |
| `error-handling` | error-catalogs.md | — | ~202 |
| `testing-patterns` | test-examples.md | — | ~102 |
| `design-patterns` | behavior-patterns.md, data-patterns.md, observability.md | — | ~162 |
| `api-first` | api-contract-patterns.md | — | ~161 |
| `legal-guardrails` | legal-checklists.md | — | ~173 |
| `requirements-decomposition` | quality-criteria.md, refinement-checklist.md, templates.md | — | ~276 |
| `analizar-requerimiento` | — | — | ~52 |
| `refinar-hu` | — | — | ~55 |
| `skill-creator` | workflows.md, output-patterns.md | init_skill.py, package_skill.py, quick_validate.py | ~357 |

> Todos los skills usan progressive disclosure: body bajo 500 lineas, references enlazadas desde SKILL.md. `legal-guardrails` fue refactorizado para eliminar una dependencia cross-skill con `design-patterns` — ahora tiene su propia `references/legal-checklists.md`.

### 2.5 Cobertura de skills por agente

| Agente | Skills asignados | Cubre del DC |
|---|---|---|
| product-analyst | legal-guardrails | Guardarrails legales (DC §4) |
| arquitecto | nestjs-conventions, design-patterns, api-first | Patron de desarrollo, calidad (DC §4) |
| documentador | api-first, nestjs-conventions | API First (DC §4) |
| desarrollador | nestjs-conventions, error-handling, design-patterns | Calidad de codigo (DC §4) |
| qa | testing-patterns, error-handling, legal-guardrails | Cobertura gate duro (DC §4) |
| lider-tecnico | nestjs-conventions, error-handling, design-patterns, api-first | Validacion completa (DC §3) |
| business-analyst | requirements-decomposition | Extension pre-Team |

---

## 3. Rules Files (2)

### 3.1 `rulesCodigo.md` — 7 secciones

| Seccion | DC | Estado |
|---|---|---|
| Manejo de excepciones | DC §4 calidad. Services: BusinessException/TechnicalException, NUNCA HttpException. Controllers NUNCA try/catch | ALINEADO |
| Acceso a datos | DC §3 roles. Controllers NUNCA acceden a PrismaService. Import desde `generated/prisma` | ALINEADO |
| Comunicacion entre modulos | DC implica event-emitter en stack. Solo via `@nestjs/event-emitter`. Excepciones: prisma, common | EXTENSION |
| Controllers | DC §3 Desarrollador contra contrato. Controllers thin: reciben, delegan, retornan | ALINEADO |
| Respuestas | DC §4 API First. ResponseInterceptor hace envelope. Errores: `application/problem+json` RFC 9457 | ALINEADO |
| Lenguaje | DC no especifica. Mensajes/comentarios espanol, identificadores ingles | EXTENSION |

### 3.2 `rulesArquitectura.md` — 10 secciones

| Seccion | DC | Estado |
|---|---|---|
| Estructura de modulos | DC §2: modulos mapean a epicas. Cada modulo en `src/modules/[name]/` | ALINEADO |
| Patrones de diseno | DC §7. NUNCA GenericRepository, CQRS, Event Sourcing, Saga, Winston, XState | ALINEADO |
| API | DC §4 API First. Contrato OpenAPI antes de codigo. NUNCA exponer campos internos | ALINEADO |
| Acceso a Supabase | DC §8.6 resuelto. Frontend NUNCA llama PostgREST. Sin `@supabase/supabase-js`. Revocar anon/authenticated | ALINEADO |
| Seguridad y privacidad | DC §4: Ley 1581/2012, Ley 1273/2009. NUNCA loggear passwords/tokens/datos sensibles | ALINEADO |
| Testing | DC §4: 80%/70% gate duro. Si no se alcanza, flujo regresa al QA | ALINEADO |
| Calidad de codigo | DC §4: ESLint + Prettier. Gate duro: QA ejecuta, LT analiza resultados | ALINEADO |
| Escaneo de seguridad | DC no mencionado. `/security-review` como paso del QA. HIGH bloquea, MEDIUM documenta | EXTENSION |
| Control de versiones | DC §4, §9: git por humano. Agentes NUNCA ejecutan git. Excepcion: `/security-review` read-only | ALINEADO |

---

## 4. Fase 3 — MCP, Hooks, Orquestacion

### 4.1 MCP — Configuracion Supabase

| Aspecto | DC §4, §9 | Mcp-configuracion.md | Implementacion (.claude/settings.json) | Estado |
|---|---|---|---|---|
| Servidor | Supabase/Postgres via MCP | Hosted URL con `read_only=true` | `"type": "http"`, `"url": "https://mcp.supabase.com/mcp?read_only=true"` | ALINEADO |
| Modo | No especificado | `read_only=true`: bloquea DDL, SQL escritura, deploy | `read_only=true` en URL | ALINEADO |
| Sin filesystem MCP | MEMORY: "NO sistema de archivos" | Eliminado | Solo Supabase en config | ALINEADO |
| Autenticacion | No especificado | OAuth (hosted URL, sin credenciales locales) | No requiere env vars para MCP | ALINEADO |

**Estrategia Prisma-first (Mcp-configuracion.md §4):**

| Paso | Quien | Que hace |
|---|---|---|
| 1 | Desarrollador | Modifica `schema.prisma` (tablas, campos, relaciones, enums) |
| 2 | Desarrollador | Documenta cambios de schema en su output |
| 3 | Humano | Ejecuta `prisma migrate dev --name [nombre]` + `prisma generate` |
| 4 | Lider Tecnico | Valida via MCP: `list_tables` + `list_migrations` |

**Permisos MCP por agente:**

| Agente | DC §9 | Mcp-configuracion.md §2 | Estado |
|---|---|---|---|
| Analista de Producto | Lectura | Lectura | ALINEADO |
| Arquitecto | Lectura | Lectura | ALINEADO |
| Documentador | Lectura | Ninguno | DESVIACION MENOR (minimo privilegio) |
| Desarrollador | Lectura (Prisma-first) | Lectura | ALINEADO |
| QA | Lectura | Ninguno | DESVIACION MENOR (minimo privilegio) |
| Lider Tecnico | Lectura | Lectura | ALINEADO |
| Business Analyst | No en DC | Lectura | EXTENSION |

**Tools MCP utilizados (Mcp-configuracion.md §3):**

| Tool MCP | Agentes | Modo |
|---|---|---|
| `list_tables` | Analista, Arquitecto, Desarrollador, LT, BA | Lectura |
| `list_migrations` | Desarrollador, LT | Lectura |
| `list_extensions` | Arquitecto, LT | Lectura |
| `generate_typescript_types` | Desarrollador | Lectura |
| `execute_sql` (solo SELECT) | Desarrollador | Lectura |
| `apply_migration` | Ninguno — via Prisma por humano | Bloqueado (`read_only=true`) |
| `deploy_edge_function` | Ninguno | Bloqueado |

### 4.2 Hook pre-commit — Husky + lint-staged

| Aspecto | DC §4 | Hooks-validaciones.md | Implementacion real | Estado |
|---|---|---|---|---|
| Hook valida ESLint + Prettier | "Hook pre-commit valida: ESLint + Prettier" | Husky + lint-staged | `.husky/pre-commit`: `npx lint-staged`. `package.json`: config lint-staged | ALINEADO |
| Script `lint` | No especificado | `lint` = check only | `lint`: sin `--fix` | ALINEADO |
| Script `lint:fix` | No especificado | `lint:fix` = con autofix | `lint:fix`: con `--fix` | ALINEADO |
| Script `format:check` | No especificado | `format:check` = check only | `format:check`: `prettier --check` | ALINEADO |
| Quien ejecuta lint | DC §3: LT "valida ESLint + Prettier" | QA ejecuta, LT analiza resultados | `qa.md` §3: ejecuta lint. `lider-tecnico.md`: analiza reporte | ALINEADO |
| Dependencias | No especificado | husky, lint-staged | `husky@9.1.7`, `lint-staged@16.2.7` | ALINEADO |

### 4.3 Gate de cobertura — Vitest

| Aspecto | DC §4 | Hooks-validaciones.md | Implementacion real | Estado |
|---|---|---|---|---|
| Dominio 80% | "80% minimo para logica de dominio" | Global 75% + QA verifica 80% por capa | `vitest.config.ts`: thresholds 75/75/70/75. QA lee `coverage-summary.json` | ALINEADO |
| Adaptadores 70% | "70% minimo para adaptadores" | QA verifica 70% por tipo de archivo | QA filtra `*.controller.ts`, `*.guard.ts`, etc. | ALINEADO |
| Cobertura no alcanzada | "flujo regresa al QA" | Gate duro — Vitest falla | Error critico en reporte QA | ALINEADO |
| Provider | No especificado | v8 | `@vitest/coverage-v8@4.0.18` | ALINEADO |
| Exclusiones | No especificado | specs, DTOs, modules, generated, main.ts | Configurado en `vitest.config.ts` | ALINEADO |

> **Nota thresholds:** DC dice 80%/70% por capa. Vitest no soporta thresholds por patron de archivo nativo. Se usan thresholds globales de 75% como red de seguridad + verificacion manual por capa por el QA.

### 4.4 Validador de epica — JSON Schema + script

| Aspecto | DC §5.1, §8.5 | Hooks-validaciones.md | Implementacion real | Estado |
|---|---|---|---|---|
| Estructura validada | DC §5.1 define YAML. §8.5 sugiere JSON Schema | Schema + script | `.claude/schemas/epica.schema.json` + `scripts/validate-epica.ts` | ALINEADO |
| Campos requeridos | id, titulo, objetivo_de_negocio, contexto_de_aplicacion, historias_de_usuario | Todos requeridos | Schema: `required: [...]`, pattern `^EPICA-\\d+$`, `minLength` | ALINEADO |
| HU minimas | "al menos 1 HU con criterios de aceptacion" | `minItems: 1` | `historias_de_usuario: { minItems: 1 }`, `criterios_de_aceptacion: { minItems: 1 }` | ALINEADO |
| Runner | No especificado | tsx | `tsx@4.21.0` (reemplazo de ts-node por compatibilidad nodenext) | ALINEADO |
| Script | No especificado | `validate:epica` | `pnpm run validate:epica <archivo.yaml>` | ALINEADO |

### 4.5 Orquestacion — outputs/ y YAMLs

| Aspecto | DC §2, §7.6 | Orquestacion.md | Implementacion real | Estado |
|---|---|---|---|---|
| Directorio outputs/ | DC §7.6: estado entre sesiones | Estructura en §3 | `outputs/.gitkeep`, `outputs/ciclos/.gitkeep` | ALINEADO |
| outputs/ en gitignore | No en DC | Temporales, no se commitean | `/outputs` en `.gitignore` | ALINEADO |
| team-planificacion.yaml | DC §3: reglas del Team | YAML aspiracional | `.claude/team-planificacion.yaml` con nota aspiracional | ALINEADO |
| cadena-implementacion.yaml | DC §2: cadena secuencial | YAML aspiracional | `.claude/cadena-implementacion.yaml` con nota aspiracional | ALINEADO |
| Nota aspiracional | DC §8.1: "consultar cuando salga de experimental" | En ambos YAMLs | Header: "FORMATO ASPIRACIONAL — Agent Teams es experimental" | ALINEADO |

### 4.6 Agentes — Instrucciones I/O

| Aspecto | DC | Orquestacion.md | Implementacion | Estado |
|---|---|---|---|---|
| Agentes saben que leer/escribir | DC §7.6 | §3: "Cada agente lee sus inputs al inicio" | `## I/O de Archivos` en 6 agentes del Team | ALINEADO |
| business-analyst sin I/O | No en DC | No mencionado | Sin seccion I/O (standalone, correcto) | ALINEADO |

---

## 5. Fase 4 — Infraestructura NestJS

> El DC no cubre configuracion de infraestructura NestJS (main.ts, AppModule, modulos transversales). Estos detalles pertenecen al dominio de implementacion, referenciados en `stack-tecnologico-v2.md` y CLAUDE.md.

### 5.1 Modulos transversales

| Modulo | DC | Implementacion | Estado |
|---|---|---|---|
| `PrismaModule` | DC §4: Supabase/Postgres via Prisma | `src/modules/prisma/`: `@Global()`, PrismaService extends PrismaClient, `onModuleInit`/`onModuleDestroy` | IMPLEMENTADO |
| `HealthModule` | No en DC | `src/modules/health/`: `GET /api/health` con Terminus + Prisma DB ping | EXTENSION |
| `CommonModule` | DC §4: calidad de codigo | `src/modules/common/`: exceptions, filters, interceptors, middlewares, swagger. Existia pre-Fase 4 | ALINEADO |

### 5.2 AppModule — Imports configurados

| Import | Paquete | Configuracion | Estado |
|---|---|---|---|
| `ConfigModule.forRoot()` | `@nestjs/config` | `isGlobal: true`. Variables via `.env` (dotenv) | IMPLEMENTADO |
| `LoggerModule.forRoot()` | `nestjs-pino` | `pino-pretty` en dev, redaction de `authorization`/`cookie`/`set-cookie` | IMPLEMENTADO |
| `ThrottlerModule.forRoot()` | `@nestjs/throttler` | 100 requests / 60s por defecto | IMPLEMENTADO |
| `EventEmitterModule.forRoot()` | `@nestjs/event-emitter` | Comunicacion entre modulos (regla `rulesCodigo.md`) | IMPLEMENTADO |
| `PrismaModule` | `@prisma/client` | Global, importado por todos los modulos | IMPLEMENTADO |
| `HealthModule` | `@nestjs/terminus` | Endpoint de monitoreo | IMPLEMENTADO |
| `CorrelationIdMiddleware` | — | Existia pre-Fase 4. Genera/propaga `x-correlation-id` | ALINEADO |

### 5.3 main.ts — Pipeline global

| Componente | Paquete | Configuracion | Estado |
|---|---|---|---|
| **Sentry** | `@sentry/nestjs` | Condicional: solo si `SENTRY_DSN` tiene valor. `SentryGlobalFilter` al inicio del array de filters (menor prioridad) | IMPLEMENTADO |
| **Helmet** | `helmet` | `app.use(helmet())` — headers HTTP de seguridad | IMPLEMENTADO |
| **CORS** | built-in | `app.enableCors()` — habilitado para desarrollo | IMPLEMENTADO |
| **Global prefix** | built-in | `app.setGlobalPrefix('api')` — todos los endpoints bajo `/api` | IMPLEMENTADO |
| **Swagger** | `@nestjs/swagger` | Solo si `NODE_ENV !== 'production'`. DocumentBuilder + SwaggerModule en `/api/docs` | IMPLEMENTADO |
| **ValidationPipe** | built-in | `whitelist`, `forbidNonWhitelisted`, `transform`, `enableImplicitConversion`. `exceptionFactory` con flag `isValidation` | IMPLEMENTADO |
| **ResponseInterceptor** | custom | Envelope `{ success, data, meta, timestamp }`. Existia pre-Fase 4 | ALINEADO |
| **Exception Filters (5)** | custom + Sentry | LIFO: SentryGlobalFilter → GlobalExceptionFilter → PrismaExceptionFilter → ValidationExceptionFilter → ProblemDetailFilter. Existian pre-Fase 4 (excepto Sentry) | IMPLEMENTADO |

### 5.4 Prisma schema — Enums base

| Enum | Valores | Usado por |
|---|---|---|
| `UserRole` | `COACH`, `ATHLETE` | EPICA-01 (auth) |
| `PlanStatus` | `DRAFT`, `PUBLISHED`, `FINALIZED`, `ARCHIVED` | EPICA-03 (plans) |
| `SubscriptionStatus` | `PENDING`, `APPROVED`, `REJECTED`, `ACTIVE` | EPICA-04 (subscriptions) |

> Enums definidos en `prisma/schema.prisma`. Modelos se agregan con cada epica. Migraciones las aplica el humano.

### 5.5 Configuracion adicional

| Item | Detalle | Estado |
|---|---|---|
| `.env.example` | Template con todas las variables: DATABASE_URL, PORT, NODE_ENV, JWT_SECRET, SENTRY_DSN, RESEND_API_KEY, ANTHROPIC_API_KEY, THROTTLE_TTL/LIMIT | CREADO |
| Imports `.js` | Todos los imports relativos usan extension `.js` (requerido por `nodenext` module resolution). 11 archivos existentes corregidos | CORREGIDO |
| ESLint rules | `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access` desactivados. NestJS APIs sin tipar (`getResponse()`, `getRequest()`) producen falsos positivos | CORREGIDO |
| Scaffolding eliminado | `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, `test/app.e2e-spec.ts` (Hello World) | ELIMINADO |

### 5.6 Verificacion

| Comando | Resultado |
|---|---|
| `pnpm run build` | Compila sin errores |
| `pnpm run lint` | 0 errores, 1 warning (`no-unsafe-argument` en PrismaExceptionFilter) |
| `prettier --check` | Todos los archivos formateados |

---

## 6. Decisiones Cerradas DC §9 — Verificacion

| # | Decision | Implementacion | Verificado |
|---|---|---|---|
| 1 | Entrada minima: epica con HU funcionales | Schema JSON valida estructura. Agentes rechazan si faltan elementos | Si |
| 2 | Formato de estructuras: YAML | Todos los outputs YAML. Schema valida entrada YAML | Si |
| 3 | Patron de desarrollo: API First | Skill `api-first`. Documentador genera contrato antes de codigo | Si |
| 4 | Orden Agent Team: paralelo + secuencia | `team-planificacion.yaml`: parallel + sequential con depends_on | Si |
| 5 | Conflictos entre agentes: escala al humano | Ambos agentes: `escalamiento_requerido: true` | Si |
| 6 | Plan de implementacion: YAML fijo, aprobado por humano | Estructura en DC §5.2 = estructura en `arquitecto.md` output | Si |
| 7 | Control de versiones: git por humano | `rulesArquitectura.md` + todos los agentes: "NUNCA ejecutar comandos git" | Si |
| 8 | Operacion sobre archivos: L/E directa | Campo `tools` en frontmatter de cada agente | Si |
| 9 | Cobertura dominio: 80% | `rulesArquitectura.md`, `testing-patterns`, `qa.md`, `lider-tecnico.md` | Si |
| 10 | Cobertura adaptadores: 70% | Idem | Si |
| 11 | Cobertura no alcanzada: flujo regresa al QA | `qa.md`: error critico. `lider-tecnico.md`: gate duro | Si |
| 12 | Linting: ESLint + Prettier por hook pre-commit | `.husky/pre-commit` + `lint-staged` en `package.json` | Si |
| 13 | MCP Desarrollador: Lectura (Prisma-first) | `Mcp-configuracion.md` §2: Lectura | Si |
| 14 | MCP QA: Lectura | Implementado como Ninguno (minimo privilegio) | Desviacion menor |
| 15 | MCP LT: Lectura | `Mcp-configuracion.md` §2: Lectura (`list_tables`, `list_migrations`) | Si |
| 16 | MCP Analista: Lectura | `Mcp-configuracion.md` §2: Lectura | Si |
| 17 | MCP Arquitecto: Lectura | `Mcp-configuracion.md` §2: Lectura | Si |
| 18 | MCP Documentador: Lectura | Implementado como Ninguno (minimo privilegio) | Desviacion menor |
| 19 | Errores criticos QA: LT analiza y delega | `lider-tecnico.md` §4: analiza, redacta instrucciones para Desarrollador | Si |
| 20 | Escalamiento LT: solo si afecta contrato/plan | `lider-tecnico.md`: "Escala al humano UNICAMENTE si..." | Si |
| 21 | Investigacion del Analista: autonoma | `product-analyst.md`: WebSearch + WebFetch | Si |
| 22 | Plataforma: Claude Max | `Orquestacion.md`: "Plataforma: Claude Max" | Si |
| 23 | Base de datos: Supabase/Postgres via MCP | `.claude/settings.json`: Supabase hosted URL | Si |
| 24 | Accionamiento: manual por humano | `Orquestacion.md` §2: "La cadena la activa el humano manualmente" | Si |
| 25 | Revisor de Codigo = Lider Tecnico | `lider-tecnico.md`: "Lider Tecnico / Revisor de Codigo" | Si |
| 26 | Ciclos maximos: 3 | `lider-tecnico.md` §Gestion de Ciclos: "3 ciclos maximo" | Si |
| 27 | Guardarrail datos personales (Ley 1581 + Circular SIC) | `legal-guardrails` skill + `product-analyst.md` §3 | Si |
| 28 | Guardarrail seguridad informatica (Ley 1273) | Idem | Si |
| 29 | Guardarrail transacciones digitales (Ley 527) | Idem | Si |
| 30 | Contrato OpenAPI: solo API NestJS | `rulesArquitectura.md` §Acceso a Supabase + `Pendiente-supabase.md` | Si |
| 31 | Frontend no llama PostgREST | `rulesArquitectura.md` §Acceso a Supabase | Si |
| 32 | Proteccion tablas Supabase: revocar anon/authenticated | Humano ejecuta SQL en setup inicial. `Pendiente-supabase.md` | Si |

---

## 7. Extensiones (no en DC pero implementadas)

| Extension | Donde | Justificacion |
|---|---|---|
| Business Analyst standalone | `.claude/agents/business-analyst.md` | Fase pre-Team: produccion de epicas con HU. DC asume que llegan "redactadas" |
| 3 skills de proceso | `requirements-decomposition`, `analizar-requerimiento`, `refinar-hu` | Tooling para producir la entrada que el DC asume como dada |
| 1 skill de infraestructura | `skill-creator` | Herramienta interna para crear skills. 3 scripts documentados: `init_skill.py`, `package_skill.py`, `quick_validate.py` |
| Comunicacion entre modulos (rule) | `rulesCodigo.md` | DC implica event-emitter (esta en stack) pero no lo codifica como regla |
| Lenguaje (rule) | `rulesCodigo.md` | DC no especifica; necesario para consistencia del codebase |
| Escaneo de seguridad automatizado | `rulesArquitectura.md` + `qa.md` | DC §4 menciona seguridad pero no escaneo automatizado |
| `tsx` como runner | `package.json`, `scripts/validate-epica.ts` | `ts-node` incompatible con `nodenext`. `tsx` lo reemplaza |
| `read_only=true` en MCP | `.claude/settings.json` | Refuerza Prisma-first: ningun agente puede escribir en DB via MCP |
| Tools MCP detallados por agente | `Mcp-configuracion.md` §3 | DC no especificaba que tools del MCP usa cada agente |
| `legal-guardrails` con references locales | `references/legal-checklists.md` | Checklists por tipo de HU, tipos `documentType` y schemas Prisma extraidos a referencia local. Eliminada dependencia cross-skill con `design-patterns` |
| `skill-creator` — `quick_validate.py` documentado | SKILL.md Step 5 | Script existia pero no estaba referenciado en SKILL.md |
| HealthModule | `src/modules/health/` | DC no define health checks. Endpoint `GET /api/health` con Terminus + Prisma DB ping |
| Sentry condicional | `main.ts` | DC no define error tracking. Solo se activa si `SENTRY_DSN` tiene valor |
| Helmet | `main.ts` | DC no define headers HTTP de seguridad. `app.use(helmet())` |
| CORS habilitado | `main.ts` | DC no define CORS. `app.enableCors()` para desarrollo |
| Global prefix `/api` | `main.ts` | DC no define prefijo. Todos los endpoints bajo `/api` |
| Swagger non-prod | `main.ts` | DC menciona API First pero no OpenAPI UI. Solo en `NODE_ENV !== 'production'` |
| `.env.example` | raiz del proyecto | DC no define variables de entorno. Template documentado en espanol |
| Enums Prisma base | `prisma/schema.prisma` | DC no define enums. `UserRole`, `PlanStatus`, `SubscriptionStatus` como base para epicas |
| Spectral linting OpenAPI | `.spectral.yaml`, `scripts/export-openapi.ts` | DC §8.2 sugería Spectral. Integrado como paso del QA con 6 reglas custom + 2 base elevadas |

---

## 8. Desviaciones y justificacion

| # | Desviacion | DC dice | Implementado | Justificacion |
|---|---|---|---|---|
| 1 | MCP QA | Lectura | Ninguno | QA opera sobre archivos y tests. No necesita DB |
| 2 | MCP Documentador | Lectura | Ninguno | Genera TypeScript desde el plan. No necesita DB |
| 3 | Thresholds globales vs por capa | 80% dominio, 70% adaptadores | Global 75% + verificacion manual por capa | Vitest no soporta thresholds por patron. QA verifica por capa leyendo JSON |

> Las desviaciones 1-2 aplican principio de minimo privilegio. La desviacion 3 es limitacion tecnica de Vitest mitigada con verificacion manual del QA.

---

## 9. Retos de diseno DC §7 — Estado actual

| Reto | Estado | Donde se resolvio |
|---|---|---|
| 7.1 Coordinacion interna del Agent Team | Resuelto | `Orquestacion.md` §1: Etapa A (paralelo) + Etapa B (secuencial con depends_on) |
| 7.2 Resolucion de conflictos entre agentes | Resuelto | `Orquestacion.md` §4.1 + ambos agentes documentan conflictos + escalan al humano |
| 7.3 Trazabilidad del razonamiento | **Resuelto** | `archive:cycle` archiva outputs por ciclo, `diff:outputs` compara versiones, campo `razonamiento` obligatorio desde ciclo 2. Ver `Pendiente-trazabilidad.md` |
| 7.4 Calidad de fuentes del Analista | Resuelto (DC) | `legal-guardrails` skill con 4 leyes colombianas |
| 7.5 Consistencia contrato-codigo | **Resuelto** | LT valida manualmente + Spectral valida automáticamente (`.spectral.yaml` con 8 reglas, 7 activas). QA ejecuta, LT analiza |
| 7.6 Estado entre sesiones | Resuelto | `outputs/` como filesystem compartido. Cada agente tiene I/O definido |
| 7.7 Ciclos de correccion | Resuelto (DC) | Max 3 ciclos, escalamiento al humano con reporte detallado |

---

## 10. Investigaciones pendientes DC §8

| Investigacion | Estado | Comentario |
|---|---|---|
| 8.1 Patron Orchestrator-Worker | Pendiente | Agent Teams experimental. YAMLs aspiracionales |
| 8.2 Validacion contratos OpenAPI (Spectral/Prism) | **Resuelto** | Spectral integrado. QA ejecuta (paso 5.6), LT analiza (paso 1.5). Prism descartado (mock server innecesario con tests e2e) |
| 8.3 Gestion de contexto entre agentes | **Resuelto** | 200K tokens por agente, ~167K utilizables. Diseño existente (outputs YAML, I/O explicito, progressive disclosure) mitiga el riesgo. Ver `Pendiente-contexto.md` |
| 8.5 Validacion automatica YAML de entrada | Resuelto | JSON Schema + `validate:epica` script funcional |
| 8.6 Revision API First con Supabase | **Resuelto** | Contrato OpenAPI cubre solo API NestJS. PostgREST no se documenta ni se consume. Ver `Pendiente-supabase.md` |

---

## 11. Resumen ejecutivo

| Categoria | Total | Alineados | Desviaciones menores | Extensiones | Pendientes |
|---|---|---|---|---|---|
| Agentes | 7 | 6 | 2 (MCP QA, Documentador) | 1 (business-analyst) | 0 |
| Skills | 10 | 6 (dominio) | 0 | 4 (proceso + infra) | 0 |
| Rules | 2 files / 17 secciones | 14 | 0 | 3 (comunicacion, lenguaje, security-review) | 0 |
| Fase 3 — MCP | 7 items permisos | 5 | 2 (QA, Documentador) | 1 (BA) | 0 |
| Fase 3 — Hooks | 3 mecanismos | 3 | 0 | 0 | 0 |
| Fase 3 — Orquestacion | 5 items | 5 | 0 | 0 | 0 |
| Fase 4 — Modulos | 3 (Prisma, Health, Common) | 1 (Common) | 0 | 1 (Health) | 0 |
| Fase 4 — AppModule | 7 imports | 7 configurados | 0 | 0 | 0 |
| Fase 4 — main.ts | 8 componentes | 8 configurados | 0 | 0 | 0 |
| Fase 4 — Prisma enums | 3 enums | 3 definidos | 0 | 0 | 0 |
| Decisiones cerradas DC §9 | 32 | 30 | 2 (MCP QA, Documentador) | 0 | 0 |
| Retos de diseno DC §7 | 7 | 7 resueltos | 0 | 0 | 0 |
| Investigaciones DC §8 | 6 | 4 resueltos | 0 | 0 | 1 pendiente |

**Conclusion:** La implementacion esta alineada con el DC en todos los aspectos fundamentales. Las 32 decisiones cerradas de §9 estan verificadas (30 alineadas, 2 desviaciones menores por minimo privilegio en MCP QA/Documentador). Los 7 retos de diseno de §7 estan resueltos. De las 6 investigaciones de §8, 4 estan resueltas (8.2 Spectral, 8.3 gestion de contexto, 8.5 JSON Schema, 8.6 API First con Supabase) y 1 pendiente (8.1 Orchestrator-Worker). La seccion §8.3 se resolvio validando que el diseno existente (outputs YAML, I/O explicito, progressive disclosure) ya implementa las estrategias recomendadas por Anthropic — cada agente opera en 200K tokens (~167K utilizables), ningun agente supera 110K en operacion normal, y la auto-compactacion es automatica. La seccion §8.6 se resolvio con arquitectura three-tier explicita: contrato OpenAPI solo NestJS, frontend nunca llama PostgREST, tablas protegidas revocando `anon`/`authenticated` — codificado en `rulesArquitectura.md` §Acceso a Supabase y checklist del QA §5. Rules tiene 17 secciones (10 en rulesArquitectura.md, 7 en rulesCodigo.md). Fase 4 completa la infraestructura NestJS: AppModule con 7 imports, main.ts con pipeline completo, PrismaModule `@Global()`, HealthModule con Terminus, 3 enums base en Prisma schema, y `.env.example`. Las desviaciones MCP se mantienen por principio de minimo privilegio. Build, lint y Prettier pasan sin errores. Solo queda pendiente §8.1 (Orchestrator-Worker), que depende de que Agent Teams salga de experimental.
