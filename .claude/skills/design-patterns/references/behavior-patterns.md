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

  const updated = await this.prisma.$transaction(async (tx) => {
    const result = await tx.plan.update({
      where: { id: planId },
      data: { status: PlanStatus.PUBLISHED, publishedAt: new Date() },
    });

    await tx.planHistory.create({
      data: { planId, action: 'PUBLISHED', timestamp: new Date() },
    });

    return result;
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

  const subscriberCount = await this.prisma.subscription.count({
    where: { planId, status: { not: SubscriptionStatus.REJECTED } },
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
  const plan = await this.prisma.plan.findUnique({
    where: { id: planId, archivedAt: null },
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
private validatePlanCompleteness(plan: PlanWithSessions): void {
  const issues: string[] = [];

  if (!plan.name) issues.push('nombre');
  if (!plan.startDate) issues.push('fecha de inicio');
  if (!plan.sessions || plan.sessions.length === 0) issues.push('al menos una sesion');

  const hasExercises = plan.sessions?.some(
    (s) => s.blocks && s.blocks.length > 0,
  );
  if (!hasExercises) issues.push('al menos un ejercicio en una sesion');

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

  const updated = await this.prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: SubscriptionStatus.APPROVED, approvedAt: new Date() },
  });

  this.eventEmitter.emit(
    'subscription.approved',
    new SubscriptionApprovedEvent(subscriptionId, sub.planId, sub.athleteId, coachId),
  );

  return updated;
}

async reject(subscriptionId: string, coachId: string, reason: string): Promise<Subscription> {
  const sub = await this.findOrFail(subscriptionId);

  if (sub.status !== SubscriptionStatus.PENDING) {
    throw new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede rechazar la suscripcion '${subscriptionId}' desde estado '${sub.status}'`,
      { entity: 'Subscription', currentState: sub.status, targetState: 'REJECTED' },
    );
  }

  return this.prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: SubscriptionStatus.REJECTED, rejectedReason: reason },
  });
}
```

```prisma
enum SubscriptionStatus {
  PENDING
  APPROVED
  CONSENT_PENDING
  ACTIVE
  REJECTED
}
```

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

      for (const session of plan.sessions) {
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
// src/modules/execution/listeners/subscription-approved.listener.ts
@Injectable()
export class SubscriptionApprovedListener {
  private readonly logger = new Logger(SubscriptionApprovedListener.name);

  constructor(private readonly instanceFactory: InstanceFactoryService) {}

  @OnEvent('subscription.approved')
  async handle(event: SubscriptionApprovedEvent): Promise<void> {
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
