# Contrato OpenAPI — EPICA-01 v1.1

Generado por el Documentador. Entrada del Desarrollador.

## Estructura de archivos

```
outputs/contrato_openapi/src/modules/auth/
  enums/
    identification-type.enum.ts          — IdentificationType: CC, CE, NIT, PASAPORTE, PPT, PEP
    coach-request-status.enum.ts         — CoachRequestStatus: PENDING, APPROVED, REJECTED
  dto/
    register-coach.dto.ts                — HU-001: entrada POST /auth/coaches/register
    register-athlete.dto.ts              — HU-003: entrada POST /auth/register
    login.dto.ts                         — HU-004: entrada POST /auth/login
    search-coach-requests.dto.ts         — HU-002: entrada POST /coach-requests/search
    reject-coach-request.dto.ts          — HU-002: entrada POST /coach-requests/:id/reject
    coach-request-response.dto.ts        — HU-001, HU-002: respuesta base de CoachRequest
    coach-request-detail-response.dto.ts — HU-002: respuesta detallada GET /coach-requests/:id
    athlete-registration-response.dto.ts — HU-003: respuesta POST /auth/register
    auth-token-response.dto.ts           — HU-004: respuesta POST /auth/login
  auth.controller.ts                     — HU-001, HU-003, HU-004 (endpoints publicos /auth)
  coach-requests.controller.ts           — HU-002 (endpoints admin /coach-requests)
```

## Destino en el proyecto

Copiar al modulo auth del proyecto:

```
src/modules/auth/
```

## Notas para el Desarrollador

- Los metodos de los controllers son stubs con `throw new Error('Not implemented')`.
  Descomentar las inyecciones de dependencia e implementar la logica en los services.
- Los guards (@UseGuards) estan comentados en los controllers. Activarlos al implementar.
- Imports de Prisma deben venir de `generated/prisma`, nunca de `@prisma/client`.
- Los endpoints publicos usan `@ApiSecurity([])` para que Spectral no exija 401.
- El enum `IdentificationType` debe agregarse al schema Prisma antes de implementar.
