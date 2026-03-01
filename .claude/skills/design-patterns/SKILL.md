---
name: design-patterns
description: Patrones de diseño para fitmess-api. Cargar al implementar state machines, guards temporales, deep copy de instancias, versionado de ejercicios, soft-delete, audit trail, resource policies, o logging estructurado. Cubre 9 patrones prescriptivos del proyecto.
---

# Design Patterns — fitmess-api

> Reglas absolutas → `.claude/rules/`. Excepciones y filters → skill `error-handling`. Estructura de modulos y DTOs → skill `nestjs-conventions`.

---

## 1. Inventario de patrones

| # | Patron | Categoria | Detalle en |
|---|--------|-----------|------------|
| 1 | State Machine | Comportamiento | [behavior-patterns.md](references/behavior-patterns.md) |
| 2 | Strategy (Resource Policies) | Comportamiento | [behavior-patterns.md](references/behavior-patterns.md) |
| 3 | Temporal Guards | Comportamiento | [behavior-patterns.md](references/behavior-patterns.md) |
| 4 | Template Method (Deep Copy) | Comportamiento | [behavior-patterns.md](references/behavior-patterns.md) |
| 5 | Append-Only / Versioning | Datos | [data-patterns.md](references/data-patterns.md) |
| 6 | Soft-Delete | Datos | [data-patterns.md](references/data-patterns.md) |
| 7 | Frozen Flag | Datos | [data-patterns.md](references/data-patterns.md) |
| 8 | Audit Trail | Datos | [data-patterns.md](references/data-patterns.md) |
| 9 | Logging Estructurado | Observabilidad | [observability.md](references/observability.md) |

---

## 2. State Machine

Dos maquinas de estado. Implementacion: enum en Prisma + metodo por transicion que valida precondiciones.

**Plan Lifecycle:**

```
DRAFT ──publish──→ PUBLISHED ──finalize──→ FINALIZED ──archive──→ ARCHIVED
  ↑                    │
  └──unpublish─────────┘ (solo sin suscriptores)
```

| Estado | Visible atletas | Inscripciones | Resultados | Editable coach |
|--------|:-:|:-:|:-:|:-:|
| DRAFT | No | No | No | Si |
| PUBLISHED | Si | Si | Si | No (inmutable) |
| FINALIZED | No | No | Si (pendientes) | No |
| ARCHIVED | No | No | No | No |

**Subscription Lifecycle:**

```
PENDING ──approve──→ APPROVED ──request_consent──→ CONSENT_PENDING ──accept──→ ACTIVE
  │
  └──reject──→ REJECTED
```

Implementacion completa → [references/behavior-patterns.md](references/behavior-patterns.md)

---

## 3. Authorization — RBAC + Resource Policies

Dos capas apiladas:
1. **RBAC**: `@Roles(UserRole.COACH)` — verifica rol
2. **Policy**: `@Policy(AthleteProgressPolicy)` — verifica ownership del recurso

```typescript
export interface ResourcePolicy {
  canAccess(userId: string, resourceId: string): Promise<boolean>;
}
```

Implementacion de `ResourcePolicyGuard` y policies → [references/behavior-patterns.md](references/behavior-patterns.md)

---

## 4. Temporal Guards

| Guard | Protege | Excepcion |
|-------|---------|-----------|
| `WeekFrozenGuard` | Resultados de semanas cerradas | `BusinessError.WEEK_FROZEN` |
| `WeekStartedGuard` | Instancias ya iniciadas por atleta | `BusinessError.WEEK_STARTED` |
| `EditWindowGuard` | Resultados fuera de ventana 7 dias | `BusinessError.EDIT_WINDOW_EXPIRED` |
| `PlanPublishedGuard` | Planes publicados (inmutables) | `BusinessError.PLAN_IMMUTABLE` |

Implementacion → [references/behavior-patterns.md](references/behavior-patterns.md)

---

## 5. Patrones de datos

### Append-Only / Versioning (Ejercicios)

```
Exercise (id, name, isActive)
  └── ExerciseVersion (id, exerciseId, versionNumber, description, muscleGroup)
       └── Referenciado por InstanceBlock.exerciseVersionId
```

- Ejercicio NO usado en plan → edicion directa
- Ejercicio usado en plan → nueva ExerciseVersion

### Soft-Delete

Columna `archivedAt DateTime?` en: Plan, Subscription, SessionResult.
Queries filtran `archivedAt: null` automaticamente via Prisma middleware.

> **Convencion:** Usar `archivedAt` (no `deletedAt`) — alinea con la semantica del dominio (planes se "archivan", no se "borran"). Para ejercicios, usar `isActive` (Boolean).

### Frozen Flag

`WeekClosure (instanceId, weekNumber, isFrozen, closedAt)` — al completar ultima sesion de semana, `isFrozen = true` + evento `week.closed`.

### Audit Trail

- `AuditInterceptor`: captura POST/PUT/PATCH/DELETE con userId, ip, correlationId, duration
- `legal_acceptances`: registro inmutable de habeas data, consentimiento deportivo (Ley 1581/2012)

Implementacion completa → [references/data-patterns.md](references/data-patterns.md)

---

## 6. Logging Estructurado

Stack: `nestjs-pino` (Pino) + `pino-pretty` (dev) + `CorrelationIdMiddleware`.

```
Header x-correlation-id → CorrelationIdMiddleware → req.correlationId
  → nestjs-pino (req.id) → AuditInterceptor → ExceptionFilters → Response header
```

Configuracion, niveles y redaction → [references/observability.md](references/observability.md)

---

## 7. Catalogo de eventos

Tabla autoritativa de todos los eventos del sistema. Convencion: `[entidad].[accion]` en minusculas, dot notation. Acciones multi-palabra usan underscore (`password_reset`).

| Evento | Emisor | Listeners |
|--------|--------|-----------|
| `plan.published` | plans | notifications |
| `plan.archived` | plans | subscriptions, execution |
| `plan.finalized` | plans | subscriptions |
| `subscription.requested` | subscriptions | notifications |
| `subscription.approved` | subscriptions | execution (deep copy), notifications |
| `subscription.cancelled` | subscriptions | plans, notifications |
| `week.closed` | execution | ai, metrics |
| `execution.completed` | execution | metrics, ai |
| `ai.recommendation.approved` | ai | execution |
| `coach.request.created` | auth | notifications |
| `user.registered` | auth | notifications |
| `user.password_reset` | auth | notifications |

Para patrones de emision y listeners → skill `nestjs-conventions`.

---

## 8. Patrones descartados

| Patron | Razon |
|--------|-------|
| CQRS | Escala MVP (~23 usuarios) no lo justifica |
| Event Sourcing | Append-only + frozen flags cubren inmutabilidad |
| Generic Repository | Queries demasiado especificas por dominio |
| Specification Pattern | Prisma `where` clauses suficientes |
| Saga Pattern | Sin microservicios; `$transaction` de Prisma basta |
| XState | 2 state machines simples; enum + metodos es mas claro |
