---
name: error-handling
description: Manejo de errores en fitmess-api. Cargar al implementar o revisar excepciones, exception filters, o respuestas de error. Cubre BusinessException, TechnicalException, catalogos de error, 4 exception filters RFC 9457 y su registro en main.ts.
---

# Error Handling — fitmess-api

Basado en **RFC 9457 Problem Details for HTTP APIs**.

> Las reglas absolutas de este dominio estan en `.claude/rules/rulesCodigo.md`. Este skill aporta el como implementarlas.

---

## 1. Arquitectura — 2 excepciones + enums como catalogo

```
src/modules/common/
  exceptions/
    error-catalog.interface.ts      <- Interface compartida { code, title, httpStatus }
    business-error.enum.ts          <- Catalogo de errores de negocio
    technical-error.enum.ts         <- Catalogo de errores tecnicos
    business.exception.ts           <- Clase generica BusinessException
    technical.exception.ts          <- Clase generica TechnicalException
    problem-detail.dto.ts           <- Interface RFC 9457 (runtime, sin decoradores Swagger)
  filters/
    problem-detail.filter.ts        <- Business + Technical -> RFC 9457
    prisma-exception.filter.ts      <- Prisma errors -> RFC 9457
    validation-exception.filter.ts  <- class-validator -> RFC 9457
    global-exception.filter.ts      <- Catch-all -> RFC 9457
  swagger/
    error-responses.ts              <- ProblemDetailDto clase Swagger + ApiProblemResponse decorator
```

---

## 2. Interfaces base

```typescript
// src/modules/common/exceptions/error-catalog.interface.ts
export interface ErrorCatalogEntry {
  code: string;        // UPPER_SNAKE_CASE — identificador maquina
  title: string;       // Mensaje estable — NO cambia entre ocurrencias
  httpStatus: number;  // HTTP status code por defecto
}

// src/modules/common/exceptions/problem-detail.dto.ts
export interface ProblemDetail {
  type: string;           // URI del tipo de error
  title: string;          // Resumen estable (del enum)
  status: number;         // HTTP status code
  detail: string;         // Descripcion especifica de esta ocurrencia
  instance?: string;      // Path del request
  errorCode: string;      // Codigo maquina (del enum)
  correlationId?: string; // UUID del request
  timestamp: string;      // ISO 8601
  context?: Record<string, unknown>; // Datos adicionales para debugging
  errors?: { field: string; message: string }[]; // Solo para validacion
}
```

---

## 3. Clases de excepcion y catalogos

Implementacion completa de `BusinessException`, `TechnicalException`, `BusinessError` y `TechnicalError` en [references/error-catalogs.md](references/error-catalogs.md).

---

## 4. Uso en services

```typescript
import { BusinessException } from '../common/exceptions/business.exception';
import { BusinessError } from '../common/exceptions/business-error.enum';
import { TechnicalException } from '../common/exceptions/technical.exception';
import { TechnicalError } from '../common/exceptions/technical-error.enum';

// -- Errores de negocio -------------------------------------------------------

// Entidad no encontrada
throw new BusinessException(
  BusinessError.ENTITY_NOT_FOUND,
  `Plan con id '${planId}' no fue encontrado`,
  { entity: 'Plan', identifier: planId },
);

// State machine
throw new BusinessException(
  BusinessError.INVALID_STATE_TRANSITION,
  `No se puede transicionar Plan de '${plan.status}' a 'PUBLISHED'`,
  { entity: 'Plan', currentState: plan.status, targetState: 'PUBLISHED' },
);

// Semana congelada
throw new BusinessException(
  BusinessError.WEEK_FROZEN,
  `La semana ${weekNumber} esta cerrada y no acepta modificaciones`,
  { weekNumber, instanceId },
);

// Ownership
throw new BusinessException(
  BusinessError.RESOURCE_OWNERSHIP_DENIED,
  `El coach ${coachId} no tiene acceso al atleta ${athleteId}`,
  { resource: 'athlete', resourceId: athleteId },
);

// Plan incompleto (RN-01)
throw new BusinessException(
  BusinessError.PLAN_INCOMPLETE,
  'El plan debe tener nombre, fechas y al menos una sesion con un ejercicio',
  { planId, missingFields: ['sessions'] },
);

// -- Errores tecnicos ---------------------------------------------------------

try {
  const response = await this.anthropic.messages.create({ ... });
} catch (error) {
  if (error.status === 529 || error.code === 'ETIMEDOUT') {
    throw new TechnicalException(
      TechnicalError.AI_SERVICE_TIMEOUT,
      `Claude API no respondio en el tiempo esperado`,
      { model: 'claude-sonnet-4-5', timeout: 30000 },
      error, // originalError — se loggea pero NUNCA se expone al cliente
    );
  }
  throw new TechnicalException(
    TechnicalError.AI_SERVICE_ERROR,
    `Error inesperado de Claude API`,
    { model: 'claude-sonnet-4-5' },
    error,
  );
}
```

---

## 5. Exception Filters — orden de registro

NestJS ejecuta los filters en orden **LIFO** (ultimo registrado = mayor prioridad). Registrar en `main.ts` en este orden exacto:

```typescript
app.useGlobalFilters(
  new GlobalExceptionFilter(),       // Catch-all (menor prioridad)
  new PrismaExceptionFilter(),       // Errores de Prisma
  new ValidationExceptionFilter(),   // class-validator -> BadRequestException
  new ProblemDetailFilter(),         // Business + Technical (mayor prioridad)
);
```

| Filter | Captura | HTTP status |
|---|---|---|
| `ProblemDetailFilter` | `BusinessException`, `TechnicalException` | El del enum |
| `ValidationExceptionFilter` | `BadRequestException` con array de mensajes | 400 |
| `PrismaExceptionFilter` | `Prisma.PrismaClientKnownRequestError` | Segun codigo Prisma |
| `GlobalExceptionFilter` | Todo lo demas | 500 |

**Mapa de codigos Prisma:**

| Codigo Prisma | Error mapeado | HTTP |
|---|---|---|
| P2000 | `TechnicalError.DATABASE_INVALID_DATA` | 422 |
| P2002 | `BusinessError.DUPLICATE_ENTITY` | 409 |
| P2003 | `TechnicalError.DATABASE_FK_VIOLATION` | 422 |
| P2025 | `BusinessError.ENTITY_NOT_FOUND` | 404 |

---

## 6. Formato de respuesta de error (RFC 9457)

```json
{
  "type": "https://api.fitmess.co/errors/INVALID_STATE_TRANSITION",
  "title": "Transicion de estado no permitida",
  "status": 409,
  "detail": "No se puede transicionar Plan de 'ARCHIVED' a 'PUBLISHED'",
  "instance": "/api/plans/550e8400/publish",
  "errorCode": "INVALID_STATE_TRANSITION",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-03-15T14:30:45.123Z",
  "context": {
    "entity": "Plan",
    "currentState": "ARCHIVED",
    "targetState": "PUBLISHED"
  }
}
```

**Diferencia `title` vs `detail`:**
- `title`: estable, del enum, no cambia entre ocurrencias del mismo error
- `detail`: especifico de esta ocurrencia, incluye IDs, valores y contexto concreto

---

## 7. Listeners — manejo especial

```typescript
@OnEvent('plan.published')
async handlePlanPublished(event: PlanPublishedEvent): Promise<void> {
  try {
    await this.notificationService.notifyAthletes(event.planId);
  } catch (error) {
    this.logger.error(`Error al notificar atletas del plan ${event.planId}`, error);
  }
}
```
