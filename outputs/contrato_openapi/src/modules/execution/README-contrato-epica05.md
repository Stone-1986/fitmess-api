# Contrato OpenAPI — EPICA-05: Ejecucion del Plan — Instancia Personalizada

Generado por el Documentador el 2026-08-21.
Fuente de verdad: `outputs/plan_de_implementacion.yaml` (v1.4) + `outputs/reporte_validacion_negocio.yaml` + `outputs/epica_input.yaml`.

Esta epica toca TRES modulos. El contrato se genero en tres ubicaciones distintas,
espejando `src/`:

```
outputs/contrato_openapi/src/modules/execution/       <- modulo NUEVO (este README)
outputs/contrato_openapi/src/modules/plans/            <- EPICA-03 REABIERTA (D-15)
outputs/contrato_openapi/src/modules/subscriptions/    <- EPICA-04 REABIERTA (D-14)
```

---

## Resumen de endpoints (9: 5 nuevos + 2 modificados + 1 nuevo en `plans` + 1 modificado en `subscriptions`)

### InstancesController (`/instances`) — modulo nuevo, roles MIXTOS por endpoint (D-1 de EPICA-04)

| # | Metodo | Ruta | HU | Rol | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|----|-------------|----------------|------|
| 1 | GET | `/instances` | HU-023 | ATHLETE | — (query page/limit) | InstanceSummaryResponseDto[] + meta | 200 |
| 2 | GET | `/instances/:planId` | HU-023 | ATHLETE | — | InstanceDetailResponseDto | 200 |
| 3 | GET | `/instances/:planId/athletes/:athleteId` | HU-017 (+HU-016) | COACH | — | InstanceDetailResponseDto | 200 |
| 4 | POST | `/instances/:planId/sessions/:sessionId/results` | HU-015 | ATHLETE | RegisterSessionResultDto | SessionResultResponseDto | 200 |
| 5 | POST | `/instances/:planId/weeks/:weekId/feelings` | HU-016 | ATHLETE | RegisterWeeklyFeelingDto | WeeklyFeelingResponseDto | 200 |

### PlansController (`/plans`) — EPICA-03 REABIERTA (D-15) — solo lo que cambia

| # | Metodo | Ruta | HU | DTO entrada | DTO respuesta | HTTP | Cambio |
|---|--------|------|----|-------------|----------------|------|--------|
| 6 | POST | `/plans/:id/sessions/:sessionId/exercises` | HU-023 | AddSessionExerciseDto (extendido) | SessionExerciseResponseDto (extendido) | 201 | ADITIVO: 5 campos de prescripcion opcionales |
| 7 | PATCH | `/plans/:id/sessions/:sessionId/exercises/:sessionExerciseId` | HU-023 | UpdateSessionExercisePrescriptionDto (nuevo) | SessionExerciseResponseDto (extendido) | 200 | NUEVO endpoint |
| 8 | POST | `/plans/:id/publish` | HU-023 | — | PlanResponseDto | 200 | PLAN_INCOMPLETE (422) ahora tambien cubre prescripcion no significativa |

Los otros 14 endpoints de `PlansController` (shell, fases, semanas, sesiones, remove-exercise,
unpublish, archive) NO cambian — no se tocaron sus decoradores ni su logica documentada.

### SubscriptionsController (`/subscriptions`) — EPICA-04 REABIERTA (D-14 rama a) — solo lo que cambia

| # | Metodo | Ruta | HU | DTO entrada | DTO respuesta | HTTP | Cambio |
|---|--------|------|----|-------------|----------------|------|--------|
| 9 | POST | `/subscriptions/:id/accept-consent` | HU-014 (+HU-016 CA-016-8) | AcceptConsentDto (CAMBIO DE RUPTURA) | SubscriptionResponseDto | 200 | `documentVersion` -> `sportConsentDocumentVersion` + nuevo `healthDataConsentDocumentVersion`, ambos obligatorios |

Los otros 5 endpoints de `SubscriptionsController` (create, findMine, findPending, approve,
reject) NO cambian.

---

## Estructura de archivos generados

```
outputs/contrato_openapi/src/modules/execution/
  instances.controller.ts                        <- 5 endpoints (stubs)
  dto/
    instance-summary-response.dto.ts              <- HU-023: GET /instances, item de listado
    instance-detail-response.dto.ts                <- HU-023/HU-017: arbol completo (D-2), raiz
    instance-phase-response.dto.ts                 <- fase embebida
    instance-week-response.dto.ts                  <- semana embebida (isClosed/closedAt/feeling)
    instance-session-response.dto.ts               <- sesion embebida (result)
    instance-session-exercise-response.dto.ts      <- ejercicio embebido (version congelada + prescripcion)
    session-result-response.dto.ts                 <- HU-015: agregado padre (D-6)
    session-exercise-result-response.dto.ts        <- HU-015: hijo tipado por ejercicio (D-6)
    weekly-feeling-response.dto.ts                 <- HU-016: sensaciones (dato sensible de salud)
    register-session-result.dto.ts                 <- HU-015: entrada de POST .../results
    session-exercise-result-item.dto.ts             <- item del array de RegisterSessionResultDto
    register-weekly-feeling.dto.ts                  <- HU-016: entrada de POST .../feelings
  README-contrato-epica05.md                       <- Este archivo

outputs/contrato_openapi/src/modules/plans/
  plans.controller.ts                             <- MODIFICADO: +PATCH nuevo, publish() re-documentado
  dto/
    add-session-exercise.dto.ts                    <- MODIFICADO: +5 campos de prescripcion opcionales
    session-exercise-response.dto.ts               <- MODIFICADO: +5 campos de prescripcion nullable
    update-session-exercise-prescription.dto.ts    <- NUEVO: entrada del PATCH

outputs/contrato_openapi/src/modules/subscriptions/
  subscriptions.controller.ts                     <- MODIFICADO: acceptConsent() re-documentado
  dto/
    accept-consent.dto.ts                          <- MODIFICADO: documentVersion renombrado + campo nuevo
```

## Ubicacion definitiva en el proyecto

`execution` es modulo nuevo — al implementar se copia a `src/modules/execution/` (sin feature
folders, mismo criterio que `plans`/`subscriptions`):

```
src/modules/execution/
  instances.controller.ts
  instances.service.ts           <- Implementar (no generado aqui)
  instances.module.ts            <- Implementar (no generado aqui)
  listeners/
    subscription-activated.listener.ts  <- Implementar (no generado aqui — sin endpoint propio)
  dto/                            <- (12 archivos, ver arriba)
```

`plans/dto/add-session-exercise.dto.ts`, `plans/dto/session-exercise-response.dto.ts` y
`plans/plans.controller.ts` REEMPLAZAN a los archivos ya existentes en `src/modules/plans/` (son
el mismo endpoint modificado de forma aditiva, no un modulo nuevo). Mismo criterio para
`subscriptions/dto/accept-consent.dto.ts` y `subscriptions/subscriptions.controller.ts` — con la
diferencia de que ese cambio SI es de ruptura (campo renombrado).

`plans/dto/update-session-exercise-prescription.dto.ts` es archivo NUEVO en `src/modules/plans/dto/`.

El service debe exponer exactamente estas firmas:

```typescript
// InstancesService (nuevo)
findAll(athleteId: string, page?: number, limit?: number): Promise<{ data: InstanceSummaryResponseDto[]; meta: PaginationMeta }>
findOwn(athleteId: string, planId: string): Promise<InstanceDetailResponseDto>          // auto-reparable, D-3
findForCoach(coachId: string, planId: string, athleteId: string): Promise<InstanceDetailResponseDto>
registerSessionResult(athleteId: string, planId: string, sessionId: string, dto: RegisterSessionResultDto): Promise<SessionResultResponseDto>
registerWeeklyFeeling(athleteId: string, planId: string, weekId: string, dto: RegisterWeeklyFeelingDto): Promise<WeeklyFeelingResponseDto>

// PlansService — metodo NUEVO a agregar sobre el service ya existente
updateSessionExercisePrescription(coachId: string, id: string, sessionId: string, sessionExerciseId: string, dto: UpdateSessionExercisePrescriptionDto): Promise<SessionExerciseResponseDto>
// addSessionExercise() y publish() YA EXISTEN — se EXTIENDEN, no cambian de firma

// SubscriptionsService — acceptConsent() YA EXISTE, misma firma — el DTO que recibe cambia de forma
acceptConsent(athleteId: string, id: string, dto: AcceptConsentDto, ip: string, userAgent: string): Promise<SubscriptionResponseDto>
```

Ademas, el plan de implementacion requiere un listener nuevo sin endpoint propio:

```
src/modules/execution/listeners/subscription-activated.listener.ts   <- Implementar (no generado aqui)
```

---

## Seguridad y acceso por endpoint

- `InstancesController`: `JwtAuthGuard` + `RolesGuard` a nivel de controller, `@Roles(...)` por
  METODO (roles mixtos ATHLETE/COACH — mismo patron D-1 de `SubscriptionsController`,
  EPICA-04). NINGUN endpoint de esta epica requiere `@AuditResources` (D-12): los GET propios del
  atleta son autoconsulta; el GET del entrenador SI expone datos de un tercero pero `:athleteId`
  ya viaja en la URL, cubriendo el rastro de habeas data sin el decorador; los dos POST son
  siempre escritura propia del atleta autenticado.
- `PlansController`: sin cambios de guards — sigue `JwtAuthGuard` + `RolesGuard(COACH)` a nivel de
  controller, `PlanPublishedGuard` a nivel de metodo en las rutas de estructura (el nuevo PATCH lo
  lleva tambien, mismos vecinos).
- `SubscriptionsController`: sin cambios de guards — `accept-consent` sigue
  `@Roles(UserRole.ATHLETE)`.

---

## Errores por endpoint (contra la lista `errores:` del plan, endpoint por endpoint)

| Endpoint | 400 | 401 | 403 | 404 | 409 | 422 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| GET /instances | — | Si | Si | — | — | — |
| GET /instances/:planId | — | Si | Si | Si | — | Si |
| GET /instances/:planId/athletes/:athleteId | — | Si | Si | Si | — | — |
| POST /instances/:planId/sessions/:sessionId/results | Si | Si | Si | Si | Si | Si |
| POST /instances/:planId/weeks/:weekId/feelings | Si | Si | Si | Si | Si | Si |
| POST /plans/:id/sessions/:sessionId/exercises | Si | Si | Si | Si | Si | Si* |
| PATCH /plans/:id/sessions/:sessionId/exercises/:sessionExerciseId | Si | Si | Si | Si | Si | — |
| POST /plans/:id/publish | — | Si | Si | Si | Si | Si |
| POST /subscriptions/:id/accept-consent | Si | Si | Si | Si | Si | — |

`*` Ver "Discrepancias encontradas" abajo — la entrada del plan para este endpoint especifico
omite el 422 en su lista `errores:`, pero su propio texto `proposito` sigue describiendo
`EXERCISE_INACTIVE (422)` sin cambios. Se mantuvo el 422 (comportamiento preexistente de EPICA-03,
no tocado por D-15) en vez de retirarlo.

Todos los errores usan `Content-Type: application/problem+json` (RFC 9457). 422 en
`GET /instances/:planId` y en los dos POST de `execution` = `CONSENT_REQUIRED`. 422 adicional en
`POST .../results` = `RESULT_FIELDS_INVALID` (CA-015-10). 409 en `POST .../results` y
`POST .../feelings` = `WEEK_FROZEN`. 403 en `POST .../results` y `POST .../feelings` =
`RESOURCE_OWNERSHIP_DENIED`. 403 en `GET .../athletes/:athleteId` = `RESOURCE_OWNERSHIP_DENIED`
sobre `:planId`, NUNCA `CONSENT_REQUIRED` (D-9). 422 en `publish()` sigue siendo
`PLAN_INCOMPLETE`, ahora cubriendo DOS motivos (estructura Y prescripcion, D-15) con el mismo
codigo. `accept-consent` no gana ningun error nuevo — sigue con el mismo catalogo de EPICA-04, solo
cambia la FORMA del 400 (dos campos a validar en vez de uno).

**CERO codigos de error nuevos en `BusinessError`** — confirmado contra `business-error.enum.ts`:
`ENTITY_NOT_FOUND`, `RESOURCE_OWNERSHIP_DENIED`, `CONSENT_REQUIRED`, `WEEK_FROZEN`,
`RESULT_FIELDS_INVALID` y `PLAN_INCOMPLETE` ya existen en el catalogo, exactamente como el plan
lo exige.

---

## Campos excluidos de DTOs de respuesta (Ley 1581/2012, rulesArquitectura §API)

- `subscriptionId` en `InstanceDetailResponseDto` — dato interno de relacion, sin uso para el
  cliente (el atleta ya sabe que esta Activo por haber llegado hasta aqui).
- `instanceSessionId`/`instanceWeekId`/`sessionId` como nombre de columna cruda en
  `SessionResultResponseDto`/`WeeklyFeelingResponseDto` — redundantes, el cliente ya conoce el
  contexto por donde pidio o recibio el DTO.
- `athleteId` denormalizado de `SessionResult` — no se expone como campo propio (redundante con el
  contexto: el atleta consulta lo suyo, el entrenador ya conoce `:athleteId` de la URL).
- `exerciseVersionId` en `InstanceSessionExerciseResponseDto` — mismo criterio que
  `SessionExerciseResponseDto` de EPICA-03: se expone `exerciseId` + `versionNumber`, nunca el
  puntero crudo a version.
- `WeeklyFeelingResponseDto` (muscleSoreness/motivation) — NUNCA se serializa fuera de
  `GET /instances/:planId(/athletes/:athleteId)` y de la respuesta directa de
  `POST .../feelings` (CA-016-6, Ley 1581/2012). No aparece en `InstanceSummaryResponseDto` ni en
  ningun otro DTO de listado.
- `reviewedBy` en `SubscriptionResponseDto` — sin cambios, sigue excluido desde EPICA-04
  (precedente citado explicitamente por el team lead).
- `documentVersion` (nombre viejo del campo) — REEMPLAZADO, no coexiste con
  `sportConsentDocumentVersion` en `AcceptConsentDto` (cambio de ruptura intencional, D-14).
- passwords, tokens, refresh tokens, `archivedAt` — no aplica a ninguno de los DTOs de esta epica
  (`PlanInstance` no tiene estado de archivo propio; ninguna entidad de `execution` maneja
  autenticacion).

---

## Notas de diseno relevantes para el Desarrollador

- `:planId` en TODAS las rutas de `execution` es el id de la PLANTILLA (Plan), NUNCA el id interno
  de `PlanInstance` (D-7b) — el atleta y el entrenador nunca necesitan conocer ese id interno para
  navegar la API. `PlanInstance.id` SI se expone como campo `id` en las respuestas (identidad
  propia del recurso, mismo criterio que cualquier otro DTO del proyecto), pero documentado
  explicitamente como "nunca usado como parametro de ruta" para que nadie lo confunda con `:planId`.
- `:sessionId` en `POST .../sessions/:sessionId/results` y `:weekId` en
  `POST .../weeks/:weekId/feelings` son los ids de `InstanceSession`/`InstanceWeek` (propios de la
  instancia, obtenidos por el cliente al leer `GET /instances/:planId` primero) — NUNCA los ids de
  `Session`/`Week` de la plantilla.
- `sessionExerciseId` dentro de `SessionExerciseResultItemDto` (item del payload de
  `POST .../results`) es el id de `InstanceSessionExercise` — mismo id que
  `InstanceSessionResponseDto.exercises[].id` en el arbol ya consultado. Nomenclatura elegida por
  el Documentador (el plan no fija el nombre exacto del campo): se prefirio `sessionExerciseId`
  sobre `instanceSessionExerciseId` para mantener el vocabulario simple de cara al cliente,
  documentado explicitamente en el DTO.
- `RegisterSessionResultDto`/`SessionExerciseResultItemDto` son las PRIMERAS DTOs del proyecto con
  un array anidado validado con `@ValidateNested({ each: true }) @Type(() => X)` — no habia
  precedente en el codebase (los arrays existentes son de escalares/UUIDs). Patron estandar de
  `class-validator`/`class-transformer`, necesario porque no hay otra forma de validar
  estructuralmente un array de objetos.
- Validaciones numericas de los 5 campos de prescripcion/resultado (`sets`, `reps`,
  `durationSeconds`: `@IsInt() @Min(1)`; `loadKg`, `distanceMeters`: `@IsNumber() @Min(0)`) son
  criterio del Documentador — ningun CA ni decision del plan fija limites exactos, solo que sean
  numericos y opcionales. Ajustables por el Desarrollador si el negocio define limites distintos.
- `RegisterWeeklyFeelingDto` NO usa un validador personalizado ni logica en el service para el
  rechazo atomico de CA-016-9 — el `ValidationPipe` GLOBAL ya lo garantiza por construccion: si
  `muscleSoreness` o `motivation` fallan `@Min(1)`/`@Max(10)`, el body COMPLETO se rechaza con 400
  ANTES de que el controller o el service se ejecuten, así que no puede existir una escritura
  parcial. Ningun codigo nuevo necesario para esa garantia.
- `SessionResultResponseDto.exerciseResults` y `SessionExerciseResultResponseDto` son la
  materializacion de D-6 (columnas tipadas en vez de `Json`): por construccion del service
  (verificacion RESULT_FIELDS_INVALID ANTES del upsert), `exerciseResults` siempre trae
  EXACTAMENTE un item por ejercicio programado — nunca un array parcial.
- `InstanceSessionExerciseResponseDto` comparte los mismos 5 campos de prescripcion que
  `SessionExerciseResponseDto` (plantilla) y `SessionExerciseResultResponseDto` (resultado) —
  intencional (D-6): EPICA-07/EPICA-08 los compararan uno a uno.
- `PlansController.publish()` NO gana un `@ApiProblemResponse` nuevo — sigue siendo
  `PLAN_INCOMPLETE (422)`, solo se amplio el texto de la descripcion para reflejar que ahora cubre
  dos motivos (estructura Y prescripcion, D-15) — mismo codigo, `context`/`missingRequirements`
  distintos por ocurrencia (mismo criterio que `ENTITY_NOT_FOUND` en el catalogo).
- `AcceptConsentDto` es CAMBIO DE RUPTURA real: cualquier cliente que enviara `documentVersion`
  antes de esta epica debe migrar a `sportConsentDocumentVersion` + `healthDataConsentDocumentVersion`
  — documentado explicitamente en el DTO y en el controller. No hay periodo de compatibilidad
  (cero usuarios en produccion, decision ya tomada por el humano en D-14).
- `data: { nullable: true, example: null }` no aplica a esta epica — ningun endpoint nuevo o
  modificado retorna `{ data: null }` (todos devuelven un DTO real).

---

## Checklist de consistencia plan-contrato

- [x] Los 5 endpoints nuevos de `InstancesController` tienen su metodo, con roles y guards exactos
  del plan (ATHLETE en 4, COACH en 1)
- [x] Los 3 endpoints modificados/nuevos de `PlansController` (D-15) tienen su metodo actualizado:
  `addSessionExercise` (DTO extendido), `updateSessionExercisePrescription` (nuevo), `publish`
  (doc extendida)
- [x] El endpoint modificado de `SubscriptionsController` (D-14) tiene su metodo actualizado:
  `acceptConsent` (DTO renombrado + campo nuevo, misma firma de servicio)
- [x] Todos los errores del plan tienen su `@ApiProblemResponse`, verificado endpoint por endpoint
  contra la lista `errores:` de cada entrada de `plan_de_implementacion.yaml` (tabla arriba) — con
  UNA excepcion documentada abajo en "Discrepancias" (422 de `EXERCISE_INACTIVE` retenido pese a
  que la lista abreviada del plan para ese endpoint especifico no lo repite)
- [x] Todos los DTOs referenciados explicitamente por el plan tienen su archivo:
  `InstanceSummaryResponseDto`, `InstanceDetailResponseDto`, `RegisterSessionResultDto`,
  `SessionResultResponseDto`, `RegisterWeeklyFeelingDto`, `WeeklyFeelingResponseDto`,
  `AddSessionExerciseDto` (extendido), `SessionExerciseResponseDto` (extendido),
  `UpdateSessionExercisePrescriptionDto` (nuevo), `AcceptConsentDto` (extendido) — mas 8 DTOs de
  soporte no nombrados por el plan pero requeridos por su propia asimetria de arbol embebido (D-2):
  `InstancePhaseResponseDto`, `InstanceWeekResponseDto`, `InstanceSessionResponseDto`,
  `InstanceSessionExerciseResponseDto`, `SessionExerciseResultResponseDto`,
  `SessionExerciseResultItemDto`
- [x] Ningun DTO de respuesta expone `archivedAt`, tokens, `reviewedBy`, ni datos sensibles de
  salud fuera de su contexto autorizado (ver seccion "Campos excluidos" arriba)
- [x] `:planId` en todas las rutas de `execution` es el id de la plantilla — `PlanInstance.id`
  nunca se usa como parametro de ruta (D-7b), documentado explicitamente en cada DTO que lo expone
- [x] Guards del plan aplicados: `JwtAuthGuard` + `RolesGuard` a nivel de controller + `@Roles`
  por metodo en `InstancesController` (roles mixtos, D-1); `PlanPublishedGuard` en el nuevo PATCH
  de `plans` (mismos vecinos de estructura); sin cambios de guards en `subscriptions`
- [x] Ningun endpoint requiere `@AuditResources` — verificado contra D-12 endpoint por endpoint
- [x] Imports de Prisma (`UserRole`) desde `generated/prisma` con ruta relativa correcta:
  `../../../generated/prisma/index.js` (controllers) — sin enums locales que dupliquen Prisma (no
  se creo ningun enum nuevo; los 5 campos de prescripcion/resultado son numericos simples)
  — verificado con `npx tsc --noEmit` (ver abajo)
- [x] `CERO` codigos de error nuevos en `BusinessError` — confirmado leyendo
  `src/modules/common/exceptions/business-error.enum.ts`: los 6 codigos que esta epica usa ya
  existian antes de este contrato
- [x] No se toco ningun archivo de contrato de otra epica fuera de alcance (`auth/**`,
  `exercises/**` intactos; dentro de `plans/**` y `subscriptions/**` solo se tocaron los archivos
  explicitamente listados en el plan de EPICA-05 como REABIERTOS)
- [x] `npx tsc --noEmit` de los stubs generados compila sin errores, verificado en un harness
  aislado (`tsconfig.contract-check.epica05.json`, temporal, eliminado despues del check) que
  enlaza `src/modules/common`, `src/modules/prisma` y `generated/prisma` reales via symlinks
  temporales, mas `InstancesService`/`PlansService`/`SubscriptionsService` stub temporales — NINGUNO
  de estos artefactos de verificacion quedo en el output final (confirmado con `git status` tras
  la limpieza)

## Discrepancias encontradas con el plan del Arquitecto

Una, menor, no bloqueante: la entrada del plan para `POST /plans/:id/sessions/:sessionId/exercises`
(seccion `endpoints`, bloque "D-15 — Prescripcion en la plantilla") lista `errores: [400, 401, 403,
404, 409]`, sin el `422` de `EXERCISE_INACTIVE` — pero el propio campo `proposito` de esa misma
entrada sigue describiendo textualmente "resuelve exerciseId -> ExerciseVersion vigente... RN-07"
sin mencionar que se haya retirado esa validacion, y ni `modulos_afectados` ni ninguna decision
arquitectonica (D-1 a D-15) dice que EXERCISE_INACTIVE se elimine — D-15 es exclusivamente aditivo
sobre este endpoint (5 campos opcionales nuevos). Se interpreta como una lista `errores:` abreviada
al redactar la enmienda (el Arquitecto listo solo lo relevante al cambio de esta pasada, no
repitio el catalogo completo del endpoint original de EPICA-03) y NO como una decision de retirar
`EXERCISE_INACTIVE`. Se mantuvo el `@ApiProblemResponse(422, ...)` ya existente sin cambios. No
escala al humano porque no hay conflicto de negocio ni ambiguedad de comportamiento — solo una
lista de referencia incompleta en el YAML.

Sin mas discrepancias: el plan (v1.4) y el reporte de validacion de negocio (4/4 HU aprobadas sin
condiciones) llegaron consistentes entre si y con `epica_input.yaml`. Las dos condiciones que el
Analista habia dejado abiertas en HU-023 (CA-023-8, idempotencia) y HU-016 (CA-016-8/CA-016-9,
consentimiento de salud y rango 1-10) ya estaban resueltas en el plan antes de que este
Documentador empezara a trabajar.
