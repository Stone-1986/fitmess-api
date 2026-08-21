# Contrato OpenAPI — EPICA-04: Inscripcion de Atletas a Planes

Generado por el Documentador el 2026-08-20.
Fuente de verdad: `outputs/plan_de_implementacion.yaml` + `outputs/reporte_validacion_negocio.yaml`.

Modulo nuevo — `subscriptions` no existe todavia en `src/modules/`. El contrato vive en
`outputs/contrato_openapi/src/modules/subscriptions/` espejando la ubicacion final
`src/modules/subscriptions/` (sin feature folders — un solo controller, un solo service).

---

## Resumen de endpoints (6)

### SubscriptionsController (`/subscriptions`) — roles MIXTOS por metodo (D-1)

| # | Metodo | Ruta | HU | Rol | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|----|-------------|----------------|------|
| 1 | POST | `/subscriptions` | HU-012 | ATHLETE | CreateSubscriptionDto | SubscriptionResponseDto | 201 |
| 2 | GET | `/subscriptions` | HU-014 | ATHLETE | — (query page/limit) | SubscriptionResponseDto[] + meta | 200 |
| 3 | GET | `/subscriptions/pending` | HU-013 | COACH | — (query page/limit) | SubscriptionPendingSummaryResponseDto[] + meta | 200 |
| 4 | POST | `/subscriptions/:id/approve` | HU-013 | COACH | — | SubscriptionResponseDto | 200 |
| 5 | POST | `/subscriptions/:id/reject` | HU-013 | COACH | — | SubscriptionResponseDto | 200 |
| 6 | POST | `/subscriptions/:id/accept-consent` | HU-014 | ATHLETE | AcceptConsentDto | SubscriptionResponseDto | 200 |

D-1: `@Roles(...)` se fija por METODO, no a nivel de controller — es el primer modulo del
proyecto con operaciones exclusivas de ATHLETE y de COACH sobre el mismo recurso.
`JwtAuthGuard` + `RolesGuard` si van a nivel de controller (comunes a los 6 endpoints).

---

## Estructura de archivos generados

```
outputs/contrato_openapi/src/modules/subscriptions/
  subscriptions.controller.ts                    <- 6 endpoints (stubs)
  dto/
    create-subscription.dto.ts                   <- HU-012: entrada de POST /subscriptions (planId)
    accept-consent.dto.ts                         <- HU-014: entrada de accept-consent (documentVersion)
    subscription-response.dto.ts                  <- respuesta plana (create/list/approve/reject/accept-consent)
    subscription-pending-summary-response.dto.ts   <- HU-013: item del panel de pendientes (athleteName/planName)
  README-contrato-epica04.md                      <- Este archivo
```

## Ubicacion definitiva en el proyecto

Cuando el Desarrollador implemente el modulo, los archivos se copian a
`src/modules/subscriptions/` (misma estructura), agregando `subscriptions.service.ts` y
`subscriptions.module.ts` (fuera del alcance del Documentador).

---

## Errores documentados por endpoint (contra `errores:` del plan)

| Endpoint | Plan | Documentado |
|---|---|---|
| POST /subscriptions | 400, 401, 403, 404, 409 | 400, 401, 403, 404, 409 |
| GET /subscriptions | 401, 403 | 401, 403 |
| GET /subscriptions/pending | 401, 403 | 401, 403 |
| POST /subscriptions/:id/approve | 401, 403, 404, 409 | 401, 403, 404, 409 |
| POST /subscriptions/:id/reject | 401, 403, 404, 409 | 401, 403, 404, 409 |
| POST /subscriptions/:id/accept-consent | 400, 401, 403, 404, 409 | 400, 401, 403, 404, 409 |

Ningun `@ApiProblemResponse` agregado fuera de la lista `errores:` de cada entrada del plan
(hallazgo #3 del proyecto — un 400 de mas en un endpoint sin body es indetectable en runtime).

### D-6/D-10 — `PLAN_NOT_PUBLISHED` reutilizado en dos endpoints

Un solo codigo de error (409, "El plan no esta vigente"), con `detail` distinto por ocurrencia:

- `POST /subscriptions` (CA-012-4): "el plan no acepta nuevas inscripciones en su estado actual".
- `POST /subscriptions/:id/accept-consent` (CA-014-8): "el plan ya no esta vigente" — la
  suscripcion permanece en Aprobada, sin transicionar nunca a Activa.

### D-10 / CA-014-8 — dos causas distintas del 409 en accept-consent

El `@ApiProblemResponse(409, ...)` de `accept-consent` documenta explicitamente las DOS causas
posibles: `INVALID_STATE_TRANSITION` (la suscripcion no esta en Aprobada) y
`PLAN_NOT_PUBLISHED` (el plan referenciado ya no esta efectivamente vigente).

### D-8 — contenido del consentimiento fuera de alcance

`AcceptConsentDto` recibe unicamente `documentVersion` (string). El texto del consentimiento,
incluido el disclaimer de IA de CA-014-5, es responsabilidad del frontend con contenido
versionado estatico — mismo precedente que HABEAS_DATA/TERMS_OF_SERVICE de HU-003. El backend
no expone ningun endpoint de lectura del documento.

---

## Notas de implementacion para el Desarrollador

- `SubscriptionStatus` se importa desde `generated/prisma` (ya existe en el schema, cuatro
  valores: PENDING/APPROVED/REJECTED/ACTIVE) — NUNCA redeclarar localmente.
- `SubscriptionResponseDto` NUNCA expone `reviewedBy` (UUID interno del entrenador que
  aprobo/rechazo) — mismo criterio ya aplicado a `CoachRequestSummaryResponseDto` en EPICA-01.
  Tampoco expone contenido del documento de consentimiento (D-8) ni ningun dato de salud.
- `subscriptions` lee `Plan`/`User` directamente via `PrismaService` compartido — NUNCA importa
  `PlansService`, `PlansModule`, `AuthService` ni `AuthModule` (D-2, verificado en
  `criterios_de_aceptacion_tecnicos` del plan).
- `POST /subscriptions/:id/reject` no recibe body — sin `rejectionReason` (D-4, a diferencia de
  `CoachRequest` en EPICA-01).
- Los 6 metodos del controller son stubs que delegan a `SubscriptionsService` — sin logica de
  negocio, compilan pero no implementan nada todavia.

---

## Checklist de consistencia plan-contrato

- [x] Los 6 endpoints del plan tienen su metodo en `SubscriptionsController`
- [x] Todos los errores del plan tienen su `@ApiProblemResponse` (tabla arriba) — ninguno de mas,
  ninguno de menos
- [x] Los DTOs referenciados por el plan tienen su archivo: `CreateSubscriptionDto`,
  `AcceptConsentDto`, `SubscriptionResponseDto` — mas `SubscriptionPendingSummaryResponseDto`,
  requerido por la forma de respuesta distinta que el propio plan describe para HU-013 (resumen
  enriquecido vs `SubscriptionResponseDto` propio del atleta)
- [x] Ningun DTO de respuesta expone `archivedAt`, passwords, tokens, `reviewedBy` ni datos
  sensibles de salud
- [x] Guards del plan aplicados: `JwtAuthGuard` + `RolesGuard` a nivel de controller;
  `@Roles(ATHLETE)` en POST /subscriptions, GET /subscriptions y accept-consent; `@Roles(COACH)`
  en GET /pending, approve y reject — exactamente como fija el campo `guards:` de cada endpoint
  del plan (3 ATHLETE + 3 COACH; D-1)
- [x] Imports de Prisma (`UserRole`, `SubscriptionStatus`) desde `generated/prisma` con ruta
  relativa correcta: `../../../generated/prisma/index.js` (controller),
  `../../../../generated/prisma/index.js` (dto/)
- [x] Ningun enum local que duplique Prisma — `SubscriptionStatus` se importa, no se redeclara
- [x] D-6/D-10 (`PLAN_NOT_PUBLISHED` reutilizado, dos causas del 409 en accept-consent) reflejados
  explicitamente en la documentacion de errores
- [x] D-8 (contenido del consentimiento fuera de alcance) reflejado en `AcceptConsentDto`
- [x] No se toco ningun archivo de contrato de otra epica (`auth/**`, `exercises/**`, `plans/**`
  intactos)
- [x] `npx tsc --noEmit` de los stubs generados compila sin errores, verificado en un harness
  temporal que copio `subscriptions.controller.ts` + `dto/` a `src/modules/subscriptions/` junto
  a un `SubscriptionsService` stub (no incluido en el output final), corrio contra el
  `tsconfig.json` real del proyecto (enlazando `src/modules/common` y `generated/prisma` reales),
  y se elimino del `src/` real inmediatamente despues — `git status` quedo limpio salvo este
  directorio de contrato

## Discrepancias encontradas con el plan del Arquitecto

Ninguna. El plan y el reporte de validacion de negocio llegaron consistentes entre si: HU-012,
HU-013 y HU-014 estan las tres APROBADAS sin condiciones (la condicion original de HU-014 sobre
CA-014-8 ya fue resuelta por el humano antes del cierre del plan, via D-10).
