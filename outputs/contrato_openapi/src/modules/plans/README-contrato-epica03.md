# Contrato OpenAPI — EPICA-03: Creacion y Publicacion de Planes de Entrenamiento

Generado por el Documentador el 2026-08-20.
Fuente de verdad: `outputs/plan_de_implementacion.yaml` + `outputs/reporte_validacion_negocio.yaml`.

Modulo nuevo — `plans` no existe todavia en `src/modules/`. El contrato vive en
`outputs/contrato_openapi/src/modules/plans/` espejando la ubicacion final
`src/modules/plans/` (sin feature folders — dos controllers, un solo service).

---

## Resumen de endpoints (17)

### PlansController (`/plans`) — rol COACH exclusivamente (RN-18, D-12, sin ADMIN)

| # | Metodo | Ruta | HU | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|-------------|----------------|------|
| 1 | POST | `/plans` | HU-008 | CreatePlanDto | PlanResponseDto | 201 |
| 2 | GET | `/plans` | HU-008 | — (query page/limit) | PlanResponseDto[] + meta | 200 |
| 3 | GET | `/plans/:id` | HU-008 | — | PlanDetailResponseDto | 200 |
| 4 | PATCH | `/plans/:id` | HU-008 | UpdatePlanDto | PlanResponseDto | 200 |
| 5 | POST | `/plans/:id/phases` | HU-008 | AddPhaseDto | PhaseResponseDto | 201 |
| 6 | DELETE | `/plans/:id/phases/:phaseId` | HU-008 | — | `{ data: null, message }` | 200 |
| 7 | POST | `/plans/:id/phases/:phaseId/weeks` | HU-008 | — (ninguno) | WeekResponseDto | 201 |
| 8 | DELETE | `/plans/:id/weeks/:weekId` | HU-008 | — | `{ data: null, message }` | 200 |
| 9 | POST | `/plans/:id/weeks/:weekId/sessions` | HU-008 | AddSessionDto | SessionResponseDto | 201 |
| 10 | DELETE | `/plans/:id/sessions/:sessionId` | HU-008 | — | `{ data: null, message }` | 200 |
| 11 | POST | `/plans/:id/sessions/:sessionId/exercises` | HU-008 (CA-008-3) | AddSessionExerciseDto | SessionExerciseResponseDto | 201 |
| 12 | DELETE | `/plans/:id/sessions/:sessionId/exercises/:sessionExerciseId` | HU-008 | — | `{ data: null, message }` | 200 |
| 13 | POST | `/plans/:id/publish` | HU-009 | — | PlanResponseDto | 200 |
| 14 | POST | `/plans/:id/unpublish` | HU-009 | — | PlanResponseDto | 200 |
| 15 | POST | `/plans/:id/archive` | HU-010 | — | PlanResponseDto | 200 |

### PlansCatalogController (`/catalog/plans`) — cualquier usuario autenticado (D-10)

| # | Metodo | Ruta | HU | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|-------------|----------------|------|
| 16 | GET | `/catalog/plans` | HU-011 | — (query page/limit) | PlanCatalogSummaryResponseDto[] + meta | 200 |
| 17 | GET | `/catalog/plans/:id` | HU-011 | — | PlanCatalogDetailResponseDto | 200 |

---

## Estructura de archivos generados

```
outputs/contrato_openapi/src/modules/plans/
  plans.controller.ts                            <- 15 endpoints del entrenador (stubs)
  plans-catalog.controller.ts                    <- 2 endpoints del catalogo (stubs)
  dto/
    create-plan.dto.ts                           <- HU-008: entrada de creacion del shell
    update-plan.dto.ts                           <- HU-008: entrada de edicion (PATCH)
    add-phase.dto.ts                              <- HU-008: entrada de agregar fase
    add-session.dto.ts                            <- HU-008: entrada de agregar sesion
    add-session-exercise.dto.ts                   <- HU-008 (CA-008-3): entrada de agregar ejercicio
    plan-response.dto.ts                          <- respuesta plana (create/list/patch/publish/unpublish/archive)
    plan-detail-response.dto.ts                   <- HU-008: GET /plans/:id, arbol completo (D-8)
    phase-response.dto.ts                         <- respuesta plana de POST .../phases
    phase-detail-response.dto.ts                  <- fase embebida en el arbol (con weeks)
    week-response.dto.ts                          <- respuesta plana de POST .../weeks
    week-detail-response.dto.ts                   <- semana embebida en el arbol (con sessions)
    session-response.dto.ts                       <- respuesta plana de POST .../sessions
    session-detail-response.dto.ts                <- sesion embebida en el arbol (con exercises)
    session-exercise-response.dto.ts              <- reutilizado: respuesta plana Y embebida en el arbol
    coach-summary-response.dto.ts                 <- HU-011: perfil reducido (id/name/avatarUrl) del listado
    coach-profile-response.dto.ts                 <- HU-011: perfil completo (+description/bannerUrl) del detalle
    plan-catalog-summary-response.dto.ts          <- HU-011: item del listado del catalogo
    plan-catalog-detail-response.dto.ts           <- HU-011: detalle del catalogo
    plan-catalog-phase-response.dto.ts            <- fase del catalogo (solo estructura, sin ids de mutacion)
    plan-catalog-week-response.dto.ts             <- semana del catalogo
    plan-catalog-session-response.dto.ts          <- sesion del catalogo (exerciseCount, no detalle de ejercicios)
  README-contrato-epica03.md                      <- Este archivo
```

## Ubicacion definitiva en el proyecto

Cuando el Desarrollador implemente el modulo, los archivos se copian a
`src/modules/plans/` (misma estructura):

```
src/modules/plans/
  plans.controller.ts
  plans-catalog.controller.ts
  plans.service.ts               <- Implementar (no generado aqui)
  plans.module.ts                <- Implementar (no generado aqui)
  dto/                            <- (20 archivos, ver arriba)
```

Ademas, el plan de implementacion requiere un guard nuevo compartido:

```
src/modules/common/guards/plan-published.guard.ts   <- Implementar (no generado aqui)
```

El service debe exponer exactamente estas firmas (usadas por ambos controllers):

```typescript
create(coachId: string, dto: CreatePlanDto): Promise<PlanResponseDto>
findAll(coachId: string, page?: number, limit?: number): Promise<{ data: PlanResponseDto[]; meta: PaginationMeta }>
findOne(coachId: string, id: string): Promise<PlanDetailResponseDto>
update(coachId: string, id: string, dto: UpdatePlanDto): Promise<PlanResponseDto>
addPhase(coachId: string, id: string, dto: AddPhaseDto): Promise<PhaseResponseDto>
removePhase(coachId: string, id: string, phaseId: string): Promise<{ data: null; message: string }>
addWeek(coachId: string, id: string, phaseId: string): Promise<WeekResponseDto>
removeWeek(coachId: string, id: string, weekId: string): Promise<{ data: null; message: string }>
addSession(coachId: string, id: string, weekId: string, dto: AddSessionDto): Promise<SessionResponseDto>
removeSession(coachId: string, id: string, sessionId: string): Promise<{ data: null; message: string }>
addSessionExercise(coachId: string, id: string, sessionId: string, dto: AddSessionExerciseDto): Promise<SessionExerciseResponseDto>
removeSessionExercise(coachId: string, id: string, sessionId: string, sessionExerciseId: string): Promise<{ data: null; message: string }>
publish(coachId: string, id: string): Promise<PlanResponseDto>
unpublish(coachId: string, id: string): Promise<PlanResponseDto>
archive(coachId: string, id: string): Promise<PlanResponseDto>
findPublished(page?: number, limit?: number): Promise<{ data: PlanCatalogSummaryResponseDto[]; meta: PaginationMeta }>
findPublishedOne(id: string): Promise<PlanCatalogDetailResponseDto>
```

---

## Seguridad y acceso por endpoint

- `PlansController`: `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.COACH)` a nivel de
  controller (D-12 — sin ADMIN, a diferencia de `ExercisesController`). Las 10 rutas de
  estructura (phases/weeks/sessions/exercises, agregar y quitar) ademas llevan
  `PlanPublishedGuard` a nivel de metodo — rechaza si el plan no esta en Borrador (RN-31).
  Las rutas de shell (create/list/detail/patch) y de transicion de estado
  (publish/unpublish/archive) NO llevan `PlanPublishedGuard`: la transicion misma es el
  objeto de la verificacion, aplicarlo ahi seria circular.
- `PlansCatalogController`: solo `JwtAuthGuard` — cualquier usuario autenticado, sin
  restriccion de rol (D-10, ninguna CA de HU-011 pide restringirlo).

---

## Errores por endpoint

| Endpoint | 400 | 401 | 403 | 404 | 409 | 422 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| POST /plans | Si | Si | Si | — | — | — |
| GET /plans | — | Si | Si | — | — | — |
| GET /plans/:id | — | Si | Si | Si | — | — |
| PATCH /plans/:id | Si | Si | Si | Si | Si | — |
| POST /plans/:id/phases | Si | Si | Si | Si | Si | — |
| DELETE /plans/:id/phases/:phaseId | — | Si | Si | Si | Si | — |
| POST /plans/:id/phases/:phaseId/weeks | — | Si | Si | Si | Si | — |
| DELETE /plans/:id/weeks/:weekId | — | Si | Si | Si | Si | — |
| POST /plans/:id/weeks/:weekId/sessions | Si | Si | Si | Si | Si | — |
| DELETE /plans/:id/sessions/:sessionId | — | Si | Si | Si | Si | — |
| POST /plans/:id/sessions/:sessionId/exercises | Si | Si | Si | Si | Si | Si |
| DELETE .../sessions/:sessionId/exercises/:sessionExerciseId | — | Si | Si | Si | Si | — |
| POST /plans/:id/publish | — | Si | Si | Si | Si | Si |
| POST /plans/:id/unpublish | — | Si | Si | Si | Si | — |
| POST /plans/:id/archive | — | Si | Si | Si | Si | — |
| GET /catalog/plans | — | Si | — | — | — | — |
| GET /catalog/plans/:id | — | Si | — | Si | — | — |

Todos los errores usan `Content-Type: application/problem+json` (RFC 9457).
409 en rutas de estructura = `PLAN_IMMUTABLE`/estado no-Borrador (via `PlanPublishedGuard`).
409 en publish/unpublish/archive = `INVALID_STATE_TRANSITION` o `PLAN_HAS_SUBSCRIBERS` (unpublish).
422 en publish = `PLAN_INCOMPLETE`. 422 en agregar ejercicio = `EXERCISE_INACTIVE`.
403 en rutas del entrenador = `RESOURCE_OWNERSHIP_DENIED` (ownership) o rechazo de rol.
404 en `GET /catalog/plans/:id` cubre tanto "no existe" como "no esta publicado y vigente" —
mismo mensaje en ambos casos (el atleta no debe poder distinguirlos).

`GET /plans` y `GET /catalog/plans` NO documentan 400: el plan de implementacion no lista ese
error para ninguno de los dos (a diferencia de `GET /exercises` en EPICA-02), asi que los query
params `page`/`limit` se reciben sin un DTO de validacion dedicado.

---

## Campos excluidos de DTOs de respuesta (Ley 1581/2012, rulesArquitectura §API)

- `archivedAt` en `Plan` — el estado `ARCHIVED` ya es uno de los cuatro valores de `PlanStatus`
  (RN-27, decision D-7b). Ningun DTO de esta epica agrega un campo adicional para lo mismo.
- `email`, `phone`, `phoneCountryCode`, `identificationType`, `identificationNumber`,
  `dateOfBirth`, `passwordHash` del entrenador — EXCLUIDOS de `CoachSummaryResponseDto` y
  `CoachProfileResponseDto` por decision confirmada del humano (2026-08-20) y Ley 1581/2012.
- `exerciseVersionId` (FK interna de `SessionExercise`) — se expone `exerciseId` +
  `versionNumber` en su lugar (mismo criterio que `ExerciseResponseDto` de EPICA-02, que no
  expone un puntero crudo a version).
- `phaseId`/`weekId`/`sessionId` en las respuestas ESTANDALONE de creacion (`PhaseResponseDto`,
  `WeekResponseDto`, `SessionResponseDto`) — el cliente ya los conoce por la URL con la que hizo
  la peticion; no son necesarios y evitan redundancia.
- Detalle de cada ejercicio en la estructura del catalogo — `PlanCatalogSessionResponseDto`
  expone solo `exerciseCount` (CA-011-2 no pide el detalle, solo la cantidad).
- passwords, tokens, refresh tokens — no aplica a esta epica (contenido de planes de
  entrenamiento, no autenticacion).

---

## Advertencia legal activa sobre este contrato (no bloquea el codigo, si la produccion)

`CoachProfileResponseDto.description` y `.bannerUrl` (mapeados de
`CoachRequest.planDescription`/`bannerUrl`) tienen una condicion legal bloqueante para
PRODUCCION segun `reporte_validacion_negocio.yaml` (HU-011, Ley 1581/2012 — cambio de finalidad
no informado al entrenador). El campo esta documentado en el DTO con la advertencia completa.
No bloquea que el Desarrollador implemente el endpoint ni que el QA lo pruebe — bloquea
exponer el catalogo en produccion sin que el humano resuelva la condicion (ver el reporte para
el detalle de las dos acciones requeridas).

---

## Notas de diseno relevantes para el Desarrollador

- Jerarquia: `Plan -> Fase -> Semana -> Sesion -> SessionExercise` (decision confirmada
  2026-08-20). NO seguir los ejemplos de `design-patterns/references/behavior-patterns.md` ni
  `nestjs-conventions/references/module-patterns.md` §6 — estan desactualizados (riesgo
  declarado explicitamente en el plan de implementacion, seccion `riesgos_identificados`).
- `order` de `Phase`/`Session` y `weekNumber` de `Week` se calculan SIEMPRE server-side (D-4,
  D-5) — ningun DTO de entrada de esta epica recibe un valor de orden del cliente. Se extiende
  el mismo criterio a `order` de `SessionExercise` por consistencia (ninguna CA pide reordenar).
- `weekNumber` es secuencial a lo largo de TODO el plan, no reinicia por fase (D-4) — EPICA-05
  lo necesita unico y comparable entre fases.
- Hard-delete real (no soft-delete) para Phase/Week/Session/SessionExercise — solo procede en
  Borrador, protegido por `PlanPublishedGuard` (D-7).
- `status` en `PlanResponseDto`/`PlanDetailResponseDto` es el valor EFECTIVO, no necesariamente
  el persistido — evaluacion perezosa (D-1): si persistido es `PUBLISHED` y `endDate < now()`,
  el service retorna `FINALIZED` sin que el cliente lo calcule.
- `AddSessionExerciseDto` rechaza con `ENTITY_NOT_FOUND` (404) un `exerciseId` inexistente
  (RN-04) y con `EXERCISE_INACTIVE` (422) uno inhabilitado — mismo precedente que CA-006-6 de
  EPICA-02, resuelto en el plan como condicion previamente bloqueante del Analista de Producto.
- `hasSubscribers(planId)` (usado en `unpublish`) es un stub que hoy siempre retorna `false` —
  mismo patron que `isUsedInPlan` de EPICA-02. Gap e2e declarado y aceptado para CA-009-7.
- `isUsedInPlan(exerciseId)` en `exercises.service.ts` se conecta con una query real contra
  `SessionExercise` al implementar `addSessionExercise()` (D-2) — `exercises` NUNCA importa
  `PlansModule` ni ningun service de `plans`; ambos leen Prisma directamente.
- `plans` lee `User`/`CoachRequest` directamente via `PrismaService` para el perfil publico del
  entrenador (D-2b) — NUNCA importa `AuthModule` ni `AuthService`.
- `data: { nullable: true, example: null }` en los 6 endpoints DELETE — NUNCA `type: 'null'`
  (OpenAPI 3.1/JSON Schema 2020-12, incompatible con `DocumentBuilder` que genera 3.0). Mismo
  bug que se colo en el contrato de EPICA-02 (ya corregido en el codigo real, no en el contrato
  historico de esa epica, que queda intacto por regla de no tocar contrato ajeno).

---

## Checklist de consistencia plan-contrato

- [x] Los 17 endpoints del plan tienen su metodo (15 en `PlansController`, 2 en
  `PlansCatalogController`)
- [x] Todos los errores del plan tienen su `@ApiProblemResponse` — verificado endpoint por
  endpoint contra la lista `errores:` de cada entrada de `plan_de_implementacion.yaml` (tabla
  arriba). Se corrigio un error propio del primer borrador: `GET /plans` habia quedado con un
  400 no pedido por el plan (el plan solo lista `[401, 403]`) — eliminado antes de cerrar.
- [x] Todos los DTOs referenciados explicitamente por el plan tienen su archivo:
  `CreatePlanDto`, `UpdatePlanDto`, `AddPhaseDto`, `AddSessionDto`, `AddSessionExerciseDto`,
  `PlanResponseDto`, `PlanDetailResponseDto`, `PhaseResponseDto`, `WeekResponseDto`,
  `SessionResponseDto`, `SessionExerciseResponseDto`, `PlanCatalogSummaryResponseDto`,
  `PlanCatalogDetailResponseDto` — mas 8 DTOs de soporte no nombrados por el plan pero
  requeridos por su propia asimetria lectura-agregada/escritura-granular (D-8):
  `PhaseDetailResponseDto`, `WeekDetailResponseDto`, `SessionDetailResponseDto`,
  `CoachSummaryResponseDto`, `CoachProfileResponseDto`, `PlanCatalogPhaseResponseDto`,
  `PlanCatalogWeekResponseDto`, `PlanCatalogSessionResponseDto`
- [x] Ningun DTO de respuesta expone `archivedAt`, passwords, tokens, ni los campos personales
  del entrenador excluidos por Ley 1581/2012 (ver seccion "Campos excluidos" arriba)
- [x] Guards del plan aplicados: `JwtAuthGuard` + `RolesGuard(COACH)` a nivel de
  `PlansController`; `PlanPublishedGuard` a nivel de metodo en las 10 rutas de estructura;
  solo `JwtAuthGuard` en `PlansCatalogController`
- [x] Imports de Prisma (`UserRole`, `PlanStatus`) desde `generated/prisma` con ruta relativa
  correcta: `../../../generated/prisma/index.js` (controllers), `../../../../generated/prisma/index.js` (dto/)
- [x] Ningun enum local que duplique Prisma — `PlanStatus` se importa, no se redeclara
- [x] `AddSessionExerciseDto` + `POST .../exercises` documentan ENTITY_NOT_FOUND (404) y
  EXERCISE_INACTIVE (422) — las dos condiciones antes bloqueantes del Analista de Producto para
  HU-008, ya resueltas en el plan del Arquitecto
- [x] Perfil publico del entrenador: exactamente `id`, `name`, `avatarUrl` (User) +
  `description`, `bannerUrl` (CoachRequest, opcionales/nullable) en el detalle;
  `id`, `name`, `avatarUrl` (reducido) en el listado. Ningun campo adicional.
- [x] `data: { nullable: true, example: null }` en los 6 DELETE — nunca `type: 'null'`
- [x] No se toco ningun archivo de contrato de otra epica (`auth/**`, `exercises/**` intactos)
- [x] `npx tsc --noEmit` de los stubs generados compila sin errores, verificado en un harness
  aislado que enlaza `src/modules/common`, `src/modules/prisma` y `generated/prisma` reales mas
  un `PlansService` y un `PlanPublishedGuard` stub temporales (no incluidos en el output final —
  el Desarrollador los implementa)

## Discrepancias encontradas con el plan del Arquitecto

Ninguna. El plan y el reporte de validacion de negocio llegaron consistentes entre si: las dos
condiciones de completitud que el Analista de Producto marco como bloqueantes para el
Documentador sobre HU-008 (ENTITY_NOT_FOUND para `exerciseId` inexistente, EXISTS_INACTIVE para
ejercicio inhabilitado) ya estaban resueltas en `plan_de_implementacion.yaml` antes de que este
Documentador empezara a trabajar. La unica condicion abierta del reporte de negocio (Ley
1581/2012 sobre `planDescription`/`bannerUrl`) es de naturaleza legal/de producto, no tecnica —
se documento en el DTO correspondiente con la advertencia completa, sin bloquear la generacion
del contrato, tal como el propio reporte indica que corresponde.
