# Patrones de Comportamiento — Implementacion completa

Referencia de implementacion para state machines, authorization policies, temporal guards y deep copy.

## Tabla de contenido

1. [State Machine — Plan Lifecycle](#1-state-machine--plan-lifecycle)
2. [State Machine — Subscription Lifecycle](#2-state-machine--subscription-lifecycle)
3. [Strategy — Resource Policies](#3-strategy--resource-policies)
4. [Temporal Guards](#4-temporal-guards)
5. [Template Method — Deep Copy de Instancias](#5-template-method--deep-copy-de-instancias)

---

## 1. State Machine — Plan Lifecycle

Cada transicion es un metodo que valida precondiciones y lanza `BusinessException` si no se cumplen.

```typescript
// plans.service.ts
import { BusinessException } from '../common/exceptions/business.exception';
import { BusinessError } from '../common/exceptions/business-error.enum';

async publish(planId: string, coachId: string): Promise<Plan> {
  const plan = await this.findOwnedOrFail(planId, coachId);

  if (plan.status !== PlanStatus.DRAFT) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede publicar el plan '${planId}' desde estado '${plan.status}'`,
      { entity: 'Plan', currentState: plan.status, targetState: 'PUBLISHED' },
    );
  }

  this.validatePlanCompleteness(plan);

  // Una sola escritura: no hay tabla de historial de plan. El estado vive en la
  // columna `status` y el rastro de quien hizo que queda en `audit_logs`
  // (AuditMiddleware). Sin una segunda operacion, `$transaction` no aporta nada.
  const updated = await this.prisma.plan.update({
    where: { id: planId },
    data: { status: PlanStatus.PUBLISHED },
  });

  // Evento DESPUES del commit
  this.eventEmitter.emit('plan.published', new PlanPublishedEvent(planId, coachId));

  return updated;
}

async unpublish(planId: string, coachId: string): Promise<Plan> {
  const plan = await this.findOwnedOrFail(planId, coachId);

  if (plan.status !== PlanStatus.PUBLISHED) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede despublicar el plan '${planId}' desde estado '${plan.status}'`,
      { entity: 'Plan', currentState: plan.status, targetState: 'DRAFT' },
    );
  }

  // Cuenta APPROVED o ACTIVE, NUNCA PENDING (decision del humano,
  // EPICA-04): una solicitud sin responder no es un suscriptor — el propio
  // coach puede rechazarla en el mismo momento en que intenta despublicar,
  // asi que bloquearlo por ella no tiene sentido de negocio. Un
  // `{ not: REJECTED }` incluiria las Pendientes y compila igual: es un
  // error silencioso que solo detecta un test que cree una suscripcion
  // Pendiente y verifique que la despublicacion SI procede.
  const subscriberCount = await this.prisma.subscription.count({
    where: {
      planId,
      status: { in: [SubscriptionStatus.APPROVED, SubscriptionStatus.ACTIVE] },
    },
  });

  if (subscriberCount > 0) {
    throw new BusinessException(
      BusinessError.PLAN_HAS_SUBSCRIBERS,
      `No se puede despublicar el plan '${planId}' con ${subscriberCount} suscriptores activos`,
      { planId, subscriberCount },
    );
  }

  return this.prisma.plan.update({
    where: { id: planId },
    data: { status: PlanStatus.DRAFT },
  });
}

async finalize(planId: string, coachId: string): Promise<Plan> {
  const plan = await this.findOwnedOrFail(planId, coachId);

  if (plan.status !== PlanStatus.PUBLISHED) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede finalizar el plan '${planId}' desde estado '${plan.status}'`,
      { entity: 'Plan', currentState: plan.status, targetState: 'FINALIZED' },
    );
  }

  const updated = await this.prisma.plan.update({
    where: { id: planId },
    data: { status: PlanStatus.FINALIZED },
  });

  this.eventEmitter.emit('plan.finalized', new PlanFinalizedEvent(planId));

  return updated;
}

// Helper reutilizable — valida existencia + ownership
private async findOwnedOrFail(planId: string, coachId: string): Promise<Plan> {
  // Plan NO tiene `archivedAt`: "archivado" es uno de los cuatro valores de
  // PlanStatus (RN-27), no una columna de soft-delete. Un plan archivado se
  // sigue leyendo por id; lo que cambia es que no aparece en el catalogo.
  const plan = await this.prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new BusinessException(
      BusinessError.ENTITY_NOT_FOUND,
      `El plan con id '${planId}' no existe`,
      { entity: 'Plan', identifier: planId },
    );
  }

  if (plan.coachId !== coachId) {
    throw new BusinessException(
      BusinessError.RESOURCE_OWNERSHIP_DENIED,
      `El coach '${coachId}' no tiene acceso al plan '${planId}'`,
      { resource: 'Plan', resourceId: planId },
    );
  }

  return plan;
}
```

**Enum de estados en Prisma schema:**

```prisma
enum PlanStatus {
  DRAFT
  PUBLISHED
  FINALIZED
  ARCHIVED
}
```

**Metodo de validacion de completitud:**

```typescript
// La jerarquia es Plan -> Phase -> Week -> Session -> SessionExercise
// (decision del humano del 2026-08-20). La semana es una entidad propia, no un
// campo calculado: EPICA-05 le cuelga estado (cierre automatico RN-30,
// inmutabilidad tras iniciarse RN-33, congelamiento para la IA RN-09).
// RN-01 exige que la validez atraviese los cuatro niveles.
private validatePlanCompleteness(plan: PlanWithTree): void {
  const issues: string[] = [];

  if (!plan.name) issues.push('nombre');
  if (!plan.startDate) issues.push('fecha de inicio');
  if (!plan.endDate) issues.push('fecha de fin');

  const weeks = plan.phases?.flatMap((p) => p.weeks ?? []) ?? [];
  const sessions = weeks.flatMap((w) => w.sessions ?? []);

  if (!plan.phases?.length) issues.push('al menos una fase');
  else if (!weeks.length) issues.push('al menos una semana en una fase');
  else if (!sessions.length) issues.push('al menos una sesion en una semana');

  const hasExercises = sessions.some((s) => s.exercises && s.exercises.length > 0);
  if (sessions.length && !hasExercises) issues.push('al menos un ejercicio en una sesion');

  if (issues.length > 0) {
    throw new BusinessException(
      BusinessError.PLAN_INCOMPLETE,
      `El plan debe tener: ${issues.join(', ')}`,
      { planId: plan.id, missingFields: issues },
    );
  }
}
```

---

## 2. State Machine — Subscription Lifecycle

```typescript
// subscriptions.service.ts

async approve(subscriptionId: string, coachId: string): Promise<Subscription> {
  const sub = await this.findOrFail(subscriptionId);

  if (sub.status !== SubscriptionStatus.PENDING) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede aprobar la suscripcion '${subscriptionId}' desde estado '${sub.status}'`,
      { entity: 'Subscription', currentState: sub.status, targetState: 'APPROVED' },
    );
  }

  // reviewedAt/reviewedBy, no `approvedAt`: los escriben JUNTOS approve() y
  // reject(), porque son la misma pregunta ("quien decidio y cuando") con
  // dos respuestas posibles.
  const updated = await this.prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedBy: coachId,
    },
  });

  this.eventEmitter.emit(
    'subscription.approved',
    new SubscriptionApprovedEvent(subscriptionId, sub.planId, sub.athleteId, coachId),
  );

  return updated;
}

// Sin parametro `reason`: ninguna CA de HU-013 pide capturar un motivo de
// rechazo, a diferencia de CoachRequest.rejectionReason de EPICA-01. El
// modelo Subscription NO tiene esa columna.
async reject(subscriptionId: string, coachId: string): Promise<Subscription> {
  const sub = await this.findOrFail(subscriptionId);

  if (sub.status !== SubscriptionStatus.PENDING) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede rechazar la suscripcion '${subscriptionId}' desde estado '${sub.status}'`,
      { entity: 'Subscription', currentState: sub.status, targetState: 'REJECTED' },
    );
  }

  const updated = await this.prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: coachId,
    },
  });

  this.eventEmitter.emit(
    'subscription.rejected',
    new SubscriptionRejectedEvent(subscriptionId, sub.planId, sub.athleteId),
  );

  return updated;
}

// APPROVED -> ACTIVE. NO hay estado intermedio: "esperando consentimiento"
// es `status = APPROVED` con `activatedAt = null`, no un valor del enum.
async acceptConsent(
  subscriptionId: string,
  athleteId: string,
  documentVersion: string,
  ip: string,
  userAgent: string,
): Promise<Subscription> {
  const sub = await this.findOwnOrFail(subscriptionId, athleteId);

  if (sub.status !== SubscriptionStatus.APPROVED) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede aceptar el consentimiento de la suscripcion '${subscriptionId}' desde estado '${sub.status}'`,
      { entity: 'Subscription', currentState: sub.status, targetState: 'ACTIVE' },
    );
  }

  // El plan debe seguir VIGENTE (CA-014-8). No basta con leer la columna:
  // un plan con status PUBLISHED y endDate pasada esta efectivamente
  // Finalizado, y la columna solo se corrige cuando el propio coach lee su
  // plan. Un `plan.status !== PUBLISHED` a secas deja pasar justo ese caso.
  if (!this.isPlanCurrentlyPublished(sub.plan)) {
    throw new BusinessException(
      BusinessError.PLAN_NOT_PUBLISHED,
      `El plan '${sub.planId}' ya no esta vigente`,
      { planId: sub.planId },
    );
  }

  // Atomico: la aceptacion legal y la activacion son un solo hecho.
  const [, updated] = await this.prisma.$transaction([
    this.prisma.legalAcceptance.create({
      data: {
        userId: athleteId,
        documentType: DocumentType.SPORT_CONSENT,
        documentVersion,
        planId: sub.planId,
        ip,
        userAgent,
      },
    }),
    this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE, activatedAt: new Date() },
    }),
  ]);

  this.eventEmitter.emit(
    'subscription.activated',
    new SubscriptionActivatedEvent(subscriptionId, sub.planId, athleteId),
  );

  return updated;
}
```

`SubscriptionStatus` tiene **cuatro** valores y se importa SIEMPRE desde
`generated/prisma` — nunca se redefine aqui ni en ningun modulo
(`rulesCodigo § Enums`):

```typescript
import { SubscriptionStatus } from '../../../generated/prisma/index.js';
// PENDING | APPROVED | REJECTED | ACTIVE
```

No existe un `CONSENT_PENDING`: la espera del consentimiento ya es
observable como `status = APPROVED` con `activatedAt = null`. Agregar ese
quinto valor romperia ademas el indice unico parcial de `subscriptions`,
cuyo `WHERE status IN ('PENDING','APPROVED','ACTIVE')` no lo cubriria — una
fila parada ahi escaparia de la unicidad y el mismo atleta podria abrir una
segunda suscripcion viva al mismo plan.

---

## 3. Strategy — Resource Policies

Dos capas de autorizacion apiladas: RBAC (rol) + Policy (ownership).

```typescript
// src/modules/common/guards/resource-policy.guard.ts
import { BusinessException } from '../exceptions/business.exception';
import { BusinessError } from '../exceptions/business-error.enum';

export interface ResourcePolicy {
  canAccess(userId: string, resourceId: string): Promise<boolean>;
}

@Injectable()
export class ResourcePolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyClass = this.reflector.get<Type<ResourcePolicy>>('policy', context.getHandler());
    if (!policyClass) return true;

    const request = context.switchToHttp().getRequest();
    const policy = await this.moduleRef.resolve(policyClass);
    const resourceId = request.params.athleteId || request.params.id;

    const hasAccess = await policy.canAccess(request.user.id, resourceId);
    if (!hasAccess) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `No tiene acceso al recurso '${resourceId}'`,
        { resource: policyClass.name, resourceId },
      );
    }

    return true;
  }
}
```

**Decorator `@Policy()`:**

```typescript
// src/modules/common/decorators/policy.decorator.ts
import { SetMetadata, Type } from '@nestjs/common';
import { ResourcePolicy } from '../guards/resource-policy.guard';

export const Policy = (policy: Type<ResourcePolicy>) => SetMetadata('policy', policy);
```

**Policy concreta:**

```typescript
// src/modules/execution/guards/athlete-progress.policy.ts
@Injectable()
export class AthleteProgressPolicy implements ResourcePolicy {
  constructor(private readonly prisma: PrismaService) {}

  async canAccess(coachId: string, athleteId: string): Promise<boolean> {
    const count = await this.prisma.subscription.count({
      where: {
        athleteId,
        status: SubscriptionStatus.ACTIVE,
        plan: { coachId },
      },
    });
    return count > 0;
  }
}
```

**Uso en controller:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ResourcePolicyGuard)
@Roles(UserRole.COACH)
@Policy(AthleteProgressPolicy)
@Get(':athleteId/progress')
async getAthleteProgress(@Param('athleteId') athleteId: string) {
  return this.metricsService.getProgress(athleteId);
}
```

---

## 4. Temporal Guards

Guards que verifican condiciones temporales antes de permitir mutaciones.

```typescript
// src/modules/common/guards/week-frozen.guard.ts
import { BusinessException } from '../exceptions/business.exception';
import { BusinessError } from '../exceptions/business-error.enum';

@Injectable()
export class WeekFrozenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { instanceId, weekNumber } = request.params;

    const weekClosure = await this.prisma.weekClosure.findFirst({
      where: { instanceId, weekNumber: parseInt(weekNumber), isFrozen: true },
    });

    if (weekClosure) {
      throw new BusinessException(
        BusinessError.WEEK_FROZEN,
        `La semana ${weekNumber} esta cerrada y no acepta modificaciones`,
        { weekNumber: parseInt(weekNumber), instanceId },
      );
    }

    return true;
  }
}

// src/modules/common/guards/edit-window.guard.ts
@Injectable()
export class EditWindowGuard implements CanActivate {
  private static readonly EDIT_WINDOW_DAYS = 7;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const resultId = request.params.resultId;

    const result = await this.prisma.sessionResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `El resultado '${resultId}' no existe`,
        { entity: 'SessionResult', identifier: resultId },
      );
    }

    const daysSinceCreation = Math.floor(
      (Date.now() - result.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceCreation > EditWindowGuard.EDIT_WINDOW_DAYS) {
      throw new BusinessException(
        BusinessError.EDIT_WINDOW_EXPIRED,
        `El resultado '${resultId}' supero la ventana de edicion de ${EditWindowGuard.EDIT_WINDOW_DAYS} dias`,
        { resultId, windowDays: EditWindowGuard.EDIT_WINDOW_DAYS, daysSinceCreation },
      );
    }

    return true;
  }
}
```

**WeekStartedGuard y PlanPublishedGuard** siguen el mismo patron — verifican una condicion y lanzan `BusinessException`:

```typescript
// src/modules/common/guards/week-started.guard.ts
@Injectable()
export class WeekStartedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { instanceId, weekNumber } = request.params;

    const hasResults = await this.prisma.sessionResult.count({
      where: {
        instanceSession: {
          instanceId,
          weekNumber: parseInt(weekNumber),
        },
      },
    }) > 0;

    if (hasResults) {
      throw new BusinessException(
        BusinessError.WEEK_STARTED,
        `La semana ${weekNumber} ya fue iniciada por el atleta y no acepta modificaciones del entrenador`,
        { weekNumber: parseInt(weekNumber), instanceId },
      );
    }

    return true;
  }
}

// src/modules/common/guards/plan-published.guard.ts
@Injectable()
export class PlanPublishedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const planId = request.params.planId || request.params.id;

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { status: true },
    });

    if (plan && plan.status !== PlanStatus.DRAFT) {
      throw new BusinessException(
        BusinessError.PLAN_IMMUTABLE,
        `El plan '${planId}' no permite modificaciones en estado '${plan.status}'`,
        { planId, currentStatus: plan.status },
      );
    }

    return true;
  }
}
```

**Uso en controller:**

```typescript
@UseGuards(JwtAuthGuard, WeekFrozenGuard)
@Patch(':instanceId/weeks/:weekNumber/results/:resultId')
async updateResult(
  @Param('resultId') resultId: string,
  @Body() dto: UpdateResultDto,
) {
  return this.executionService.updateResult(resultId, dto);
}
```

---

## 5. Template Method — Deep Copy de Instancias

Al aprobar una suscripcion se crea una deep copy del plan base como instancia personalizada del atleta. Toda la operacion en una transaccion.

```typescript
// src/modules/execution/services/instance-factory.service.ts
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessError } from '../../common/exceptions/business-error.enum';

@Injectable()
export class InstanceFactoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createInstanceFromPlan(planId: string, athleteId: string): Promise<AthleteInstance> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        sessions: {
          include: { blocks: true },
          orderBy: [{ weekNumber: 'asc' }, { dayOfWeek: 'asc' }],
        },
      },
    });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `El plan con id '${planId}' no existe`,
        { entity: 'Plan', identifier: planId },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const instance = await tx.athleteInstance.create({
        data: {
          planId: plan.id,
          athleteId,
          status: InstanceStatus.ACTIVE,
        },
      });

      // La jerarquia del plan es Plan -> Phase -> Week -> Session, asi que las
      // sesiones se alcanzan aplanando dos niveles. Los campos de
      // InstanceSession son ILUSTRATIVOS: el modelo de instancias es EPICA-05 y
      // todavia no tiene schema — no tomarlos como definitivos.
      const sessions = plan.phases.flatMap((p) => p.weeks).flatMap((w) => w.sessions);

      for (const session of sessions) {
        const instanceSession = await tx.instanceSession.create({
          data: {
            instanceId: instance.id,
            originalSessionId: session.id,
            weekNumber: session.weekNumber,
            dayOfWeek: session.dayOfWeek,
            sessionType: session.sessionType,
          },
        });

        for (const block of session.blocks) {
          await tx.instanceBlock.create({
            data: {
              instanceSessionId: instanceSession.id,
              exerciseVersionId: block.exerciseVersionId, // FK a version, NO a ejercicio
              sets: block.sets,
              reps: block.reps,
              restSeconds: block.restSeconds,
            },
          });
        }
      }

      return instance;
    });
  }
}
```

**Listener que invoca el deep copy:**

```typescript
// src/modules/execution/listeners/subscription-activated.listener.ts
//
// Cuelga de subscription.activated, NO de subscription.approved. La
// aprobacion del entrenador no habilita nada por si sola: el atleta todavia
// debe aceptar el consentimiento informado (EPICA-04, HU-014). Crear la
// instancia al aprobar le daria un plan de ejecucion a alguien que no
// consintio — justo lo que CA-014-8 prohibe.
@Injectable()
export class SubscriptionActivatedListener {
  private readonly logger = new Logger(SubscriptionActivatedListener.name);

  constructor(private readonly instanceFactory: InstanceFactoryService) {}

  @OnEvent('subscription.activated')
  async handle(event: SubscriptionActivatedEvent): Promise<void> {
    try {
      await this.instanceFactory.createInstanceFromPlan(event.planId, event.athleteId);
      this.logger.log(`Instancia creada para atleta ${event.athleteId} en plan ${event.planId}`);
    } catch (error) {
      this.logger.error(
        `Error creando instancia para atleta ${event.athleteId}`,
        error,
      );
    }
  }
}
```
