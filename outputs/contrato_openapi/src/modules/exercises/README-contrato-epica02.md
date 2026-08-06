# Contrato OpenAPI — EPICA-02: Catalogo Global de Ejercicios

Generado por el Documentador el 2026-08-05.
Fuente de verdad: `outputs/plan_de_implementacion.yaml` + `outputs/reporte_validacion_negocio.yaml`.

Modulo nuevo — `exercises` no existe todavia en `src/modules/`. El contrato vive en
`outputs/contrato_openapi/src/modules/exercises/` espejando la ubicacion final
`src/modules/exercises/` (sin feature folders — modulo de una sola feature).

---

## Resumen de endpoints

| # | Metodo | Ruta | HU | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|-------------|----------------|------|
| 1 | POST | `/exercises` | HU-005 | CreateExerciseDto | ExerciseResponseDto | 201 |
| 2 | GET | `/exercises` | HU-005 (CA-005-3) / HU-007 (CA-007-2) | ListExercisesQueryDto (query) | ExerciseSummaryResponseDto[] + meta | 200 |
| 3 | GET | `/exercises/:id` | HU-006 (CA-006-2) / HU-007 (CA-007-3) | — | ExerciseDetailResponseDto | 200 |
| 4 | PATCH | `/exercises/:id` | HU-006 | UpdateExerciseDto | ExerciseResponseDto | 200 |
| 5 | DELETE | `/exercises/:id` | HU-007 | — | `{ data: null, message: string }` | 200 |

---

## Estructura de archivos generados

```
outputs/contrato_openapi/src/modules/exercises/
  exercises.controller.ts                        <- Los 5 endpoints (stubs)
  dto/
    create-exercise.dto.ts                        <- HU-005: entrada de creacion
    update-exercise.dto.ts                        <- HU-006: entrada de modificacion (PATCH)
    exercise-response.dto.ts                       <- HU-005/HU-006: respuesta create/update
    exercise-summary-response.dto.ts               <- HU-005/HU-007: item del listado
    exercise-detail-response.dto.ts                <- HU-006/HU-007: detalle + historial
    exercise-version-history-response.dto.ts       <- Entrada embebida del historial (CA-006-2)
    list-exercises-query.dto.ts                    <- HU-005/HU-007: query params del listado
  README-contrato-epica02.md                       <- Este archivo
```

## Ubicacion definitiva en el proyecto

Cuando el Desarrollador implemente el modulo, los archivos se copian a
`src/modules/exercises/` (misma estructura). Los imports relativos del
controller y las respuestas ya estan escritos asumiendo esa ubicacion final:

```
src/modules/exercises/
  exercises.controller.ts
  exercises.service.ts          <- Implementar (no generado aqui)
  exercises.module.ts           <- Implementar (no generado aqui)
  dto/
    create-exercise.dto.ts
    update-exercise.dto.ts
    exercise-response.dto.ts
    exercise-summary-response.dto.ts
    exercise-detail-response.dto.ts
    exercise-version-history-response.dto.ts
    list-exercises-query.dto.ts
```

El service debe exponer exactamente estas firmas (usadas por el controller):

```typescript
create(dto: CreateExerciseDto): Promise<ExerciseResponseDto>
findAll(query: ListExercisesQueryDto): Promise<{ data: ExerciseSummaryResponseDto[]; meta: PaginationMeta }>
findOne(id: string): Promise<ExerciseDetailResponseDto>
update(id: string, dto: UpdateExerciseDto): Promise<ExerciseResponseDto>
deactivate(id: string): Promise<{ data: null; message: string }>
```

---

## Seguridad y acceso por endpoint

Los 5 endpoints comparten `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.COACH, UserRole.ADMIN)`
a nivel de controller (decision arquitectonica: ningun endpoint de esta epica admite ATHLETE,
ni siquiera lectura — el acceso de ATHLETE via planes es EPICA-03).

---

## Errores por endpoint

| Endpoint | 400 | 401 | 403 | 404 | 409 | 422 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| POST /exercises | Si | Si | Si | — | Si | — |
| GET /exercises | Si | Si | Si | — | — | — |
| GET /exercises/:id | — | Si | Si | Si | — | — |
| PATCH /exercises/:id | Si | Si | Si | Si | Si | Si |
| DELETE /exercises/:id | — | Si | Si | Si | — | Si |

Todos los errores usan `Content-Type: application/problem+json` (RFC 9457).
409 = `DUPLICATE_ENTITY`. 422 = `EXERCISE_INACTIVE`. `EXERCISE_IN_USE` NUNCA se usa en esta epica
(CA-007-1, decision del humano 2026-08-05).

---

## Campos excluidos de DTOs de respuesta

- `exerciseId` de cada entrada del historial de versiones — dato interno de relacion,
  redundante con el `id` del ejercicio contenedor (ver `exercise-version-history-response.dto.ts`)
- `id` propio de cada `ExerciseVersion` — ninguna HU de esta epica requiere referenciar una
  version por su id desde el cliente
- `archivedAt` — esta entidad usa `isActive` (Boolean), no `archivedAt` (convencion propia de
  ejercicios, design-patterns skill seccion 5)
- passwords, tokens, refresh tokens, datos sensibles de salud — no aplica a esta epica (contenido
  de catalogo, no datos personales)

---

## Notas de diseno relevantes para el Desarrollador

- La creacion de Exercise + primera ExerciseVersion ocurre en una sola `$transaction` — nunca
  debe quedar un Exercise sin ninguna version (CA-005-1).
- La unicidad de `name` es case-insensitive, con `trim()`, y aplica SOLO entre ejercicios
  ACTIVOS (`isActive: true`) — tanto en `create()` como en el rename de `update()`. Requiere un
  indice unico parcial en Postgres (`CREATE UNIQUE INDEX ... ON exercises (lower(name)) WHERE
  is_active = true`), no un `@unique` simple de Prisma — asignado al DBA.
- `update()` verifica `isActive === false` ANTES de invocar `isUsedInPlan()` y rechaza con
  `EXERCISE_INACTIVE` (422) sin tocar la version vigente (CA-006-6).
- `isUsedInPlan(exerciseId)` es un metodo privado del service que HOY siempre retorna `false` —
  EPICA-03 reemplaza su cuerpo por una query real. Las dos ramas se cubren mockeando este metodo
  en tests unitarios.
- La version vigente se obtiene por `versionNumber` descendente
  (`include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }`) — NO existe un
  puntero denormalizado `currentVersionId` en `Exercise`.
- `includeInactive` en `ListExercisesQueryDto` usa `@Transform` explicito (no `@Type(() =>
  Boolean)`) porque `Boolean('false') === true` en JavaScript.

---

## Checklist de consistencia plan-contrato

- [x] Los 5 endpoints del plan tienen su metodo en `ExercisesController`
- [x] Todos los errores del plan tienen su `@ApiProblemResponse`
  - POST /exercises: 400, 401, 403, 409
  - GET /exercises: 400, 401, 403
  - GET /exercises/:id: 401, 403, 404
  - PATCH /exercises/:id: 400, 401, 403, 404, 409, 422
  - DELETE /exercises/:id: 401, 403, 404, 422
- [x] Todos los DTOs referenciados en el plan tienen su archivo (CreateExerciseDto,
  UpdateExerciseDto, ExerciseResponseDto, ExerciseSummaryResponseDto, ExerciseDetailResponseDto,
  ademas de ExerciseVersionHistoryResponseDto y ListExercisesQueryDto, no nombrados
  explicitamente por el plan pero requeridos por el)
- [x] Ningun DTO de respuesta expone `archivedAt`, passwords, tokens ni `exerciseId`/`id` interno
  de `ExerciseVersion`
- [x] `JwtAuthGuard` + `RolesGuard(COACH, ADMIN)` aplicados a nivel de controller en los 5 endpoints
- [x] Imports de Prisma (`UserRole`) desde `generated/prisma` con ruta relativa correcta para
  `src/modules/exercises/`: `../../../generated/prisma/index.js`
- [x] Ningun enum local que duplique Prisma — `muscleGroup` es texto libre por decision de la
  epica, no hay enum de grupos musculares
- [x] `GET /exercises/:id` no filtra por `isActive` (CA-007-3); `GET /exercises` si filtra por
  defecto (CA-007-2)
- [x] `PATCH /exercises/:id` documenta 422 `EXERCISE_INACTIVE` (CA-006-6); `DELETE /exercises/:id`
  documenta 422 `EXERCISE_INACTIVE` (CA-007-4); ningun endpoint documenta `EXERCISE_IN_USE`
- [x] No se toco ningun archivo de contrato de otra epica (`src/modules/auth/**` intacto)
- [x] `npx tsc --noEmit` de los stubs generados compila sin errores, verificado en un harness
  aislado que enlaza `src/modules/auth`, `src/modules/common` y `generated/prisma` reales mas un
  `ExercisesService` stub temporal (no incluido en el output final — el Desarrollador lo
  implementa)
