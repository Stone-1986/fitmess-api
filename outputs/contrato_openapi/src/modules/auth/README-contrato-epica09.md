# Contrato OpenAPI — EPICA-09: Registro y Autenticacion de Administradores

Generado por el Documentador el 2026-03-08.
Fuente de verdad: `outputs/plan_de_implementacion.yaml` + `outputs/reporte_validacion_negocio.yaml`.

---

## Resumen de endpoints

| # | Metodo | Ruta | HU | Controller | DTO entrada | DTO respuesta | HTTP |
|---|--------|------|----|------------|-------------|---------------|------|
| 1 | POST | `/admin-invitations` | HU-002 | AdminInvitationsController | CreateAdminInvitationDto | AdminInvitationResponseDto | 201 |
| 2 | POST | `/admin-invitations/verify` | HU-003 | AdminInvitationsController | VerifyAdminInvitationDto | AdminInvitationStatusResponseDto | 200 |
| 3 | POST | `/auth/admin/register` | HU-003 | AuthController (adicion) | RegisterAdminDto | AdminRegistrationResponseDto | 201 |

**Nota:** HU-001 (seed) NO genera endpoints HTTP — es un script `prisma/seed.ts` standalone.

---

## Estructura de archivos generados

```
outputs/contrato_openapi/src/modules/auth/
  admin-invitations.controller.ts          <- HU-002 y HU-003 (POST verify)
  auth.controller.epica09-addition.ts      <- Fragmento: metodo POST /auth/admin/register
  dto/
    create-admin-invitation.dto.ts         <- HU-002: entrada de la invitacion (solo email)
    admin-invitation-response.dto.ts       <- HU-002: confirmacion de invitacion creada
    admin-invitation-status-response.dto.ts <- HU-003 POST verify: estado de la invitacion
    verify-admin-invitation.dto.ts           <- HU-003 POST verify: entrada (token en body)
    register-admin.dto.ts                  <- HU-003 POST: datos personales + invitationToken + legales
    admin-registration-response.dto.ts     <- HU-003 POST: confirmacion del registro del admin
  README-contrato-epica09.md               <- Este archivo
```

---

## Ubicacion definitiva en el proyecto

Cuando el Desarrollador implemente el modulo, los archivos se copian a:

```
src/modules/auth/
  admin-invitations.controller.ts
  admin-invitations.service.ts            <- Implementar (no generado aqui)
  dto/
    create-admin-invitation.dto.ts
    admin-invitation-response.dto.ts
    verify-admin-invitation.dto.ts           <- HU-003: entrada de verificacion (token en body)
    admin-invitation-status-response.dto.ts
    register-admin.dto.ts
    admin-registration-response.dto.ts
```

El metodo `registerAdmin` del archivo `auth.controller.epica09-addition.ts` se agrega
al AuthController existente en `src/modules/auth/auth.controller.ts`.

---

## Seguridad y acceso por endpoint

| Endpoint | Guard(s) | Rol requerido | Publico |
|----------|----------|---------------|---------|
| POST /admin-invitations | JwtAuthGuard + RolesGuard | ADMIN | No |
| POST /admin-invitations/verify | Ninguno (publico) | — | Si |
| POST /auth/admin/register | Ninguno (publico) | — | Si |

Los endpoints publicos usan `security: []` en `@ApiOperation` para excluirse de la regla
Spectral `fitmess-auth-401-operation`.

NOTA: `AdminInvitationsController` usa `@ApiBearerAuth()` a nivel de clase (por POST).
El metodo `verify` (POST) declara `security: []` en `@ApiOperation` para anular la
autenticacion a nivel de metodo — Spectral respeta esta declaracion por metodo.

---

## Errores por endpoint

| Endpoint | 400 | 401 | 403 | 404 | 409 | 422 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| POST /admin-invitations | Si | Si | Si | — | Si | — |
| POST /admin-invitations/verify | Si | — | — | Si | Si | Si |
| POST /auth/admin/register | Si | — | — | Si | Si | Si |

Todos los errores usan `Content-Type: application/problem+json` (RFC 9457).

---

## Campos excluidos de DTOs de respuesta

Conforme a `rulesArquitectura.md`:

- `tokenHash` — campo interno de seguridad (sha256 del token RAW)
- `invitedBy` — UUID del admin invitante (dato interno de auditoria)
- `tokenUsedAt` — campo interno de estado
- `passwordHash` — nunca en ninguna respuesta
- `archivedAt` — campo interno de soft-delete
- tokens JWT — el admin autentica separadamente via POST /auth/login

---

## Marco legal colombiano aplicado

| Ley | Aplicacion en el contrato |
|-----|--------------------------|
| Ley 1581/2012 + Decreto 1377/2013 | `acceptsHabeasData` y `acceptsTermsOfService` son campos booleanos obligatorios e independientes en RegisterAdminDto. Criterio de aceptacion de epica_input.yaml incorporado. |
| Ley 527/1999 | LegalAcceptance es inmutable. Campos de version de documento en RegisterAdminDto para trazabilidad. |
| Ley 1273/2009 | invitationToken en body (no path/header) en TODOS los endpoints que reciben token — anti-access-log. Anti-enumeracion: 404 igual para tokens inexistentes y adulterados en POST /admin-invitations/verify. Token generado con CSPRNG (256 bits). Patron POST para verificacion consistente con OAuth 2.0 Token Introspection (RFC 7662). |
| OWASP Forgot Password Cheat Sheet | Token de un solo uso, invalidacion atomica en $transaction, CSPRNG con minimo 128 bits de entropia. |

---

## Eventos emitidos

| Evento | Emitido desde | Proposito |
|--------|--------------|-----------|
| `admin.invitation.created` | POST /admin-invitations | Listener en notifications construye y envia correo con token RAW |
| `user.registered` | POST /auth/admin/register | Notificar registro exitoso (listener existente de EPICA-01) |

NOTA: El token RAW del evento `admin.invitation.created` NUNCA se loggea en el listener
(Ley 1273/2009). El listener captura errores de envio en try/catch sin propagar al pipeline HTTP.

---

## Checklist de consistencia plan-contrato

- [x] Todos los 3 endpoints HTTP del plan tienen su metodo en el controller
- [x] HU-001 (seed) NO tiene endpoint HTTP — documentado correctamente
- [x] Todos los errores del plan tienen su @ApiProblemResponse
  - POST /admin-invitations: 400, 401, 403, 409
  - POST /admin-invitations/verify: 400, 404, 409, 422
  - POST /auth/admin/register: 400, 404, 409, 422
- [x] Todos los DTOs referenciados en el plan tienen su archivo
  - CreateAdminInvitationDto, AdminInvitationResponseDto
  - VerifyAdminInvitationDto, AdminInvitationStatusResponseDto
  - RegisterAdminDto, AdminRegistrationResponseDto
- [x] Ningun DTO de respuesta expone tokenHash, invitedBy, tokenUsedAt, passwordHash, archivedAt
- [x] JwtAuthGuard + RolesGuard(ADMIN) aplicados en AdminInvitationsController (controller-level)
- [x] POST /admin-invitations/verify usa security: [] en @ApiOperation (endpoint publico, Spectral)
- [x] POST /auth/admin/register usa security: [] en @ApiOperation (endpoint publico, Spectral)
- [x] Imports de Prisma desde 'generated/prisma' con ruta relativa correcta para src/modules/auth/
  - DTOs usan: '../../../../generated/prisma/index.js'
  - Controller usa: '../../../generated/prisma/index.js'
- [x] acceptsHabeasData y acceptsTermsOfService son campos OBLIGATORIOS en RegisterAdminDto
  (condicion bloqueante HU-003 del Analista de Producto — reporte_validacion_negocio.yaml)
- [x] acceptsTermsOfService y termsDocumentVersion presentes en RegisterAdminDto
- [x] acceptsHabeasData y personalDataDocumentVersion presentes en RegisterAdminDto
- [x] invitationToken en body (no path param) — decision arquitectonica EPICA-09
- [x] AdminRegistrationResponseDto es DTO propio (no reutiliza AthleteRegistrationResponseDto)
- [x] Estado de AdminInvitation es DERIVADO (no campo persistido) — documentado en DTO
- [x] POST /admin-invitations/verify usa @Body() con VerifyAdminInvitationDto — token en body, no en URL (RFC 7662, Ley 1273/2009)
- [x] POST /admin-invitations/verify incluye @ApiProblemResponse(400) para validacion de token

---

## Prerequisito bloqueante (schema)

El Desarrollador no puede iniciar hasta que el humano ejecute:

```bash
pnpm prisma migrate dev
```

Con el nuevo modelo en schema.prisma (decision arquitectonica EPICA-09):

```prisma
model AdminInvitation {
  id           String    @id @default(uuid())
  email        String
  tokenHash    String    @unique @map("token_hash")
  invitedBy    String    @map("invited_by")
  expiresAt    DateTime  @map("expires_at")
  tokenUsedAt  DateTime? @map("token_used_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([email])
  @@map("admin_invitations")
}
```

Sin `updatedAt` — semantica append-only. Sin enum de estado — el estado es derivado en el service.

---

## Nuevos BusinessError requeridos

Agregar a `src/modules/common/exceptions/business-error.enum.ts`:

```typescript
INVITATION_EXPIRED    = 'INVITATION_EXPIRED',      // 422 UNPROCESSABLE_ENTITY
INVITATION_ALREADY_USED = 'INVITATION_ALREADY_USED', // 409 CONFLICT
```

---

## Variables de entorno nuevas

Agregar a `.env.example`:

```
# EPICA-09: Seed del administrador inicial
ADMIN_SEED_EMAIL=
ADMIN_SEED_NAME=
ADMIN_SEED_PASSWORD=

# EPICA-09: Configuracion de invitaciones de administrador
ADMIN_INVITE_EXPIRATION_HOURS=48
```
