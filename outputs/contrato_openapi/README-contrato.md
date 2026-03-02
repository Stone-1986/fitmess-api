# Contrato OpenAPI — EPICA-01: Gestión de Acceso y Cumplimiento Legal

Generado por el Documentador el 2026-03-01.
Fuente de verdad: `outputs/plan_de_implementacion.yaml` + `outputs/reporte_validacion_negocio.yaml`.

---

## Resumen de endpoints

| # | Metodo | Ruta | HU | Controller | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|------------|-------------|---------------|------|
| 1 | POST | `/auth/coaches/register` | HU-001 | AuthController | RegisterCoachDto | CoachRequestResponseDto | 201 |
| 2 | POST | `/auth/register` | HU-003 | AuthController | RegisterAthleteDto | AthleteRegistrationResponseDto | 201 |
| 3 | POST | `/auth/login` | HU-004 | AuthController | LoginDto | AuthTokenResponseDto | 200 |
| 4 | POST | `/coach-requests/search` | HU-002 | CoachRequestsController | SearchCoachRequestsDto | CoachRequestSummaryResponseDto[] + PaginationMeta | 200 |
| 5 | GET | `/coach-requests/:id` | HU-002 | CoachRequestsController | — | CoachRequestDetailResponseDto | 200 |
| 6 | POST | `/coach-requests/:id/approve` | HU-002 | CoachRequestsController | — | CoachRequestResponseDto | 200 |
| 7 | POST | `/coach-requests/:id/reject` | HU-002 | CoachRequestsController | RejectCoachRequestDto | CoachRequestResponseDto | 200 |

---

## Estructura de archivos generados

```
outputs/contrato_openapi/
  auth.controller.ts                      <- Controller endpoints publicos (/auth)
  coach-requests.controller.ts            <- Controller endpoints admin (/coach-requests)
  dto/
    register-coach.dto.ts                 <- HU-001: entrada registro entrenador
    register-athlete.dto.ts               <- HU-003: entrada registro atleta
    login.dto.ts                          <- HU-004: entrada inicio de sesion
    search-coach-requests.dto.ts          <- HU-002: entrada busqueda con filtros
    reject-coach-request.dto.ts           <- HU-002: entrada rechazo con motivo
    coach-request-response.dto.ts         <- HU-001/002: respuesta estandar CoachRequest
    coach-request-summary-response.dto.ts <- HU-002: elemento del listado
    coach-request-detail-response.dto.ts  <- HU-002: detalle para revision admin
    athlete-registration-response.dto.ts  <- HU-003: respuesta registro atleta
    auth-token-response.dto.ts            <- HU-004: respuesta con tokens JWT
    pagination-meta-response.dto.ts       <- Meta de paginacion para listados
  enums/
    coach-request-status.enum.ts          <- PENDING | APPROVED | REJECTED
    document-type.enum.ts                 <- HABEAS_DATA | TERMS_OF_SERVICE | HEALTH_DATA_CONSENT | SPORT_CONSENT
    identification-type.enum.ts           <- CC | CE | NIT | PASAPORTE | PPT | PEP
    user-role.enum.ts                     <- ATHLETE | COACH | ADMIN
  README-contrato.md                      <- Este archivo
```

NOTA: El directorio `outputs/contrato_openapi/src/` contiene archivos de una version anterior
del contrato. Los archivos definitivos son los que estan en la raiz de `outputs/contrato_openapi/`.

---

## Ubicacion definitiva en el proyecto

Cuando el Desarrollador implemente el modulo, los archivos se copian a:

```
src/modules/auth/
  auth.controller.ts
  coach-requests.controller.ts
  dto/
    register-coach.dto.ts
    register-athlete.dto.ts
    login.dto.ts
    search-coach-requests.dto.ts
    reject-coach-request.dto.ts
    coach-request-response.dto.ts
    coach-request-summary-response.dto.ts
    coach-request-detail-response.dto.ts
    athlete-registration-response.dto.ts
    auth-token-response.dto.ts
    pagination-meta-response.dto.ts
  enums/
    coach-request-status.enum.ts
    document-type.enum.ts
    identification-type.enum.ts
    user-role.enum.ts  (o mover a src/modules/common/enums/ si otros modulos lo usan)
```

---

## Seguridad y acceso por endpoint

| Endpoint | Guard(s) | Rol requerido | Publico |
|----------|----------|---------------|---------|
| POST /auth/coaches/register | Ninguno | — | Si |
| POST /auth/register | Ninguno | — | Si |
| POST /auth/login | LocalAuthGuard | — | Si (procesado por Passport) |
| POST /coach-requests/search | JwtAuthGuard + RolesGuard | ADMIN | No |
| GET /coach-requests/:id | JwtAuthGuard + RolesGuard | ADMIN | No |
| POST /coach-requests/:id/approve | JwtAuthGuard + RolesGuard | ADMIN | No |
| POST /coach-requests/:id/reject | JwtAuthGuard + RolesGuard | ADMIN | No |

Los endpoints publicos usan `@ApiSecurity([])` para excluirse de la regla Spectral
`fitmess-auth-401-operation` (que exige que endpoints con `@ApiBearerAuth()` documenten 401).

---

## Maquina de estados: CoachRequest

```
PENDING ---> APPROVED  (POST /coach-requests/:id/approve)
PENDING ---> REJECTED  (POST /coach-requests/:id/reject)

APPROVED ---> [cualquier estado]  = 409 INVALID_STATE_TRANSITION
REJECTED ---> [cualquier estado]  = 409 INVALID_STATE_TRANSITION
```

---

## Errores por endpoint

| Endpoint | 400 | 401 | 403 | 404 | 409 | 429 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| POST /auth/coaches/register | Si | — | — | — | Si | — |
| POST /auth/register | Si | — | — | — | Si | — |
| POST /auth/login | Si | Si | Si | — | — | Si |
| POST /coach-requests/search | Si | Si | Si | — | — | — |
| GET /coach-requests/:id | — | Si | Si | Si | — | — |
| POST /coach-requests/:id/approve | — | Si | Si | Si | Si | — |
| POST /coach-requests/:id/reject | Si | Si | Si | Si | Si | — |

Todos los errores usan `Content-Type: application/problem+json` (RFC 9457).

---

## Campos excluidos de DTOs de respuesta

Conforme a `rulesArquitectura.md`:

- `passwordHash` — nunca en ninguna respuesta
- `archivedAt` — campo interno de soft-delete
- `reviewedBy` (UUID del admin) — dato interno de auditoria
- Tokens (accessToken, refreshToken) — solo en AuthTokenResponseDto por necesidad funcional

---

## Marco legal colombiano aplicado

| Ley | Aplicacion en el contrato |
|-----|--------------------------|
| Ley 1581/2012 + Decreto 1377/2013 | `acceptsHabeasData` y `acceptsTermsOfService` son campos booleanos independientes en RegisterCoachDto y RegisterAthleteDto |
| Ley 527/1999 | LegalAcceptance es inmutable — el service no expone metodos update ni delete |
| Ley 1273/2009 | 409 con mensaje neutro ante duplicados; 401 con mensaje identico para email/password incorrecto; bloqueo por cuenta en /auth/login |
| OWASP 2025 | Bloqueo temporal por cuenta (5 intentos fallidos, 15 min) documentado en LoginDto y en @ApiOperation de POST /auth/login |

---

## Eventos emitidos (para el modulo notifications)

| Evento | Emitido desde | Proposito |
|--------|--------------|-----------|
| `coach.request.created` | POST /auth/coaches/register | Notificar al admin de nueva solicitud |
| `coach.request.approved` | POST /coach-requests/:id/approve | Notificar al coach su aprobacion |
| `coach.request.rejected` | POST /coach-requests/:id/reject | Notificar al coach su rechazo con motivo |
| `user.registered` | POST /auth/register | Notificar registro exitoso de atleta |

Los eventos `coach.request.approved` y `coach.request.rejected` deben agregarse al
catalogo en `.claude/skills/design-patterns/` antes de que el Desarrollador inicie
(riesgo BLOQUEANTE PARCIAL identificado en el plan de implementacion).

---

## Prerequisito bloqueante

El Desarrollador no puede iniciar hasta que el humano ejecute:

```bash
pnpm prisma migrate dev
```

Con los siguientes cambios al schema (detallados en `outputs/plan_de_implementacion.yaml`):

- enum UserRole + valor ADMIN
- enum CoachRequestStatus (PENDING, APPROVED, REJECTED)
- enum DocumentType (HABEAS_DATA, TERMS_OF_SERVICE, HEALTH_DATA_CONSENT, SPORT_CONSENT)
- enum IdentificationType (CC, CE, NIT, PASAPORTE, PPT, PEP)
- model User
- model CoachRequest
- model LegalAcceptance (inmutable — sin update ni delete)
- model AuditLog
- model RefreshToken

---

## Checklist de consistencia plan-contrato

- [x] Todos los 7 endpoints del plan tienen su metodo en el controller
- [x] Todos los errores del plan tienen su @ApiProblemResponse
- [x] Todos los DTOs referenciados en el plan tienen su archivo
- [x] Ningun DTO de respuesta expone passwordHash, archivedAt ni tokens no funcionales
- [x] JwtAuthGuard + RolesGuard(ADMIN) aplicados a nivel de controller en CoachRequestsController
- [x] LocalAuthGuard documentado en POST /auth/login (stub con UseGuards comentado)
- [x] ParseUUIDPipe en todos los parametros :id (approve, reject, findOne)
- [x] Endpoints publicos usan @ApiSecurity([]) en AuthController
- [x] HEALTH_DATA_CONSENT ausente de RegisterAthleteDto
- [x] acceptsHabeasData y acceptsTermsOfService como campos independientes en ambos DTOs de registro
- [x] Bloqueo por cuenta (429) documentado en POST /auth/login
- [x] Imports del cliente Prisma: el Desarrollador debe usar generated/prisma, nunca @prisma/client
- [x] CoachRequestSummaryResponseDto generado para el listado (no estaba nominado explicitamente en el plan — derivado del plan: "CoachRequestSummaryResponseDto[] + PaginationMeta (200)")
- [x] PaginationMetaResponseDto generado para cubrir la respuesta paginada del search
