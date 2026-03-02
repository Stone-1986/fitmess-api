# La Colmena — Anatomia del Sistema Multi-Agente de fitmess-api

> **Version:** 2.0
> **Ultima actualizacion:** Febrero 2026
> **Plataforma:** Claude Code · Claude Max · Agent Teams (feature experimental)
> **Nombre anterior:** "Diseno Conceptual — Sistema Multi-Agente de Desarrollo"

---

## 1. Que es La Colmena

fitmess-api no es solo un backend NestJS. Es un **sistema de desarrollo asistido por IA** donde 8 agentes especializados, 15 skills de conocimiento, 17 reglas absolutas y 3 mecanismos de validacion automatica trabajan en coordinacion para producir codigo que cumple con un contrato OpenAPI aprobado, pasa gates de cobertura y respeta la legislacion colombiana.

El humano actua como apicultor: no hace la miel, pero decide que flores se polinizan, aprueba la calidad del producto y abre la colmena al mundo (`git push`).

### Principios de diseno

| Principio | Como se implementa |
|---|---|
| **API First** | El contrato OpenAPI se genera antes del codigo — nunca al reves |
| **File-based state** | Los agentes se comunican via archivos YAML en `outputs/`, no via mensajes en memoria |
| **Permisos minimos** | Cada agente tiene exactamente las herramientas que necesita — ni mas, ni menos |
| **Humano como checkpoint** | Git, migraciones y aprobaciones son exclusivamente humanos |
| **Contexto limpio** | Cada agente arranca con su propia ventana de contexto (~200K tokens), sin heredar historial |
| **Trazabilidad** | Cada decision queda en YAML auditable con campo `razonamiento` obligatorio desde ciclo 2 |

---

## 2. Mapa de la Colmena

Todo el sistema vive dentro de `.claude/` y `src/`:

```
.claude/
  agents/                    ← 8 agentes (definiciones .md)
    business-analyst.md         Standalone — descompone requerimientos
    product-analyst.md          Agent Team — valida funcionalidades
    arquitecto.md               Agent Team — genera plan tecnico
    documentador.md             Agent Team — genera contrato OpenAPI
    dba.md                      Standalone/Flujo — diseña schema Prisma
    desarrollador.md            Cadena — implementa codigo
    qa.md                       Cadena — tests + vulnerabilidades
    lider-tecnico.md            Cadena — revision de codigo

  skills/                    ← 15 skills (conocimiento especializado)
    nestjs-conventions/         Modulos, controllers, services, DTOs
    error-handling/             Excepciones, filters, RFC 9457
    testing-patterns/           Vitest, mocks, cobertura
    design-patterns/            State machines, events, soft-delete, audit
    api-first/                  OpenAPI, Swagger, contrato
    legal-guardrails/           Leyes colombianas, datos personales
    requirements-decomposition/ Epicas → Features → HU con Gherkin
    analizar-requerimiento/     Slash command → business-analyst
    refinar-hu/                 Slash command → business-analyst
    planificar-epica/           Orquestacion Fase 1 (Agent Team)
    implementar-epica/          Orquestacion Fase 2 (Cadena Impl.)
    disenar-schema/             Slash command standalone → dba
    validar-qa/                 Slash command standalone → qa
    revisar-codigo/             Slash command standalone → lider-tecnico
    skill-creator/              Herramienta para crear skills nuevos

  rules/                     ← 17 reglas absolutas en 2 archivos
    rulesCodigo.md              7 secciones: excepciones, datos, controllers, respuestas, lenguaje
    rulesArquitectura.md        10 secciones: modulos, patrones, API, Supabase, seguridad, testing, git

  schemas/
    epica.schema.json           JSON Schema para validar epicas de entrada

  docs/                      ← Documentacion
    guia-de-uso.md               Manual de usuario para nuevos desarrolladores
    definiciones/
      diseniConceptual.md         Este documento
      Orquestacion.md             Flujo detallado entre agentes
      Mcp-configuracion.md        Permisos de DB por agente
      Hooks-validaciones.md       Pre-commit, cobertura, validador YAML
      Pendiente-*.md              Investigaciones resueltas
      stack-tecnologico-v2.md     Stack completo con ADRs
      comparacion-*.md            Auditoria de coherencia

  settings.json              ← MCP: Supabase read_only=true
  team-planificacion.yaml    ← Config aspiracional Agent Team
  cadena-implementacion.yaml ← Config aspiracional cadena

src/                         ← Codigo NestJS implementado
  main.ts                       Bootstrap: Sentry, Helmet, Swagger, Filters, Pipes
  app.module.ts                 Config, Pino, Throttler, EventEmitter, Prisma
  modules/
    common/                     Exceptions, Filters, Interceptors, Middlewares, Swagger
    prisma/                     PrismaService (@Global)
    health/                     GET /api/health (Terminus)
    auth/                       EPICA-01 (por implementar)
    exercises/                  EPICA-02 (por implementar)
    plans/                      EPICA-03 (por implementar)
    subscriptions/              EPICA-04 (por implementar)
    execution/                  EPICA-05 + 06 (por implementar)
    metrics/                    EPICA-07 (por implementar)
    ai/                         EPICA-08 (por implementar)
    notifications/              Transversal (por implementar)
```

---

## 3. Los 8 Agentes

### 3.1 Anatomia de un agente

Cada agente es un archivo `.md` en `.claude/agents/` con:

```yaml
---
name: nombre-kebab
description: Que hace y cuando invocarlo
tools: Read, Glob, Grep, ...     # Permisos de filesystem
model: sonnet                     # Modelo de IA (todos usan sonnet)
permissionMode: bypassPermissions # Sin confirmacion del humano
maxTurns: 50                      # Maximo de turnos por invocacion
skills: [skill-1, skill-2]       # Conocimiento especializado cargado
---
```

Todos los agentes:
- Hablan y escriben en **espanol** (excepto nombres de variables/clases en ingles)
- Cierran con: "¿Necesitas ajustar algo en [X]?"
- Operan con `bypassPermissions` — el humano controla el flujo, no cada herramienta
- Usan modelo `sonnet` (200K tokens, suficiente para todos)

### 3.2 Agente standalone — Pre-Team

| Agente | Herramientas | Skills | Rol |
|---|---|---|---|
| **Business Analyst** | Read, Glob, Grep, Write, AskUserQuestion | requirements-decomposition | Descompone documentos de requerimientos en Epicas → Features → HU con criterios Gherkin. Opera **antes** del Agent Team, cuando el humano tiene requerimientos en bruto |

Activacion: `/analizar-requerimiento <archivo>` o `/refinar-hu <archivo>`

### 3.3 Agent Team — Planificacion

Tres agentes que operan sobre una epica YAML validada:

| Agente | Herramientas | Skills | DB (MCP) | Etapa |
|---|---|---|---|---|
| **Analista de Producto** | Read, Glob, Grep, WebSearch, WebFetch, AskUserQuestion | legal-guardrails | Lectura | Paralelo |
| **Arquitecto** | Read, Glob, Grep, AskUserQuestion | nestjs-conventions, design-patterns, api-first | Lectura | Paralelo |
| **Documentador** | Read, Glob, Grep, Write, AskUserQuestion | api-first, nestjs-conventions | Ninguno | Secuencial |

**Reglas de ejecucion:**
- Analista y Arquitecto corren **en paralelo** sobre la misma epica
- Documentador inicia **solo cuando ambos terminan** y no hay conflictos pendientes
- Si hay conflicto entre Analista y Arquitecto → **escala al humano**

**Outputs:**
- Analista → `outputs/reporte_validacion_negocio.yaml`
- Arquitecto → `outputs/plan_de_implementacion.yaml`
- Documentador → `outputs/contrato_openapi/` (controllers con stubs + DTOs)

### 3.4 Cadena de Sub-agentes — Implementacion

Tres agentes que ejecutan de forma estrictamente secuencial:

| Agente | Herramientas | Skills | DB (MCP) | Orden |
|---|---|---|---|---|
| **Desarrollador** | Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion | nestjs-conventions, error-handling, design-patterns | Lectura | 1ro |
| **QA** | Read, Glob, Grep, Write, Bash, AskUserQuestion | testing-patterns, error-handling, legal-guardrails | Ninguno | 2do |
| **Lider Tecnico** | Read, Glob, Grep, Write, AskUserQuestion | nestjs-conventions, error-handling, design-patterns, api-first | Lectura | 3ro |

**Restricciones clave:**
- El **Desarrollador** tiene todas las herramientas (incluido Bash) — es el unico que puede ejecutar comandos y modificar codigo
- El **QA** escribe tests (`.spec.ts`, `.e2e-spec.ts`) pero **NUNCA modifica codigo de produccion**
- El **Lider Tecnico** tiene Write para persistir su reporte (`outputs/revision_codigo.yaml`) pero **NUNCA modifica codigo** — solo lee, analiza y reporta
- El **QA** ejecuta lint y Prettier; el LT solo analiza los resultados del reporte

---

## 4. Los 15 Skills

Los skills son documentos de conocimiento especializado que los agentes cargan segun necesidad. Cada skill tiene un `SKILL.md` (<500 lineas) y opcionalmente `references/` con detalle extendido.

### 4.1 Skills de dominio (6) — listados en CLAUDE.md

| Skill | Contenido clave | References |
|---|---|---|
| `nestjs-conventions` | Estructura de modulos, controllers thin, DTOs, ValidationPipe, ResponseInterceptor, comunicacion entre modulos via events | module-structure.md |
| `error-handling` | BusinessException + BusinessError enum, TechnicalException + TechnicalError enum, 4 exception filters (LIFO), RFC 9457 Problem Details | error-catalog.md, exception-filters.md |
| `testing-patterns` | Vitest + @nestjs/testing, mocks de PrismaService, targets 80%/70%, estructura de specs | testing-examples.md |
| `design-patterns` | State machine (enum + metodos), guards temporales, deep copy, versionado, soft-delete, audit trail, resource policies, logging, eventos | state-machine-patterns.md, event-patterns.md, data-patterns.md |
| `api-first` | Flujo de diseno antes de codigo, decoradores NestJS/Swagger, ApiProblemResponse, formato canonico del plan YAML | api-contract-patterns.md, swagger-decorators.md |
| `legal-guardrails` | Ley 1581/2012 (datos), Circular SIC 2/2024, Ley 1273/2009 (seguridad), Ley 527/1999 (transacciones), checklists por tipo de HU | legal-checklists.md |

### 4.2 Skills de proceso (8) — orquestación y slash commands

| Skill | Modo | Agente asociado |
|---|---|---|
| `requirements-decomposition` | Skill directo | business-analyst |
| `analizar-requerimiento` | Slash command (`context: fork`, `agent: business-analyst`) | business-analyst |
| `refinar-hu` | Slash command (`context: fork`, `agent: business-analyst`) | business-analyst |
| `planificar-epica` | Orquestación Fase 1 | Agent Team (Analista + Arquitecto + Documentador + DBA) |
| `implementar-epica` | Orquestación Fase 2 | Cadena (Desarrollador → QA → LT) |
| `disenar-schema` | Slash command (`context: fork`, `agent: dba`) | dba |
| `validar-qa` | Slash command (`context: fork`, `agent: qa`) | qa |
| `revisar-codigo` | Slash command (`context: fork`, `agent: lider-tecnico`) | lider-tecnico |

### 4.3 Skill de infraestructura (1)

| Skill | Uso |
|---|---|
| `skill-creator` | Guia + scripts Python para crear skills nuevos siguiendo la estructura del proyecto |

---

## 5. Las 17 Reglas Absolutas

Dos archivos en `.claude/rules/`. Aplican a todo agente, en toda sesion, sin excepciones.

### 5.1 Rules — Codigo (`rulesCodigo.md`, 9 secciones)

| Seccion | Regla central |
|---|---|
| Manejo de excepciones | Services usan `BusinessException`/`TechnicalException`, NUNCA excepciones HTTP nativas. Controllers NUNCA hacen try/catch |
| Acceso a datos | Controllers NUNCA acceden a PrismaService. Import desde `generated/prisma`, NUNCA desde `@prisma/client` |
| Comunicacion entre modulos | NUNCA importar services de otros modulos. Comunicacion solo via `@nestjs/event-emitter`. Excepciones: `prisma` y `common` |
| Controllers | Thin: reciben, delegan al service, retornan. Sin logica de negocio |
| Respuestas | Controllers retornan `data` o `{ data, meta }`. El `ResponseInterceptor` hace el envelope. Errores en `application/problem+json` (RFC 9457) |
| Lenguaje | Mensajes y comentarios en espanol. Variables, clases y archivos en ingles |
| *(implicita)* | Listeners de eventos SI hacen try/catch (no pasan por pipeline HTTP) |

### 5.2 Rules — Arquitectura (`rulesArquitectura.md`, 11 secciones)

| Seccion | Regla central |
|---|---|
| Estructura de modulos | Un modulo por epica en `src/modules/[name]/` |
| Patrones de diseno | Prohibidos: GenericRepository, CQRS, Event Sourcing, Saga, Winston, XState |
| API | Patron API First. NUNCA exponer campos internos en DTOs. `@ApiProblemResponse` en cada endpoint |
| Acceso a Supabase | Frontend NUNCA llama a PostgREST. Backend NO usa `@supabase/supabase-js`. Tablas sin permisos para `anon`/`authenticated` |
| Seguridad y privacidad | NUNCA loggear passwords, tokens, datos de salud ni datos personales completos |
| Testing | 80% dominio, 70% adaptadores (gate duro). `.spec.ts` en `src/`, `.e2e-spec.ts` en `test/` |
| Calidad de codigo | ESLint + Prettier como gate duro. QA ejecuta; LT analiza resultados |
| Escaneo de seguridad | QA invoca `/security-review`. HIGH confirmado bloquea. MEDIUM se documenta. LOW se omite |
| Control de versiones | Git operado exclusivamente por el humano. Agentes NUNCA ejecutan git |
| *(excepcion documentada)* | `/security-review` usa git read-only internamente — unica excepcion a la regla de git |

---

## 6. El Flujo Completo

```
                    ┌─────────────────────────────────┐
                    │  FASE 0 — Requerimientos        │
                    │  [Business Analyst] (standalone) │
                    │  /analizar-requerimiento         │
                    │  /refinar-hu                     │
                    └──────────────┬──────────────────┘
                                   ↓
                    Epica YAML validada (pnpm run validate:epica)
                                   ↓
╔══════════════════════════════════════════════════════════╗
║           FASE 1 — Agent Team de Planificacion           ║
║           /planificar-epica                               ║
║                                                          ║
║  [Analista de Producto] ──┐ paralelo                     ║
║  [Arquitecto]             ┘                              ║
║          ↓ (ambos terminan, sin conflictos)               ║
║  [Documentador] → contrato OpenAPI (controllers + DTOs)  ║
║          ↓                                               ║
║  [DBA] → schema Prisma (modelos, indices, constraints)   ║
╚══════════════════════════════════════════════════════════╝
                                   ↓
              ⚠️  CHECKPOINT 1 — Humano aprueba plan + contrato + schema
                                   ↓
                    Humano ejecuta: pnpm prisma migrate dev
                                   ↓
╔══════════════════════════════════════════════════════════╗
║        FASE 2 — Cadena de Implementacion                 ║
║        (activada manualmente por el humano)               ║
║                                                          ║
║  [Desarrollador] → codigo contra OpenAPI                 ║
║        ↓                                                 ║
║  [QA] → tests + escaneo seguridad + Spectral             ║
║        ↓                                                 ║
║  [Lider Tecnico] → revision de codigo                    ║
║        ↓                                                 ║
║    ¿APROBADO?                                            ║
║    ├── SI → sale                                         ║
║    └── NO (ciclo < 3) → nuevo ciclo                      ║
║        └── NO (ciclo 3) → ⚠️ Escala al humano            ║
╚══════════════════════════════════════════════════════════╝
                                   ↓
              ⚠️  CHECKPOINT 2 — Humano hace git push
```

### 6.1 Flujo de error critico (autonomo, max 3 ciclos)

```
[QA] detecta error critico
       ↓
[Lider Tecnico] analiza automaticamente
       ↓
[Lider Tecnico] delega correcciones al [Desarrollador]
       ↓
[Desarrollador] corrige
       ↓
[QA] re-valida → [Lider Tecnico] re-revisa
       ↓
  ¿Error resuelto?
       ↓ SI                    ↓ NO (ciclo < 3)        ↓ NO (ciclo 3)
  Continua flujo         Nuevo ciclo               ⚠️ Escala al humano
                                                   con reporte: errores
                                                   persistentes + historial

  ¿Correccion requiere modificar OpenAPI o Plan?
       ↓ SI                          ↓ NO
  ⚠️ Escala al humano          Resuelto autonomamente
```

### 6.2 Tres puntos de escalamiento al humano

| Escenario | Quien detecta | Output |
|---|---|---|
| Conflicto Analista ↔ Arquitecto | Cualquiera de los dos | `reporte_validacion_negocio.yaml` con `escalamiento_requerido: true` |
| Correccion afecta contrato o plan | Lider Tecnico | `revision_codigo.yaml` con `requiere_modificar_contrato: true` |
| Ciclo 3 sin resolucion | Lider Tecnico | `outputs/revision_codigo.yaml` con `escalamiento_ciclo_3` y recomendaciones |

---

## 7. Comunicacion entre Agentes — outputs/ YAML

Los agentes no comparten memoria ni historial. Se comunican via archivos YAML en el filesystem:

```
outputs/
  epica_input.yaml                  ← Input del humano
  reporte_validacion_negocio.yaml   ← Analista de Producto
  plan_de_implementacion.yaml       ← Arquitecto
  contrato_openapi/                 ← Documentador
    [module].controller.ts
    dto/
      create-[entity].dto.ts
      [entity]-response.dto.ts
  reporte_qa.yaml                   ← QA (ciclo actual)
  revision_codigo.yaml              ← Lider Tecnico (ciclo actual)
  execution-log.md                  ← Log paso a paso (acumulativo, Fase 1 + Fase 2)
```

### 7.1 Quien lee que

| Agente | Lee al inicio |
|---|---|
| Analista de Producto | `outputs/epica_input.yaml` |
| Arquitecto | `outputs/epica_input.yaml` |
| Documentador | `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml` |
| DBA | `prisma/schema.prisma`, `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml` |
| Desarrollador | `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml`, `outputs/contrato_openapi/`, `outputs/revision_codigo.yaml` (ciclos 2+) |
| QA | `src/` (codigo), `outputs/plan_de_implementacion.yaml`, `outputs/reporte_validacion_negocio.yaml` |
| Lider Tecnico | `outputs/reporte_qa.yaml`, `src/` (codigo), `outputs/plan_de_implementacion.yaml` |

### 7.2 Versionado y trazabilidad

- **Git es el mecanismo de versionado.** Los archivos de `outputs/` se versionan con cada commit del humano. Para ver cambios entre iteraciones: `git diff`.
- No se usan scripts de archivado dedicados — git ya cubre esa necesidad.
- Campo `razonamiento` obligatorio desde ciclo 2: estructura `QUE; POR QUE; REFERENCIA` (max 300 chars). Esto documenta el "por que" del cambio directamente en el YAML.

---

## 8. MCP — Acceso a Base de Datos

### 8.1 Configuracion

```json
// .claude/settings.json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?read_only=true"
    }
  }
}
```

Modo hosted URL con OAuth. `read_only=true` bloquea `apply_migration`, SQL de escritura, `deploy_edge_function` y operaciones de proyecto.

### 8.2 Permisos por agente

| Agente | DB (MCP) | Tools MCP usados |
|---|---|---|
| Analista de Producto | Lectura | `list_tables` |
| Arquitecto | Lectura | `list_tables`, `list_extensions` |
| Documentador | Ninguno | — |
| DBA | Lectura | `list_tables`, `list_migrations`, `list_extensions`, `execute_sql` (solo SELECT) |
| Desarrollador | Lectura | `list_tables`, `list_migrations`, `execute_sql` (solo SELECT), `generate_typescript_types` |
| QA | Ninguno | — |
| Lider Tecnico | Lectura | `list_tables`, `list_migrations`, `list_extensions` |
| Business Analyst | Lectura | `list_tables` |

### 8.3 Estrategia Prisma-first

**Fuente de verdad del schema:** `prisma/schema.prisma` (no Supabase directamente).

```
1. Desarrollador modifica schema.prisma segun la HU
2. ⚠️ Humano ejecuta: npx prisma migrate dev --name [nombre]
3. ⚠️ Humano ejecuta: npx prisma generate
4. Lider Tecnico valida via MCP que el schema coincide con el plan
```

Los agentes NUNCA ejecutan migraciones ni comandos Prisma CLI. El MCP se usa exclusivamente para leer y validar.

---

## 9. Hooks y Validaciones Automaticas

Tres mecanismos de validacion que operan en diferentes momentos del flujo:

### 9.1 Hook pre-commit — ESLint + Prettier

| Aspecto | Valor |
|---|---|
| Herramienta | Husky + lint-staged |
| Gatillo | Antes de cada `git commit` del humano |
| Que valida | `eslint --fix` + `prettier --write` sobre `src/**/*.ts` y `test/**/*.ts` |
| Quien lo activa | Solo el humano (los agentes no hacen commits) |

### 9.2 Gate de cobertura — Vitest

| Aspecto | Valor |
|---|---|
| Herramienta | Vitest con provider `v8` |
| Gatillo | `pnpm run test:cov` (ejecutado por el QA) |
| Thresholds globales | Lines 75%, Functions 75%, Branches 70%, Statements 75% |
| Targets por capa (manuales) | Services 80%, Controllers/Guards/Listeners 70% |
| Gate duro | Si no se alcanza, el flujo regresa al QA |

### 9.3 Validador YAML de entrada

| Aspecto | Valor |
|---|---|
| Herramienta | Ajv + JSON Schema (`.claude/schemas/epica.schema.json`) |
| Gatillo | `pnpm run validate:epica outputs/epica_input.yaml` |
| Que valida | Estructura minima: id EPICA-XX, titulo, objetivo, contexto, HU con criterios de aceptacion |
| Quien lo activa | El humano antes de activar el Agent Team |

### 9.4 Validacion OpenAPI — Spectral

| Aspecto | Valor |
|---|---|
| Herramienta | Spectral con `.spectral.yaml` (8 reglas) |
| Gatillo | `pnpm run openapi:validate` (ejecutado por el QA) |
| Que valida | Contrato OpenAPI contra reglas del proyecto |
| 6 reglas error | Bloquean el flujo |
| 2 reglas warn | Se documentan pero no bloquean |

---

## 10. Infraestructura NestJS Implementada

El codigo base ya tiene la infraestructura transversal operativa:

### 10.1 Pipeline de request

```
Request entrante
    ↓
[Helmet]                         Seguridad HTTP (headers)
    ↓
[CorrelationIdMiddleware]        Genera/propaga X-Correlation-Id
    ↓
[ThrottlerGuard]                 Rate limiting (100 req/min)
    ↓
[ValidationPipe]                 Validacion de DTOs (class-validator)
    ↓                            whitelist + forbidNonWhitelisted + transform
[Controller]                     Delega al service
    ↓
[ResponseInterceptor]            Envelope: { success, data, meta, timestamp }
    ↓
Response
```

### 10.2 Pipeline de errores (LIFO — ultimo registrado tiene mayor prioridad)

```
Excepcion lanzada
    ↓
[ProblemDetailFilter]            Prioridad 4 (mayor) — BusinessException + TechnicalException
    ↓ (si no captura)
[ValidationExceptionFilter]      Prioridad 3 — BadRequestException con isValidation: true
    ↓ (si no captura)
[PrismaExceptionFilter]          Prioridad 2 — PrismaClientKnownRequestError
    ↓ (si no captura)
[GlobalExceptionFilter]          Prioridad 1 (menor) — catch-all de ultimo recurso
    ↓ (si Sentry configurado)
[SentryGlobalFilter]             Reporte a Sentry
```

Todos los errores retornan `Content-Type: application/problem+json` (RFC 9457).

### 10.3 Catalogos de errores

| Catalogo | Ubicacion | Ejemplo |
|---|---|---|
| `BusinessError` enum | `src/modules/common/exceptions/business-error.enum.ts` | `PLAN_NOT_FOUND`, `INVALID_STATE_TRANSITION`, `RESOURCE_OWNERSHIP_DENIED` |
| `TechnicalError` enum | `src/modules/common/exceptions/technical-error.enum.ts` | `DATABASE_ERROR`, `EXTERNAL_SERVICE_ERROR`, `UNEXPECTED_ERROR` |

Los services lanzan `BusinessException(BusinessError.X)` o `TechnicalException(TechnicalError.X)`. NUNCA excepciones HTTP nativas.

### 10.4 Modulos globales

| Modulo | Tipo | Funcion |
|---|---|---|
| `ConfigModule` | Global | Variables de entorno (.env) |
| `LoggerModule` (Pino) | Global | Logging estructurado. Redacta `authorization`, `cookie`, `set-cookie`. Pretty en dev |
| `ThrottlerModule` | Global | 100 requests / 60 segundos |
| `EventEmitterModule` | Global | Comunicacion entre modulos (unica forma permitida) |
| `PrismaModule` | Global | `PrismaService` extending `PrismaClient` desde `generated/prisma` |
| `HealthModule` | Feature | GET /api/health con Terminus + ping a DB |

### 10.5 Modulos de dominio (por implementar)

| Modulo | Epica | Estado |
|---|---|---|
| `auth` | EPICA-01 | Por implementar |
| `exercises` | EPICA-02 | Por implementar |
| `plans` | EPICA-03 | Por implementar |
| `subscriptions` | EPICA-04 | Por implementar |
| `execution` | EPICA-05 + 06 | Por implementar |
| `metrics` | EPICA-07 | Por implementar |
| `ai` | EPICA-08 | Por implementar |
| `notifications` | Transversal | Por implementar |

---

## 11. Guardarrails Legales

El Analista de Producto valida automaticamente estos criterios cuando la HU los requiere:

| Guardarrail | Ley | Cuando aplica | Que valida |
|---|---|---|---|
| **Datos personales** | Ley 1581/2012 + Circular SIC 2/2024 | HU con recoleccion/procesamiento de datos de usuarios | Aviso de privacidad, consentimiento explicito, finalidad declarada |
| **Seguridad informatica** | Ley 1273/2009 | Siempre | Acceso no autorizado, logs de auditoria, cifrado de datos sensibles |
| **Transacciones digitales** | Ley 527/1999 | HU con contratos, firmas o transacciones digitales | Autenticidad, integridad, disponibilidad |

Estos guardarrails se verifican en tres momentos:
1. **Analista de Producto** — al validar la HU funcionalmente
2. **QA** — al revisar el codigo implementado (checklists en §5 del agente)
3. **Reglas** — como prohibiciones absolutas en rulesArquitectura.md y rulesCodigo.md

---

## 12. Gestion de Contexto

Cada agente opera en su propia ventana de contexto de **200K tokens** (~167K utilizables, ~33K reservados para auto-compactacion).

### 12.1 Consumo estimado por agente

| Agente | Base (CLAUDE.md + rules + skills + prompt) | Inputs YAML | Trabajo activo | Total estimado | Margen |
|---|---|---|---|---|---|
| Arquitecto | ~15K | ~5K | ~20K | **~40K** | ~127K |
| Analista de Producto | ~15K | ~5K | ~10K | **~30K** | ~137K |
| Documentador | ~15K | ~10K | ~15K | **~40K** | ~127K |
| Desarrollador | ~15K | ~15K | ~80K | **~110K** | ~57K |
| QA | ~15K | ~10K | ~80K | **~105K** | ~62K |
| Lider Tecnico | ~15K | ~15K | ~30K | **~60K** | ~107K |

**Ninguno supera los 110K tokens.** La auto-compactacion de Claude Code se activa automaticamente a ~83.5% y es transparente.

### 12.2 Estrategias ya implementadas

| Estrategia | Implementacion |
|---|---|
| File-based state | `outputs/` YAML entre agentes |
| Progressive disclosure | Skills con body <500 lineas + references enlazadas |
| Just-in-time context loading | I/O explicito por agente — lee solo sus inputs |
| Condensed summaries | YAML estructurado, no prosa libre |
| Clean session boundaries | Cada agente arranca con contexto limpio |
| Archivado de ciclos | Outputs de ciclos anteriores no contaminan el ciclo actual |

### 12.3 Directriz para epicas grandes

Si una epica tiene mas de **8 HU** o **12 endpoints**, el Arquitecto debe proponer su division en 2+ sub-epicas antes de generar el plan.

---

## 13. El Rol del Humano

El humano tiene 6 responsabilidades que ningun agente puede asumir:

| Responsabilidad | Cuando | Comando/accion |
|---|---|---|
| **Validar epica de entrada** | Antes del Agent Team | `pnpm run validate:epica outputs/epica_input.yaml` |
| **Aprobar plan + contrato** | Checkpoint 1 | Revisa outputs, activa cadena de implementacion |
| **Aplicar migraciones** | Checkpoint 1 (despues del DBA) | `pnpm prisma migrate dev` + `pnpm prisma generate` |
| **Resolver conflictos** | Escalamiento | Decide entre posiciones del Analista y Arquitecto |
| **Git** | Checkpoint 2 | `git add`, `git commit`, `git push` |

Adicionalmente, el humano ejecuta una vez como setup inicial:

```sql
-- Revocar acceso PostgREST de Supabase a tablas de dominio
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
-- Re-ejecutar despues de cada `prisma migrate dev`
```

---

## 14. Estructuras Fijas YAML

> Formato: **YAML**. Predecibles, auditables, reutilizables.

### 14.1 Entrada — Epica con HU

```yaml
epica:
  id: "EPICA-XX"
  titulo: ""
  objetivo_de_negocio: ""
  contexto_de_aplicacion: ""
  restricciones_conocidas: []
  historias_de_usuario:
    - id: "HU-XXX"
      titulo: ""
      como: ""        # Como [rol]
      quiero: ""      # Quiero [accion]
      para: ""        # Para [beneficio]
      criterios_de_aceptacion:
        - ""
```

### 14.2 Salida — Plan de Implementacion

> Fuente de verdad canonica: `.claude/skills/api-first/references/api-contract-patterns.md §3`

```yaml
plan_de_implementacion:
  version: "1.0"
  epica_id: ""
  ciclo: 1             # Numero de ciclo. 1 en produccion inicial
  razonamiento: ""     # Omitir en ciclo 1. Obligatorio desde ciclo 2
  modulos_afectados: []
  endpoints:
    - hu_id: ""            # HU que justifica este endpoint
      metodo: ""           # GET, POST, PATCH, DELETE
      ruta: ""             # Siempre en ingles y plural
      proposito: ""
      request_body: ""     # Nombre del DTO de entrada (si aplica)
      response: ""         # Nombre del DTO de respuesta + codigo HTTP
      errores: []          # Lista de status codes documentados
      guards: []           # Guards aplicados al endpoint
      eventos: []          # Eventos emitidos (del catalogo de design-patterns §7)
      dependencias: []     # Otros endpoints que deben existir antes
  orden_de_implementacion: []
  decisiones_arquitectonicas:
    - decision: ""
      justificacion: ""
  criterios_de_aceptacion_tecnicos: []
  riesgos_identificados: []
```

---

## 15. Scripts del Proyecto

| Script | Comando | Quien lo ejecuta | Proposito |
|---|---|---|---|
| `validate:epica` | `pnpm run validate:epica <ruta>` | Humano | Valida estructura YAML de epica antes del Agent Team |
| `openapi:export` | `pnpm run openapi:export` | QA | Exporta el contrato OpenAPI generado por Swagger |
| `openapi:validate` | `pnpm run openapi:validate` | QA | Valida contrato con Spectral |
| `test:cov` | `pnpm run test:cov` | QA | Tests unitarios con reporte de cobertura |
| `test:e2e` | `pnpm run test:e2e` | QA | Tests end-to-end |
| `lint` | `pnpm run lint` | QA / pre-commit | ESLint con auto-fix |
| `format:check` | `pnpm run format:check` | QA | Prettier en modo verificacion (sin escribir) |

---

## 16. Decisiones Cerradas

Registro completo de decisiones tomadas y vigentes:

### Flujo y orquestacion

| Decision | Valor |
|---|---|
| Entrada minima | Epica completa con HU funcionales redactadas |
| Formato de estructuras | YAML |
| Patron de desarrollo | API First |
| Orden en Agent Team | Analista + Arquitecto en paralelo → Documentador en secuencia |
| Conflictos entre agentes del team | Escala al humano |
| Plan de implementacion | Estructura YAML fija, aprobada por humano antes de implementar |
| Accionamiento de implementacion | Manual por el humano despues de aprobar outputs del Agent Team |

### Permisos y accesos

| Decision | Valor |
|---|---|
| Control de versiones | Git operado exclusivamente por el humano |
| Operacion sobre archivos | Lectura/escritura directa en repositorio local |
| Permisos MCP — todos los agentes | Lectura (via `read_only=true`). Documentador y QA sin MCP |
| Estrategia de schema | Prisma-first: Desarrollador modifica `schema.prisma`, humano aplica migraciones |
| Contrato OpenAPI | Cubre unicamente la API propia de NestJS |
| Acceso del frontend a Supabase | Prohibido en el MVP. Toda interaccion via `/api/...` |
| Proteccion de tablas en Supabase | Revocar permisos de `anon` y `authenticated`. Humano ejecuta SQL en setup inicial |

### Calidad y testing

| Decision | Valor |
|---|---|
| Cobertura dominio | 80% minimo (gate duro) |
| Cobertura adaptadores | 70% minimo (gate duro) |
| Cobertura no alcanzada | Flujo regresa al QA |
| Linting | ESLint + Prettier validado por hook pre-commit y por el QA |
| Revisor de Codigo | Es el mismo agente que el Lider Tecnico |
| Ciclos maximos de correccion | 3 ciclos QA → LT → Dev; al tercero escala al humano con reporte |

### Agentes y plataforma

| Decision | Valor |
|---|---|
| Errores criticos del QA | Lider Tecnico analiza y delega autonomamente |
| Escalamiento del LT | Solo si la correccion afecta el contrato OpenAPI o el plan |
| Investigacion del Analista | Autonoma durante la ejecucion |
| Plataforma | Claude Max |
| Base de datos | Supabase/Postgres via MCP (conexion directa a internet) |
| Modelo de agentes | Sonnet para todos (200K tokens, suficiente) |

### Guardarrails legales

| Decision | Valor |
|---|---|
| Datos personales | Ley 1581/2012 + Circular SIC 2/2024 |
| Seguridad informatica | Ley 1273/2009. Aplica siempre |
| Transacciones digitales | Ley 527/1999. Solo si la HU involucra contratos/firmas/transacciones |

---

## 17. Retos de Diseno Abiertos

### 17.1 Coordinacion interna del Agent Team
El Agent Team corre en paralelo internamente, pero el Documentador depende del output del Arquitecto. Gestionar esta sincronizacion requiere definir como se comunican los outputs entre agentes del mismo team. Actualmente la orquestacion es manual.

### 17.2 Resolucion de conflictos entre agentes
El Analista puede rechazar algo que el Arquitecto ya planifico. El humano tiene la ultima palabra, pero el flujo de escalamiento necesita estar disenado para no quedar bloqueado.

### 17.3 Consistencia entre el contrato OpenAPI y el codigo generado
El Desarrollador debe implementar estrictamente contra el contrato. Spectral valida el contrato, pero falta definir como se detecta una desviacion entre el contrato aprobado y el codigo generado en runtime.

### 17.4 Estado entre sesiones
Claude Code no tiene memoria persistente entre sesiones. Si el flujo se interrumpe, retomar requiere que el humano re-invoque al agente con los outputs YAML existentes como contexto fresco.

---

## 18. Investigaciones

### Resueltas (5)

| ID | Tema | Resolucion | Documento |
|---|---|---|---|
| §7.4 / §8.4 | Calidad de fuentes del Analista | 3 guardarrails legales concretos basados en legislacion colombiana | Seccion 11 de este documento |
| §7.5 / §8.2 | Validacion OpenAPI con Spectral | `.spectral.yaml` + `scripts/export-openapi.ts` + pasos §5.6 en QA y §1.5 en LT | `Pendiente-spectral.md` |
| §7.7 / §8.7 | Ciclos de correccion | Max 3 ciclos con escalamiento al humano | `Pendiente-trazabilidad.md` |
| §8.3 | Gestion de contexto entre agentes | 200K tokens, ~167K utilizables, diseno existente ya mitiga el riesgo | `Pendiente-contexto.md` |
| §8.6 | Patron API First con Supabase | Contrato cubre solo NestJS API. PostgREST protegido por REVOKE | `Pendiente-supabase.md` |

### Pendientes (2)

| ID | Tema | Estado | Siguiente paso |
|---|---|---|---|
| §8.1 | Patron Orchestrator-Worker | Pendiente | Revisar cuando Agent Teams salga de experimental |
| §8.5 | Validacion automatica de YAML de entrada | Parcial | JSON Schema existe (`epica.schema.json`) + script `validate-epica.ts`. Falta integrarlo como gate automatico del Agent Team |

---

## 19. Glosario

| Termino | Significado en La Colmena |
|---|---|
| **Agent Team** | Grupo de agentes que corren en la fase de planificacion (Analista + Arquitecto + Documentador) |
| **Cadena de implementacion** | Secuencia Desarrollador → QA → LT que produce codigo validado |
| **Ciclo** | Una iteracion completa Dev → QA → LT dentro de la cadena de implementacion |
| **Checkpoint** | Punto donde el humano debe intervenir activamente |
| **Gate duro** | Condicion que bloquea el flujo si no se cumple (cobertura, linting) |
| **Output** | Archivo YAML que un agente produce y otro consume |
| **Escalamiento** | Situacion que requiere decision del humano |
| **Skill** | Documento de conocimiento especializado que un agente carga al operar |
| **Rule** | Regla absoluta que aplica a todo agente en toda sesion |
| **MCP** | Model Context Protocol — interfaz de acceso a Supabase/Postgres |
| **Prisma-first** | `schema.prisma` es la fuente de verdad; migraciones las aplica el humano |
| **RFC 9457** | Estandar de respuestas de error (`application/problem+json`) |
| **Progressive disclosure** | Patron donde el skill carga solo lo minimo; el detalle esta en references |
