---
name: api-first
description: Convenciones API First para fitmess-api. Cargar al diseñar o documentar endpoints, contratos OpenAPI, decoradores Swagger, o DTOs de respuesta. Cubre el flujo de diseño antes de código, decoradores NestJS/Swagger, ApiProblemResponse y convenciones de naming.
---

# API First — fitmess-api

El contrato OpenAPI se define y aprueba **antes** de escribir código. El Desarrollador implementa estrictamente contra ese contrato.

> Regla absoluta: `@ApiProblemResponse(status, description)` en todos los endpoints → ver `.claude/rules/rulesArquitectura.md`

---

## 1. Flujo API First

```
1. Arquitecto genera Plan de Implementacion (YAML)
         ↓
2. Documentador genera contrato OpenAPI via decoradores NestJS
         ↓
3. ⚠️ Checkpoint humano — aprueba contrato
         ↓
4. Desarrollador implementa contra el contrato aprobado
         ↓
5. Lider Tecnico valida consistencia codigo ↔ contrato
```

**Regla critica:** Si durante la implementacion se detecta que el contrato debe cambiar, el Desarrollador **no modifica el contrato unilateralmente**. Escala al Lider Tecnico, quien escala al humano para aprobacion.

---

## 2. ApiProblemResponse — decorador de errores RFC 9457

Todos los endpoints documentan sus errores con este decorador. Se define en `src/modules/common/swagger/`:

```typescript
// src/modules/common/swagger/error-responses.ts
import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { ProblemDetailDto } from './error-responses'; // clase en el mismo directorio

export const ApiProblemResponse = (status: number, description: string) =>
  applyDecorators(
    ApiExtraModels(ProblemDetailDto),
    ApiResponse({
      status,
      description,
      content: {
        'application/problem+json': {
          schema: { $ref: getSchemaPath(ProblemDetailDto) },
        },
      },
    }),
  );
```

> `ProblemDetailDto` (clase con `@ApiProperty()`) y `ApiProblemResponse` viven juntos en `src/modules/common/swagger/error-responses.ts`. La interface `ProblemDetail` (runtime, sin decoradores) vive aparte en `src/modules/common/exceptions/problem-detail.dto.ts`. Ver definicion de la clase en [references/api-contract-patterns.md §2](references/api-contract-patterns.md).

**Errores estandar a documentar siempre:**

| Status | Cuando documentarlo |
|---|---|
| 400 | Endpoints con Body o Query que validan DTOs |
| 401 | Todos los endpoints autenticados |
| 403 | Cuando hay RolesGuard, ResourcePolicyGuard o temporal guards |
| 404 | Cuando se busca una entidad por ID |
| 409 | State machine, duplicados, suscriptores activos |
| 422 | Reglas de negocio (plan incompleto, semana no cerrada, etc.) |

---

## 3. Decoradores por operacion — resumen

| Operacion | Decoradores obligatorios |
|---|---|
| Crear (POST) | `@ApiOperation`, `@ApiResponse(201, type)`, `@ApiProblemResponse(400,401,403)` |
| Listar (GET) | `@ApiOperation`, `@ApiResponse(200, type)`, `@ApiProblemResponse(401)` |
| Detalle (GET :id) | `@ApiOperation`, `@ApiResponse(200, type)`, `@ApiProblemResponse(401,403,404)` |
| Actualizar (PATCH :id) | `@ApiOperation`, `@ApiResponse(200, type)`, `@ApiProblemResponse(400,401,403,404)` |
| Estado (POST :id/action) | `@ApiOperation`, `@ApiResponse(200, type)`, `@ApiProblemResponse(401,403,404,409,422)` |
| Archivar (DELETE :id) | `@ApiOperation`, `@ApiResponse(200)`, `@ApiProblemResponse(401,403,404,409)` |

Plantilla completa de controller con 5 endpoints → [references/api-contract-patterns.md](references/api-contract-patterns.md)

---

## 4. DTOs de respuesta — que exponer y que ocultar

```typescript
// plan-response.dto.ts
export class PlanResponseDto {
  @ApiProperty({ description: 'ID del plan' })
  id: string;

  @ApiProperty({ description: 'Nombre del plan' })
  name: string;

  @ApiProperty({ enum: PlanStatus, description: 'Estado actual del plan' })
  status: PlanStatus;

  @ApiProperty({ description: 'Fecha de inicio', example: '2026-03-01' })
  startDate: string;

  @ApiProperty({ description: 'Fecha de fin', example: '2026-04-30' })
  endDate: string;

  @ApiProperty({ description: 'Fecha de creacion' })
  createdAt: Date;
}
```

**Campos que NUNCA van en DTOs de respuesta** (alineado con `.claude/rules/rulesArquitectura.md`):
- `archivedAt` — campo interno de soft-delete
- passwords, tokens, refresh tokens
- datos sensibles de salud (RPE, dolor, motivacion) en DTOs genericos
- campos internos de auditoria no relevantes para el cliente

---

## 5. Convenciones de naming de endpoints

| Operacion | Metodo | Ruta | Ejemplo |
|---|---|---|---|
| Listar | GET | `/[recursos]` | `GET /plans` |
| Detalle | GET | `/[recursos]/:id` | `GET /plans/:id` |
| Crear | POST | `/[recursos]` | `POST /plans` |
| Actualizar parcial | PATCH | `/[recursos]/:id` | `PATCH /plans/:id` |
| Archivar (soft-delete) | DELETE | `/[recursos]/:id` | `DELETE /plans/:id` |
| Accion de estado | POST | `/[recursos]/:id/[accion]` | `POST /plans/:id/publish` |
| Sub-recurso | GET/POST | `/[recursos]/:id/[sub]` | `GET /plans/:id/sessions` |

**Reglas:**
- Siempre en ingles y en plural (`/plans`, `/exercises`, `/subscriptions`)
- Las acciones de state machine son verbos: `/publish`, `/unpublish`, `/finalize`, `/archive`
- IDs siempre validados con `ParseUUIDPipe`

---

## 6. Configuracion Swagger en main.ts

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Fitmess API')
  .setDescription('API para plataforma de entrenamiento personalizado')
  .setVersion('1.0')
  .addBearerAuth()
  .addServer('http://localhost:3000', 'Local')
  .addServer('https://api.fitmess.co', 'Produccion')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document, {
  swaggerOptions: {
    persistAuthorization: true,
  },
});
```

---

## 7. Patrones detallados

Plantilla completa de controller y formato YAML del Plan de Implementacion → [references/api-contract-patterns.md](references/api-contract-patterns.md)

---

## 8. Validación automática con Spectral

El contrato OpenAPI generado se valida con Spectral contra reglas específicas del proyecto (`.spectral.yaml`).

**Quién ejecuta:** El QA como paso 5.6 de su validación.
**Quién analiza:** El Líder Técnico en su revisión (Paso 1.5).
**Manual:** El humano puede correr `pnpm run openapi:validate` en cualquier momento.

Reglas principales:
- `fitmess-error-content-type` — todas las respuestas 4xx/5xx usan `application/problem+json`
- `fitmess-no-internal-fields` — 6 campos prohibidos en DTOs (extensible vía `then`-array)
- `fitmess-auth-401-operation` — endpoints con `@ApiBearerAuth()` documentan 401
- `fitmess-path-conventions` — rutas siguen convención lowercase/inglés/camelCase

**Endpoints públicos:** Deben usar `security: []` en el contrato para excluirse de las reglas de autenticación. Ejemplos: `/auth/login`, `/auth/register`.

Detalle completo → `.spectral.yaml` en la raíz del proyecto.
Definición de la propuesta → `.claude/docs/definiciones/Pendiente-spectral.md`
