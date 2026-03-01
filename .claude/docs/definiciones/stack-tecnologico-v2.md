# Arquitectura y Stack Tecnologico — App Fitmess

**Fecha de definicion:** 2026-02-18
**Ultima actualizacion:** 2026-02-19
**Estado:** En revision
**Version:** 2.1
**Documento fuente:** proyecto-app.txt, stack-tecnologico.md (v1.0)

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Contexto y Restricciones del Proyecto](#2-contexto-y-restricciones-del-proyecto)
3. [Analisis de Complejidad del Dominio](#3-analisis-de-complejidad-del-dominio)
4. [Alternativas Evaluadas y Motivos de Descarte](#4-alternativas-evaluadas-y-motivos-de-descarte)
5. [Decision Final y Justificacion](#5-decision-final-y-justificacion)
6. [Stack Detallado](#6-stack-detallado)
7. [Patrones Arquitectonicos](#7-patrones-arquitectonicos)
8. [Infraestructura, CI/CD y Costos](#8-infraestructura-cicd-y-costos)
9. [Estrategia de Escalabilidad](#9-estrategia-de-escalabilidad)
10. [Registro de Decisiones Arquitectonicas (ADR)](#10-registro-de-decisiones-arquitectonicas)
11. [Inconsistencias Pendientes de Resolver](#11-inconsistencias-pendientes-de-resolver)
12. [Changelog respecto a v1.0](#12-changelog-respecto-a-v10)

---

## 1. Resumen Ejecutivo

| Atributo | Valor |
|----------|-------|
| Alcance MVP | Prueba controlada: 20 atletas, 2 entrenadores, 1 admin (~23 usuarios) |
| Estructura de proyecto | Repositorios independientes (backend + frontend) |
| Patron arquitectonico | Monolito Modular (backend) + SPA (frontend) |
| Contrato API | OpenAPI 3.1 (auto-generado por @nestjs/swagger) + orval (codegen en frontend) |
| Backend | NestJS 11 (Node.js 22 LTS) |
| Frontend | React 19 + Vite 6 |
| Lenguaje | TypeScript 5.x (end-to-end) |
| Base de datos | PostgreSQL 16 (Supabase) |
| ORM | Prisma 7 |
| Autenticacion | JWT (access + refresh tokens) con revocacion por token_version |
| Proveedor IA | Claude API — Anthropic (@anthropic-ai/sdk) |
| Visualizacion | Recharts 3 (dashboards) |
| Observabilidad | Sentry (error tracking) + Pino (logging estructurado) |
| CI/CD | GitHub Actions |
| Deploy | Railway (API) + Vercel (SPA) + Supabase (DB + Storage) |
| Costo MVP estimado | ~$2-6 USD/mes |

---

## 2. Contexto y Restricciones del Proyecto

### Alcance de la prueba controlada

| Parametro | Valor |
|-----------|-------|
| Atletas | 20 |
| Entrenadores | 2 |
| Administradores | 1 |
| Planes por entrenador | minimo 3 |
| Usuarios concurrentes maximos | ~23 |
| Duracion estimada del piloto | 4-8 semanas |

### Restricciones tecnologicas

| Restriccion | Valor definido | Impacto en la arquitectura |
|-------------|---------------|---------------------------|
| Escala MVP | ~23 usuarios (prueba controlada) | Monolito es mas que suficiente. Free tiers cubren toda la demanda |
| Escala objetivo (12 meses) | < 500 usuarios concurrentes | Arquitectura debe soportar crecimiento sin reescritura |
| Equipo de desarrollo | Nuevo, sin restriccion de stack | Libertad para elegir lo optimo para el dominio |
| Presupuesto de infra | Minimo viable (free tiers) | Priorizar servicios con tier gratuito generoso |
| Plataforma objetivo | Web responsive (sin app movil en corto plazo) | API-first como preparacion, pero sin inversion movil ahora |
| Notificaciones | In-app unicamente | Sin websockets ni push notifications. Polling al navegar |
| Email transaccional | Solo recuperacion de contrasena | Servicio minimo (Resend free tier: 100 emails/dia) |
| Proveedor de IA | Claude (Anthropic) | SDK TypeScript oficial. Modelo Sonnet para costo/calidad |
| Contenido multimedia | Texto + imagenes ligeras (avatares, banners) | Sin CDN de video. Supabase Storage es suficiente |
| Marco regulatorio | Ley 1581 de 2012 (Colombia) | Requiere audit trail robusto: timestamps, IP, versiones de documentos |

---

## 3. Analisis de Complejidad del Dominio

Se identificaron 7 ejes de complejidad que impactan directamente la eleccion del stack:

| Aspecto | Complejidad | Descripcion | Impacto en arquitectura |
|---------|:-----------:|-------------|------------------------|
| Modelo de dominio | **Alta** | Planes con sesiones, bloques, ejercicios. Versionado de ejercicios. Instancias personalizadas por atleta | Requiere DB relacional robusta con constraints y soporte JSON |
| Maquina de estados | **Media** | Plan: Borrador > Publicado > Finalizado > Archivado. Suscripcion: Pendiente > Aprobada > Activa | Necesita patron state machine bien definido con guards de transicion |
| Cumplimiento legal | **Alta** | Ley 1581/2012: habeas data, datos sensibles, consentimiento informado por plan. Trazabilidad con timestamp + IP + version | Audit trail inmutable. Interceptors que capturen metadata de cada request |
| IA bajo demanda | **Media** | Analisis manual disparado por el entrenador. Feedback estructurado que asesora sin modificar planes | Servicio desacoplado que invoca Claude API. Historial de analisis persistente |
| Multi-rol con permisos | **Media** | 3 roles (Atleta, Entrenador, Admin). Permisos a nivel de recurso: entrenador solo ve SUS atletas | RBAC + policies por recurso. Guards por ruta y por entidad |
| Notificaciones in-app | **Baja** | Badge/banner interno. Sin push, sin email, sin websockets | Tabla de notificaciones + consulta al navegar |
| Inmutabilidad de datos | **Alta** | Resultados congelados al cerrar semana. Ejercicios versionados. Historial permanente sin eliminacion | Soft-delete, snapshots, flags frozen, append-only para versiones |

### Reglas de negocio con impacto arquitectonico directo

| Regla | Impacto tecnico |
|-------|----------------|
| RN-05: Ejercicios inmutables una vez usados | Patron de versionado append-only |
| RN-07: Planes conservan la version original del ejercicio | FK a exercise_version, no a exercise |
| RN-09: Semana cerrada congela datos para la IA | Flag frozen + bloqueo de escrituras |
| RN-13: Planes y resultados NO se eliminan | Soft-delete obligatorio |
| RN-19/RN-20: Habeas data en registro, consentimiento por plan | Tabla legal_acceptances con trazabilidad completa |
| RN-31: Cada atleta tiene instancia personalizada del plan | Deep copy del plan base al aprobar inscripcion |
| RN-33: Modificaciones solo antes de que el atleta inicie la semana | Guard temporal en modificacion de instancia |
| RI-03: Entrenadores solo ven datos de atletas de SUS planes | Policy pattern en autorizacion a nivel de recurso |

---

## 4. Alternativas Evaluadas y Motivos de Descarte

Se evaluaron 3 stacks contra los requisitos del proyecto:

| | Next.js Full-Stack | NestJS + React SPA | FastAPI + React |
|---|---|---|---|
| Backend | Server Actions + API Routes | NestJS (framework dedicado) | FastAPI (Python) |
| Frontend | Next.js App Router | React + Vite (SPA) | React + Vite (SPA) |
| Lenguaje | TypeScript unificado | TypeScript unificado | Python + TypeScript |
| Deploy | Vercel (unico) | Railway + Vercel | Railway + Vercel |

### Puntaje ponderado

| Criterio | Peso | Next.js | NestJS + React | FastAPI + React |
|----------|:----:|:-------:|:--------------:|:---------------:|
| Velocidad al MVP | 25% | 9 | 6 | 7 |
| Complejidad dominio | 20% | 7 | 9 | 8 |
| Cumplimiento legal | 15% | 7 | 9 | 9 |
| Integracion IA | 10% | 8 | 8 | 8 |
| Costo infraestructura | 15% | 9 | 7 | 7 |
| Escalabilidad futura | 10% | 7 | 9 | 9 |
| Ecosistema fitness | 5% | 7 | 7 | 8 |
| **Puntaje ponderado** | **100%** | **7.85** | **7.75** | **7.80** |

Los puntajes numericos son cercanos, pero la evaluacion cualitativa para un dominio con 35 reglas de negocio, cumplimiento legal colombiano y versionado/inmutabilidad extensivo favorece la arquitectura con backend dedicado.

### Motivos de descarte

| Stack descartado | Razon principal |
|-----------------|-----------------|
| Next.js Full-Stack | Acoplamiento frontend-backend limita escalabilidad. Server Actions tienen acceso limitado a metadata del request (IP) para auditoria legal. No preparado para clientes moviles futuros |
| FastAPI + React | Dos lenguajes en el proyecto (Python + TypeScript) aumenta la carga cognitiva. La ventaja en data science no es relevante para el MVP |

---

## 5. Decision Final y Justificacion

### Stack elegido: NestJS API + React SPA

| # | Justificacion |
|---|---------------|
| 1 | **Dominio complejo**: 35 reglas de negocio, state machines, versionado y cumplimiento legal se benefician de la estructura opinada de NestJS (modulos, DI, guards, interceptors, pipes) |
| 2 | **API-first**: La API REST queda lista para ser consumida por una app movil futura sin modificar el backend |
| 3 | **Escalamiento independiente**: Frontend y backend se despliegan y escalan por separado. Si la IA crece en carga, se escala solo el backend |
| 4 | **Testing superior**: La inyeccion de dependencias nativa de NestJS facilita mockear servicios para testing unitario de logica compleja |
| 5 | **Auditoria legal robusta**: Interceptors globales capturan automaticamente IP, timestamps y metadata de cada request mutativo (Ley 1581/2012) |
| 6 | **TypeScript unificado**: Un solo lenguaje en ambos proyectos. Tipos del frontend auto-generados desde el contrato OpenAPI del backend |
| 7 | **Preparacion futura**: La separacion backend/frontend permite extraer modulos a microservicios si la escala lo requiere, sin reescribir el frontend |

---

## 6. Stack Detallado

### 6.1 Backend — NestJS API

| Capa | Tecnologia | Version | Justificacion |
|------|-----------|---------|---------------|
| Framework | NestJS | 11.x | Estructura opinada: modulos, DI, guards, interceptors, pipes. Ideal para dominio complejo |
| Runtime | Node.js | 22 LTS | Soporte a largo plazo, performance mejorado |
| Lenguaje | TypeScript | 5.x | Tipado estricto end-to-end |
| ORM | Prisma | 7.x | Type-safe queries, migraciones declarativas, schema como documentacion viva del dominio |
| Validacion | class-validator + class-transformer | latest | Validacion declarativa con decoradores. Integrada nativamente con NestJS ValidationPipe |
| Documentacion API | Swagger (@nestjs/swagger) | latest | Documentacion auto-generada desde decoradores. Facilita integracion con frontend y futuros clientes moviles |
| Auth | @nestjs/passport + @nestjs/jwt | latest | Estrategias de autenticacion pluggables. JWT stateless para la API |
| Autorizacion | Guards custom + decoradores RBAC | — | Guards por rol (Atleta, Entrenador, Admin) y por recurso (RI-03) |
| Eventos | @nestjs/event-emitter | latest | Comunicacion desacoplada entre modulos. Patron pub/sub in-process |
| Config | @nestjs/config | latest | Variables de entorno tipadas y validadas |
| Logging | nestjs-pino (Pino) | 10.x | Logging estructurado JSON. Bajo overhead en produccion. Integrado como LoggerModule global |
| Rate limiting | @nestjs/throttler | 6.x | Proteccion contra abuso. Critico para endpoint de IA (costo por request a Claude API) |
| Seguridad HTTP | helmet | latest | Headers de seguridad (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) |
| Health checks | @nestjs/terminus | latest | Endpoint /health para monitoreo de Railway. Verifica DB y servicios externos |
| CORS | @nestjs/core (built-in) | — | Configurado para permitir origen de Vercel. Requerido por arquitectura SPA + API separados |
| Email | Resend (@resend/node) | latest | Email transaccional minimo: solo recuperacion de contrasena. Free tier: 100 emails/dia |
| Testing | Vitest + supertest | latest | Testing unitario (services), integracion (controllers) y e2e (API completa) |
| Error tracking | @sentry/nestjs | latest | Captura automatica de excepciones y traces. Free tier: 5K eventos/mes |

### 6.2 Frontend — React SPA

| Capa | Tecnologia | Version | Justificacion |
|------|-----------|---------|---------------|
| Libreria UI | React | 19.x | Ecosistema maduro, amplia comunidad, component model probado |
| Bundler | Vite | 6.x | Build rapido, HMR instantaneo, configuracion minima |
| Lenguaje | TypeScript | 5.x | Consistencia con el backend. Tipos auto-generados desde OpenAPI spec |
| Routing | React Router | 7.x | Modo SPA (client-side only, sin SSR). Routing declarativo, layouts anidados. No se usan loaders/actions de framework — TanStack Query maneja server state |
| UI Components | shadcn/ui | latest | Componentes accesibles, responsive, personalizables. Sin costo de licencia |
| Estilos | Tailwind CSS | 4.x | Utility-first. Desarrollo rapido de interfaces responsive |
| Estado servidor | TanStack Query | 5.x | Cache inteligente, invalidacion automatica. Sincroniza con la API REST |
| Estado local | Zustand | 5.x | Estado global ligero para UI (sidebar, modals, theme). Sin boilerplate |
| Formularios | React Hook Form + Zod | latest | Performante, validacion con schemas Zod propios del frontend basados en el contrato OpenAPI |
| API codegen | orval | latest | Genera tipos TypeScript, cliente HTTP (con ky) y hooks TanStack Query desde la OpenAPI spec del backend. Elimina sincronizacion manual de tipos |
| HTTP Client | ky | latest | Wrapper minimalista sobre fetch nativo. Interceptors para auth tokens, retry y manejo centralizado de errores. Sin dependencias pesadas |
| Graficos | Recharts | 3.x | Graficos declarativos basados en React + D3. Necesario para dashboards de metricas y progreso (EPICA-07) |
| Testing | Vitest + @testing-library/react | latest | Tests unitarios de componentes y hooks. Nativo con Vite (misma config) |
| Error tracking | @sentry/react | latest | Captura de errores en produccion desde el dia 1 |

### 6.3 Repositorios Independientes y Contrato API

**Decision:** Backend y frontend viven en repositorios Git separados. No se usa monorepo.

| Ventaja | Descripcion |
|---------|-------------|
| Deploys independientes | Un hotfix en el backend no requiere rebuild del frontend y viceversa |
| Pipelines aislados | CI/CD de cada repo corre solo cuando cambia su codigo. Builds mas rapidos |
| Testing aislado | Cada repo tiene su suite de tests sin dependencias cruzadas |
| Escalado de equipo | Permite que equipos distintos trabajen en cada repo sin conflictos de merge |
| Versionado independiente | Cada repo tiene su propio historial, tags y releases |

#### Estructura de repositorios

```
fitmess-api/              → Repositorio backend
  src/
    modules/              → Modulos NestJS (auth, plans, exercises, etc.)
  prisma/
    schema.prisma         → Schema de base de datos
  openapi/
    openapi.json          → Spec generada automaticamente por @nestjs/swagger
  test/
  package.json

fitmess-web/              → Repositorio frontend
  src/
    api/                  → Cliente HTTP y tipos auto-generados por orval
    components/
    pages/
    hooks/
  orval.config.ts         → Configuracion de codegen
  package.json
```

#### Contrato API: OpenAPI como fuente de verdad

La sincronizacion de tipos entre backend y frontend se resuelve via **OpenAPI spec + codegen**, sin paquete compartido manual:

| Paso | Donde | Que sucede |
|------|-------|------------|
| 1. Backend define DTOs | `fitmess-api` | Los decoradores de @nestjs/swagger (@ApiProperty, @ApiResponse, etc.) documentan los endpoints |
| 2. Spec se genera | `fitmess-api` CI | El pipeline exporta `openapi.json` como artefacto (o se publica en una URL del entorno de staging) |
| 3. Frontend consume spec | `fitmess-web` | `orval` lee la spec y genera: tipos TypeScript, cliente HTTP (adaptado a ky), hooks de TanStack Query |
| 4. Frontend usa tipos generados | `fitmess-web` | Los componentes importan desde `src/api/` con tipado completo y autocompletado |

**Flujo de actualizacion:**
```
Backend cambia un DTO
  → CI genera nueva openapi.json
  → Frontend ejecuta `pnpm run generate-api` (orval)
  → Tipos actualizados. Si hay breaking changes, TypeScript los detecta en compilacion
```

#### Enums y constantes de dominio

| Elemento | Estrategia |
|----------|-----------|
| Enums (PlanStatus, UserRole, SessionType) | Definidos en el backend como parte de los DTOs. Generados automaticamente en el frontend via orval |
| Constantes de negocio (ventana edicion = 7 dias, escala RPE) | Definidos en el backend y expuestos via endpoint GET /api/config/constants. Frontend los consume via TanStack Query con cache largo (staleTime: Infinity) |
| Zod schemas (validacion de formularios) | Definidos solo en el frontend. Se basan en los tipos generados por orval para garantizar consistencia |

### 6.4 Base de Datos

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Motor | PostgreSQL 16 | Modelo relacional complejo (planes > sesiones > bloques > ejercicios > versiones). Soporte nativo JSON, timestamps, constraints |
| Hosting | Supabase (free tier) | 500 MB DB, 1 GB file storage. Holgado para prueba controlada (~23 usuarios) |
| ORM | Prisma 7.x | Type-safe queries, migraciones declarativas, introspection |
| Auditoria | Interceptor NestJS + tabla audit_log | Cada mutacion registra: usuario, IP, timestamp, accion, entidad afectada |
| Backups MVP | pg_dump manual via script | Suficiente para prueba controlada. Automatizar con cron en Fase 1 |
| Paginacion | Cursor-based (por defecto) | Eficiente para listados con scroll. Offset-based disponible donde sea mas practico (ej: tablas admin) |

**Estimacion de uso de almacenamiento (prueba controlada):**

| Concepto | Estimacion |
|----------|-----------|
| 23 usuarios + perfiles | < 1 MB |
| 6 planes con sesiones, bloques, ejercicios | < 5 MB |
| 20 instancias de atleta (deep copies) | < 10 MB |
| Resultados (8 semanas de piloto) | < 15 MB |
| Audit log (8 semanas) | < 10 MB |
| Analisis IA (historial) | < 5 MB |
| **Total estimado** | **< 50 MB (10% del free tier)** |

### 6.5 Autenticacion y Autorizacion

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Estrategia | JWT (access token + refresh token) | Stateless, escalable, compatible con futuros clientes moviles |
| Access token | Expiracion: 15 min | Vida corta para minimizar ventana de compromiso |
| Refresh token | Expiracion: 7 dias, rotacion en cada uso | Almacenado en httpOnly cookie. Rotacion previene reuso |
| Auth backend | @nestjs/passport + @nestjs/jwt | Estrategia Local (email + password) para login. Estrategia JWT para proteger rutas |
| Password hashing | bcrypt | Estandar de la industria. Factor de costo configurable |
| Revocacion de tokens | Campo `token_version` en tabla User | Al cambiar contrasena, logout global o desactivacion por admin, se incrementa token_version. El access token incluye la version; si no coincide, se rechaza. Sin necesidad de Redis |
| Recuperacion de contrasena | Token temporal (UUID v4, expira en 1 hora) | Se envia link por email via Resend. Token hasheado en tabla password_resets |
| Rol-based access | Decorador @Roles() + RolesGuard | Restringe acceso por rol a nivel de controller/handler |
| Resource-level access | Policy pattern | Verifica que el recurso pertenezca al usuario (ej: entrenador solo accede a atletas de SUS planes, RI-03) |

### 6.6 Integracion IA

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| LLM | Claude API (modelo Sonnet) | Analisis estructurado de datos de entrenamiento. Costo eficiente bajo demanda |
| SDK | @anthropic-ai/sdk | SDK oficial TypeScript. Tipado completo |
| Modulo NestJS | AIModule dedicado | Encapsula toda la logica de IA. Desacoplado del resto del dominio |
| Patron invocacion | Sincrono (request-response) | Volumen minimo (~23 usuarios). Timeout de 60s con feedback al usuario |
| Persistencia | Tablas ai_analyses + ai_recommendations | Cada analisis se persiste con: fecha, datos de entrada (snapshot), resultado, entrenador que lo solicito |
| Rate limit | 1 analisis por atleta por semana cerrada | Proteccion de costos. Configurable via constante en el backend, expuesta en GET /api/config/constants |

**Inputs del analisis IA (segun proyecto-app.txt):**
- Plan activo del atleta
- Resultados semanales
- RPE promedio
- Dolor muscular (capturado via WeeklySensation)
- Motivacion (capturado via WeeklySensation)
- Objetivo del atleta

**Outputs:**
- Feedback estructurado
- Alertas (riesgo de lesion, sobrecarga)
- Recomendaciones de ajuste
- Analisis de carga

### 6.7 Storage de Archivos

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Imagenes | Supabase Storage | Incluido en free tier (1 GB). CDN integrado |
| Flujo | Upload via API backend | Frontend envia al backend, backend valida (tipo, tamano max 2MB) y sube a Supabase Storage |
| Tipos de archivo | Avatares de usuario y banners de entrenador | Solo imagenes ligeras (JPEG, PNG, WebP). Sin video en MVP |
| Lectura | URL publica de Supabase Storage | Imagenes accesibles via CDN directo. Sin proxying por backend |

### 6.8 Observabilidad y CI/CD

#### Error Tracking

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Backend | @sentry/nestjs | Captura automatica de excepciones, traces de requests. Free tier: 5K eventos/mes |
| Frontend | @sentry/react | Captura errores de componentes, network errors, breadcrumbs de navegacion |
| Alertas | Sentry (email) | Notificacion inmediata al equipo ante errores criticos |

#### Logging

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Backend | nestjs-pino | JSON estructurado. Correlacion por request-id. Niveles: error, warn, info, debug |
| Produccion | Railway logs (stdout) | Pino escribe a stdout, Railway captura automaticamente |
| Desarrollo | pino-pretty | Output legible en consola durante desarrollo local |

#### CI/CD (pipelines independientes por repositorio)

**Pipeline `fitmess-api` (GitHub Actions):**

| Etapa | Descripcion |
|-------|-------------|
| PR check | lint + type-check + test (Vitest + supertest) + build |
| Generate OpenAPI | Exporta `openapi.json` como artefacto del pipeline |
| Deploy (main) | Railway auto-deploy desde rama main |
| Post-deploy | Prisma migrate deploy (migraciones de DB) |

**Pipeline `fitmess-web` (GitHub Actions + Vercel):**

| Etapa | Descripcion |
|-------|-------------|
| PR check | lint + type-check + test (Vitest + Testing Library) + build |
| Preview deploy | Vercel genera preview deploy automatico en cada PR |
| Deploy (main) | Vercel auto-deploy desde rama main |

**Sincronizacion de contrato API:**

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Generacion de spec | @nestjs/swagger (en CI de fitmess-api) | Exporta openapi.json en cada build exitoso |
| Consumo de spec | orval (en fitmess-web) | `pnpm run generate-api` regenera tipos y cliente. Se puede automatizar con GitHub Action que detecte cambios en la spec |
| Deteccion de breaking changes | TypeScript compiler (tsc) | Al regenerar tipos, si hay incompatibilidades el build del frontend falla y se detecta en CI |

---

## 7. Patrones Arquitectonicos

### 7.1 Monolito Modular (Backend)

Cada modulo de NestJS encapsula un bounded context del dominio:

| Modulo | Responsabilidad | Entidades principales | Epicas relacionadas |
|--------|-----------------|----------------------|-------------------|
| `auth` | Registro, login, roles, recuperacion de contrasena, aprobacion de entrenadores | User, PasswordReset, CoachRequest | EPICA-01 |
| `exercises` | Biblioteca global, versionado, inhabilitacion | Exercise, ExerciseVersion | EPICA-02 |
| `plans` | Plantilla base, sesiones, bloques, ciclo de vida | Plan, PlanSession, SessionBlock, BlockExercise | EPICA-03 |
| `subscriptions` | Inscripcion, aprobacion, consentimiento informado | Subscription, LegalAcceptance | EPICA-04 |
| `execution` | Instancias personalizadas, resultados, sensaciones semanales, cierre semanal | AthleteInstance, SessionResult, WeeklySensation, WeekClosure | EPICA-05, EPICA-06 |
| `metrics` | Historial del atleta, progreso por entrenador, datos para dashboards | Vistas/queries sobre execution | EPICA-07 |
| `ai` | Analisis Claude, recomendaciones, historial de decisiones | AIAnalysis, AIRecommendation | EPICA-08 |
| `notifications` | Notificaciones in-app | Notification | Transversal |
| `prisma` | Servicio de base de datos compartido | — | Transversal |
| `common` | Interceptors (audit, logging), guards, decoradores, pipes | — | Transversal |

**Regla de comunicacion:** Los modulos no importan services de otros modulos directamente. La comunicacion entre modulos se hace via eventos internos (@nestjs/event-emitter). Los modulos `prisma` y `common` son transversales.

### 7.2 State Machine Pattern

**Decision:** Se aplica maquina de estados para gestionar el ciclo de vida de planes y suscripciones.

**Ciclo de vida del plan:**

| Estado | Visible para atletas | Acepta inscripciones | Acepta resultados | Editable por entrenador |
|--------|:-------------------:|:--------------------:|:-----------------:|:----------------------:|
| Borrador | No | No | No | Si (plantilla) |
| Publicado | Si | Si | Si | No (duracion inmutable) |
| Finalizado | No | No | Si (pendientes) | No |
| Archivado | No | No | No | No |

Transiciones permitidas:
- Borrador → Publicado (publish)
- Publicado → Borrador (unpublish, solo sin suscriptores)
- Publicado → Finalizado (finalize)
- Finalizado → Archivado (archive)

**Ciclo de vida de la suscripcion:**
- Pendiente → Aprobada → Consentimiento pendiente → Activa
- Pendiente → Rechazada

### 7.3 Immutability / Versionado

**Decision:** Se aplican 3 estrategias de inmutabilidad segun el tipo de dato.

| Estrategia | Aplicada a | Reglas de negocio | Descripcion |
|------------|-----------|-------------------|-------------|
| Append-only (versionado) | Ejercicios | RN-05, RN-07 | Cada edicion de un ejercicio ya usado crea nueva version. Planes conservan FK a la version original. Ejercicios nunca usados se editan directamente |
| Frozen flag | Semanas cerradas | RN-09 | Al cerrar la semana, se marca como frozen. Bloquea toda escritura de resultados y sensaciones |
| Soft-delete | Planes, resultados, suscripciones | RN-06, RN-13 | Nunca se ejecuta DELETE. Se usa archived_at o is_active para controlar visibilidad |

### 7.4 Instance Pattern (Instancias personalizadas)

**Decision:** Cada atleta inscrito recibe una deep copy del plan base como su instancia personalizada.

**Justificacion:** RN-31 establece que cada atleta tiene su propia instancia. Los cambios en una instancia no afectan la plantilla base ni las instancias de otros atletas.

**Reglas de inmutabilidad temporal de la instancia:**
- Semana **no iniciada**: el entrenador puede modificar ejercicios, series, reps, carga, orden (RN-32)
- Semana **iniciada** (atleta registro al menos un resultado): inmutable (RN-33)
- Semana **cerrada** (todas las sesiones completadas): congelada para la IA (RN-09)

### 7.5 Audit Trail Pattern (Ley 1581/2012)

**Decision:** Interceptor global en NestJS que captura automaticamente metadata de cada request mutativo (POST, PUT, PATCH, DELETE).

**Datos capturados por el interceptor:**
- ID del usuario autenticado
- Direccion IP del request
- User-Agent del navegador
- Timestamp de la accion
- Metodo HTTP y URL
- Duracion del request

**Aceptaciones legales como tabla independiente:** Cada aceptacion de habeas data, datos sensibles o consentimiento deportivo se persiste como registro inmutable con: user_id, tipo de documento, version del documento, timestamp, IP y plan_id (cuando aplica).

**Derechos del titular (Ley 1581/2012):**
- **Exportacion de datos:** Endpoint GET /api/users/:id/data-export que genera JSON con todos los datos personales del usuario
- **Revocacion de consentimiento:** Flujo de solicitud que notifica al admin y desactiva acceso sin eliminar datos historicos
- **Rectificacion:** El usuario puede actualizar sus datos personales en cualquier momento

### 7.6 Event-Driven (Interno)

**Decision:** Comunicacion entre modulos via @nestjs/event-emitter (pub/sub in-process). Sin message broker externo para esta escala.

**Justificacion:** Permite que los modulos reaccionen a eventos de otros modulos sin acoplamiento directo. Ejemplos clave:

- `subscription.approved` → Crear instancia del atleta + notificar
- `week.closed` → Habilitar analisis IA + recalcular metricas
- `ai.recommendation.approved` → Aplicar cambio a la instancia del atleta
- `plan.finalized` → Bloquear nuevas inscripciones
- `plan.archived` → Bloquear registro de resultados

### 7.7 Captura de Sensaciones Semanales

**Decision:** El atleta registra datos subjetivos semanales que alimentan el modulo de IA.

**Campos capturados en WeeklySensation:**
- Dolor muscular (escala 1-10)
- Motivacion (escala 1-10)
- Comentarios libres (opcional)
- Fecha de registro
- Atleta ID + Semana de referencia

**Momento de captura:** Al cerrar la semana o como formulario disponible durante la semana activa.

---

## 8. Infraestructura, CI/CD y Costos

### Costo mensual estimado (prueba controlada ~23 usuarios)

| Componente | Servicio | Tier | Costo |
|------------|----------|------|-------|
| Backend API | Railway | Starter ($5 credit) | ~$0-2/mes |
| Frontend SPA | Vercel | Free | $0/mes |
| Base de datos | Supabase PostgreSQL | Free (500 MB) | $0/mes |
| File storage | Supabase Storage | Free (1 GB) | $0/mes |
| Inteligencia artificial | Claude API (Sonnet) | Pay-per-use | ~$1-3/mes |
| Email transaccional | Resend | Free (100/dia) | $0/mes |
| Error tracking | Sentry | Free (5K eventos/mes) | $0/mes |
| CI/CD | GitHub Actions | Free (2,000 min/mes) | $0/mes |
| Dominio | Registrador | .com o .co | ~$1/mes (anualizado) |
| **Total MVP** | | | **~$2-6 USD/mes** |

### Diagrama de infraestructura

```
                         ┌─────────────┐
                         │   Usuario   │
                         │  (Browser)  │
                         └──────┬──────┘
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
  ┌────────────────────────┐     ┌──────────────────────────┐
  │  Vercel (CDN)          │     │  Railway                  │
  │  fitmess-web           │────▶│  fitmess-api              │
  │  React SPA             │     │  NestJS API               │
  │  + Sentry React        │     │  + Sentry Node            │
  │  + orval (tipos gen.)  │     │  + Pino Logger            │
  │                        │     │  + Helmet                 │
  │  repo: fitmess-web     │     │  + @nestjs/swagger → spec │
  └────────────────────────┘     │                          │
                                  │  repo: fitmess-api       │
                                  └───────┬─────────────────┘
                                          │
                        ┌─────────────┬───┴─────┬──────────────┐
                        ▼             ▼         ▼              ▼
                ┌──────────┐  ┌──────────┐ ┌────────┐  ┌──────────┐
                │ Supabase │  │ Supabase │ │ Claude │  │  Resend  │
                │ Postgres │  │ Storage  │ │  API   │  │  (email) │
                └──────────┘  └──────────┘ └────────┘  └──────────┘
```

### Flujo de sincronizacion de contrato

```
fitmess-api (backend)                    fitmess-web (frontend)
─────────────────────                    ──────────────────────
  @nestjs/swagger                          orval.config.ts
       │                                        │
       ▼                                        ▼
  openapi.json ──── (artefacto CI) ────▶  pnpm run generate-api
       │                                        │
       ▼                                        ▼
  Spec publicada                          src/api/
  en CI / staging URL                       ├── types.ts    (generado)
                                            ├── client.ts   (generado)
                                            └── queries.ts  (generado)
```

---

## 9. Estrategia de Escalabilidad

### Fase 0: Prueba Controlada (actual — ~23 usuarios)

| Componente | Configuracion |
|------------|--------------|
| Backend | Monolito modular NestJS en Railway Starter (1 instancia) |
| Frontend | React SPA en Vercel Free (CDN global) |
| Database | Supabase free tier (500 MB). Uso estimado: < 50 MB |
| IA | Claude API sincrono (request-response). ~2-4 analisis/semana |
| Cache | Sin cache externo |
| Monitoreo | Sentry free + Pino logs en Railway |
| Backups | pg_dump manual semanal |
| CI/CD | GitHub Actions (lint + test + build) |

### Fase 1: Lanzamiento (50 — 500 usuarios)

| Componente | Cambio | Costo adicional |
|------------|--------|----------------|
| Database | Evaluar migracion a Supabase Pro si se acerca a 500 MB | +$25/mes |
| Backend | Railway Pro (auto-restart, mejor uptime) | +$20/mes |
| Backups | Automatizar pg_dump via GitHub Actions (diario) | $0 |
| Versionado API | Agregar prefijo /api/v1/ a todas las rutas | $0 |
| Testing E2E | Agregar Playwright para flujos criticos | $0 |

### Fase 2: Crecimiento (500 — 5,000 usuarios)

| Componente | Cambio | Costo adicional |
|------------|--------|----------------|
| Database | Supabase Pro (8 GB, backups automaticos) | incluido en Fase 1 |
| Cache | Agregar Redis via Upstash (free tier) | $0 |
| IA | Migrar a BullMQ + Redis para procesamiento async | Incluido en Upstash |
| Backend | Railway Pro multiples instancias + auto-scale | +$20/mes |
| Busqueda | PostgreSQL full-text search (tsvector) para biblioteca de ejercicios | $0 |

### Fase 3: Escala (> 5,000 usuarios)

| Componente | Cambio |
|------------|--------|
| Infra | Migrar a AWS/GCP con Terraform (IaC) |
| Backend | Extraer modulo AI como microservicio independiente |
| Database | PostgreSQL con read replicas para metricas |
| Mobile | App movil (React Native) consumiendo la misma API |
| CDN | CloudFront/Cloudflare para assets estaticos |
| Observabilidad | Datadog o Grafana + Prometheus |

---

## 10. Registro de Decisiones Arquitectonicas

### ADR-001: Monolito Modular sobre Microservicios

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18 |
| Estado | Aceptada |
| Contexto | Prueba controlada con ~23 usuarios, equipo nuevo, presupuesto minimo |
| Decision | Monolito modular con NestJS. Modulos con fronteras claras preparados para extraccion futura |
| Consecuencias | (+) Deploy simple, desarrollo rapido, bajo costo. (-) Escalamiento vertical inicialmente |

### ADR-002: NestJS sobre Next.js Full-Stack

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18 |
| Estado | Aceptada |
| Contexto | Dominio con 35 reglas de negocio, auditoria legal, versionado, instancias personalizadas |
| Decision | Backend dedicado con NestJS + Frontend SPA con React. Separacion total de concerns |
| Consecuencias | (+) Estructura opinada, DI nativa, interceptors para auditoria, API-first para movil. (-) Mayor setup inicial, dos deploys |

### ADR-003: NestJS sobre FastAPI (Python)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18 |
| Estado | Aceptada |
| Contexto | Se evaluo FastAPI por su ventaja en procesamiento de datos para IA |
| Decision | NestJS (TypeScript) para mantener un solo lenguaje en todo el proyecto |
| Consecuencias | (+) TypeScript end-to-end, tipos compartidos, menor carga cognitiva. (-) Sin ventaja nativa de Python para data science (no requerida en MVP) |

### ADR-004: JWT con revocacion por token_version

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18, actualizado 2026-02-19 |
| Estado | Aceptada |
| Contexto | API REST stateless que debe soportar logout, cambio de contrasena y desactivacion por admin |
| Decision | JWT con access token (15 min) + refresh token (7 dias). Revocacion mediante campo token_version en tabla User: al incrementar, todos los tokens previos se invalidan |
| Consecuencias | (+) Stateless, escalable, revocacion sin Redis. (-) Revocacion es por usuario completo (no por sesion individual). Suficiente para MVP |

### ADR-005: Prisma sobre TypeORM

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18, actualizado 2026-02-19 |
| Estado | Aceptada |
| Contexto | ORM para PostgreSQL con modelo de dominio complejo |
| Decision | Prisma 7 por su schema declarativo, migraciones automaticas y type-safety superior |
| Consecuencias | (+) Schema como documentacion viva, queries type-safe, migraciones declarativas. (-) Menos flexible para queries muy complejas (usar $queryRaw como escape) |

### ADR-006: Claude API (Anthropic) como proveedor de IA

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18 |
| Estado | Aceptada |
| Contexto | IA para analisis de datos de entrenamiento y generacion de recomendaciones concretas |
| Decision | Claude API con modelo Sonnet via @anthropic-ai/sdk |
| Consecuencias | (+) Excelente para analisis estructurado, SDK TypeScript nativo, costo eficiente. (-) Dependencia de un solo proveedor |

### ADR-007: Supabase sobre AWS RDS

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-18 |
| Estado | Aceptada |
| Contexto | Presupuesto minimo viable, necesidad de PostgreSQL + File Storage |
| Decision | Supabase free tier para DB + Storage. Estimacion de uso: < 50 MB para prueba controlada |
| Consecuencias | (+) $0/mes, PostgreSQL completo, Storage con CDN incluido. (-) Limite de 500 MB; migrar a Pro al acercarse al 70% |

### ADR-008: Repositorios independientes sobre Monorepo *(actualizado en v2.1)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada (reemplaza decision anterior de pnpm workspaces) |
| Contexto | Backend (NestJS) y frontend (React) tienen ciclos de vida, deploy y testing independientes. Un monorepo acopla pipelines y dificulta el escalado de equipos |
| Decision | Dos repositorios Git separados: `fitmess-api` y `fitmess-web`. Contrato API compartido via OpenAPI spec generada por @nestjs/swagger + codegen con orval en el frontend |
| Consecuencias | (+) Deploys independientes, CI mas rapido, testing aislado, equipos desacoplados, escalable. (-) Sincronizacion de contrato requiere disciplina (mitigado con codegen automatico y type-check en CI) |

### ADR-009: ky sobre Axios como HTTP client *(nuevo en v2.0)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada |
| Contexto | HTTP client para el frontend SPA. Node.js 22 y browsers modernos soportan fetch nativo |
| Decision | ky como wrapper minimalista sobre fetch. Interceptors, retry y manejo de errores sin dependencias pesadas |
| Consecuencias | (+) Bundle mas pequeno (~3KB vs ~13KB de Axios), basado en estandares web. (-) API diferente a Axios si el equipo ya conoce Axios |

### ADR-010: Vitest sobre Jest *(nuevo en v2.0)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada |
| Contexto | Framework de testing para backend y frontend |
| Decision | Vitest como runner en ambos repositorios. Compatible con la API de Jest pero nativo con ESM |
| Consecuencias | (+) Misma herramienta en ambos repos, rapido para ESM, excelente DX. (-) Menos plugins legacy que Jest |

### ADR-011: Sentry desde Fase 0 *(nuevo en v2.0)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada |
| Contexto | La prueba controlada maneja datos sensibles bajo Ley 1581/2012. Los errores deben detectarse proactivamente |
| Decision | Integrar @sentry/nestjs + @sentry/react desde el inicio. Free tier: 5K eventos/mes |
| Consecuencias | (+) Deteccion temprana de errores, trazas de requests, alertas. (-) Minima complejidad adicional en setup |

### ADR-012: Recharts para dashboards *(nuevo en v2.0)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada |
| Contexto | El proyecto requiere dashboards con metricas de progreso para atletas y entrenadores |
| Decision | Recharts 3.x. Componentes React declarativos basados en D3. Graficos de linea, barras y radar para metricas |
| Consecuencias | (+) API declarativa, buen rendimiento, amplia comunidad. (-) Menos personalizable que D3 puro |

### ADR-013: orval para codegen de API client *(nuevo en v2.1)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada |
| Contexto | Con repos separados, se necesita una estrategia para mantener tipos sincronizados entre backend y frontend sin paquete compartido |
| Decision | orval genera tipos TypeScript, cliente HTTP (adaptado a ky) y hooks de TanStack Query desde la OpenAPI spec que produce @nestjs/swagger |
| Consecuencias | (+) Tipos siempre sincronizados, zero-effort client generation, breaking changes detectados en compilacion. (-) Dependencia en la calidad de los decoradores Swagger del backend |

### ADR-014: Endpoint de constantes de dominio *(nuevo en v2.1)*

| Campo | Valor |
|-------|-------|
| Fecha | 2026-02-19 |
| Estado | Aceptada |
| Contexto | Sin paquete compartido, las constantes de negocio (ventana de edicion, escalas, tipos de sesion) necesitan ser accesibles por el frontend |
| Decision | Endpoint GET /api/config/constants expone las constantes del dominio. Frontend las consume via TanStack Query con staleTime: Infinity (cache permanente hasta refresh) |
| Consecuencias | (+) Unica fuente de verdad en el backend, frontend siempre actualizado. (-) Un request adicional al cargar la app (mitigado con cache permanente) |

---

## 11. Inconsistencias Pendientes de Resolver

Las siguientes inconsistencias fueron detectadas entre `proyecto-app.txt` y este stack. Deben resolverse con el product owner antes de iniciar desarrollo:

### INC-01: Permisos de creacion de ejercicios para Admin

| Fuente | Valor |
|--------|-------|
| Tabla de roles (proyecto-app.txt, linea 21) | Admin: **NO** puede crear ejercicios |
| Seccion Biblioteca (proyecto-app.txt, linea 63) | "Admin **y** Entrenador pueden crear ejercicios" |
| **Impacto** | Afecta la configuracion RBAC del modulo `exercises` |
| **Recomendacion** | Definir una unica fuente de verdad. Si el Admin es solo gestor del sistema, no deberia crear ejercicios |

### INC-02: "Fases" vs "Bloques" en la estructura de planes

| Fuente | Valor |
|--------|-------|
| proyecto-app.txt | Habla de "sesiones" y "bloques" (linea 56: "Una sesion puede tener varios bloques") |
| stack-tecnologico v1.0 | Mencionaba "Phase" como entidad en el modulo plans |
| **Resolucion aplicada** | Se alinea con el proyecto: Plan > Sesion > Bloque. Se elimina el concepto de "Phase" |
| **Estado** | Resuelto en v2.0 |

### INC-03: Captura de datos subjetivos para IA (dolor muscular, motivacion)

| Fuente | Valor |
|--------|-------|
| proyecto-app.txt (lineas 123-124) | Lista "dolor muscular" y "motivacion" como inputs de la IA |
| proyecto-app.txt (registro de resultados) | No menciona donde ni cuando se capturan estos datos |
| **Resolucion aplicada** | Se agrega patron WeeklySensation (seccion 7.7) con formulario semanal para el atleta |
| **Estado** | Propuesto en v2.0. Pendiente confirmacion del product owner |

---

## 12. Changelog

### v2.1 (respecto a v2.0)

| Cambio | Seccion | Tipo |
|--------|---------|------|
| Monorepo → Repositorios independientes (fitmess-api + fitmess-web) | 1, 5, 6.3 | Reescritura |
| Agregado orval para codegen de API client desde OpenAPI spec | 6.2, 6.3 | Adicion |
| Agregado endpoint GET /api/config/constants para constantes de dominio | 6.3, 6.6 | Adicion |
| CI/CD reescrito con pipelines independientes por repositorio | 6.8 | Reescritura |
| ADR-008 reescrito: repos separados sobre monorepo | 10 | Reescritura |
| ADR-010 actualizado: contexto sin referencia a monorepo | 10 | Actualizacion |
| Agregados ADR-013 (orval) y ADR-014 (endpoint constantes) | 10 | Adicion |

### v2.0 (respecto a v1.0)

| Cambio | Seccion | Tipo |
|--------|---------|------|
| Ajuste de escala a prueba controlada (~23 usuarios) | 1, 2 | Contexto |
| Prisma 6 → Prisma 7 (ultima version estable) | 6.1, 6.4 | Actualizacion |
| Axios → ky (wrapper ligero sobre fetch nativo) | 6.2 | Reemplazo |
| Jest → Vitest (runner unico backend + frontend) | 6.1, 6.2 | Reemplazo |
| Agregado Recharts 3.x para dashboards | 6.2 | Adicion |
| Agregado @testing-library/react para tests de componentes | 6.2 | Adicion |
| Agregado nestjs-pino para logging estructurado | 6.1 | Adicion |
| Agregado @nestjs/throttler para rate limiting | 6.1 | Adicion |
| Agregado helmet para headers de seguridad HTTP | 6.1 | Adicion |
| Agregado @nestjs/terminus para health checks | 6.1 | Adicion |
| Agregado CORS como configuracion explicita | 6.1 | Adicion |
| Agregado Resend para email transaccional (password recovery) | 6.1, 6.5 | Adicion |
| Agregado Sentry (backend + frontend) desde Fase 0 | 6.1, 6.2, 6.8 | Adicion |
| Agregado GitHub Actions para CI/CD | 6.8 | Adicion |
| Definido pnpm workspaces como herramienta de monorepo | 6.3 | Decision |
| Definido React Router 7 en modo SPA-only | 6.2 | Clarificacion |
| Agregada revocacion de JWT via token_version | 6.5 | Adicion |
| Agregado flujo de recuperacion de contrasena | 6.5 | Adicion |
| Agregada estimacion de uso de almacenamiento en Supabase | 6.4 | Adicion |
| Agregada estrategia de paginacion (cursor-based) | 6.4 | Adicion |
| Agregada estrategia de backups para MVP | 6.4 | Adicion |
| Agregados derechos del titular (Ley 1581) | 7.5 | Adicion |
| Agregado patron WeeklySensation para inputs de IA | 7.7 | Adicion |
| Agregado diagrama de infraestructura | 8 | Adicion |
| Reescrita estrategia de escalabilidad con Fase 0 | 9 | Reescritura |
| Resuelto Phase → Block en modelo de datos | 7.1, INC-02 | Correccion |
| Agregados ADR-008 a ADR-012 | 10 | Adicion |
| Agregada seccion de inconsistencias pendientes | 11 | Adicion |
| Agregado changelog | 12 | Adicion |
| Costo estimado ajustado: $6-21 → $2-6 USD/mes | 1, 8 | Ajuste |

---

*Documento de referencia tecnica para el equipo de desarrollo de App Fitmess.*
*Cualquier cambio en el stack o en las decisiones arquitectonicas debe documentarse en este archivo con fecha y justificacion.*
*Ultima actualizacion: 2026-02-19*
