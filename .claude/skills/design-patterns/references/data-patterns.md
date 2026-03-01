# Patrones de Datos — Implementacion completa

Referencia de implementacion para versionado, soft-delete, frozen flag y audit trail.

## Tabla de contenido

1. [Append-Only / Versioning (Ejercicios)](#1-append-only--versioning-ejercicios)
2. [Soft-Delete](#2-soft-delete)
3. [Frozen Flag (Cierre de Semana)](#3-frozen-flag-cierre-de-semana)
4. [Audit Trail](#4-audit-trail)

---

## 1. Append-Only / Versioning (Ejercicios)

Los ejercicios son inmutables una vez usados en un plan. Editar un ejercicio usado crea nueva version.

**Modelo de datos:**

```
Exercise (id, name, isActive, createdAt, updatedAt)
  └── ExerciseVersion (id, exerciseId, versionNumber, description, muscleGroup, createdAt)
       └── Referenciado por InstanceBlock.exerciseVersionId
```

**Logica de actualizacion:**

```typescript
// exercises.service.ts
import { BusinessException } from '../common/exceptions/business.exception';
import { BusinessError } from '../common/exceptions/business-error.enum';

async update(exerciseId: string, dto: UpdateExerciseDto): Promise<ExerciseVersion> {
  const exercise = await this.findOrFail(exerciseId);

  const isUsedInPlan = await this.prisma.instanceBlock.count({
    where: { exerciseVersion: { exerciseId } },
  }) > 0;

  if (isUsedInPlan) {
    // Append-only: crear nueva version
    const latestVersion = await this.prisma.exerciseVersion.findFirst({
      where: { exerciseId },
      orderBy: { versionNumber: 'desc' },
    });

    return this.prisma.exerciseVersion.create({
      data: {
        exerciseId,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        ...dto,
      },
    });
  }

  // No usado → edicion directa de la version existente
  return this.prisma.exerciseVersion.update({
    where: { id: exercise.currentVersionId },
    data: dto,
  });
}

async deactivate(exerciseId: string): Promise<Exercise> {
  const exercise = await this.findOrFail(exerciseId);

  const isUsedInActivePlan = await this.prisma.instanceBlock.count({
    where: {
      exerciseVersion: { exerciseId },
      instanceSession: { instance: { status: InstanceStatus.ACTIVE } },
    },
  }) > 0;

  if (isUsedInActivePlan) {
    throw new BusinessException(
      BusinessError.EXERCISE_IN_USE,
      `El ejercicio '${exerciseId}' esta en uso en planes activos`,
      { exerciseId },
    );
  }

  // isActive = false, pero las versiones persisten
  return this.prisma.exercise.update({
    where: { id: exerciseId },
    data: { isActive: false },
  });
}
```

**Prisma schema:**

```prisma
model Exercise {
  id        String            @id @default(uuid())
  name      String
  isActive  Boolean           @default(true)
  versions  ExerciseVersion[]
  createdAt DateTime          @default(now()) @map("created_at")
  updatedAt DateTime          @updatedAt @map("updated_at")

  @@map("exercises")
}

model ExerciseVersion {
  id            String   @id @default(uuid())
  exerciseId    String   @map("exercise_id")
  versionNumber Int      @map("version_number")
  description   String?
  muscleGroup   String   @map("muscle_group")
  exercise      Exercise @relation(fields: [exerciseId], references: [id])
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([exerciseId, versionNumber])
  @@map("exercise_versions")
}
```

---

## 2. Soft-Delete

Columna `archivedAt DateTime?` en entidades que soportan soft-delete: Plan, Subscription, SessionResult.

**Convencion de naming:**
- `archivedAt` para entidades que se "archivan" (plans, subscriptions, results)
- `isActive` para entidades que se "inhabilitan" (exercises)

**Prisma middleware en PrismaService:**

```typescript
// prisma.service.ts — Middleware aplicado en onModuleInit
async onModuleInit(): Promise<void> {
  await this.$connect();

  const softDeleteModels = ['Plan', 'Subscription', 'SessionResult'];

  this.$use(async (params, next) => {
    if (!softDeleteModels.includes(params.model)) return next(params);

    // DELETE → UPDATE con archivedAt
    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { archivedAt: new Date() };
    }

    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      params.args.data = { archivedAt: new Date() };
    }

    // Queries de lectura → filtrar archivados por defecto
    if (['findFirst', 'findMany', 'count'].includes(params.action)) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};

      // Solo filtrar si no se busca explicitamente archivados
      if (params.args.where.archivedAt === undefined) {
        params.args.where.archivedAt = null;
      }
    }

    return next(params);
  });
}
```

**Service pattern para archivar:**

```typescript
async archive(id: string): Promise<{ data: null; message: string }> {
  await this.findOne(id);

  await this.prisma.plan.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  this.eventEmitter.emit('plan.archived', new PlanArchivedEvent(id));

  return { data: null, message: 'Plan archivado exitosamente' };
}
```

---

## 3. Frozen Flag (Cierre de Semana)

Al completar la ultima sesion de la semana, los datos se congelan para la IA.

**Modelo de datos:**

```prisma
model WeekClosure {
  id         String   @id @default(uuid())
  instanceId String   @map("instance_id")
  weekNumber Int      @map("week_number")
  isFrozen   Boolean  @default(false) @map("is_frozen")
  closedAt   DateTime? @map("closed_at")
  createdAt  DateTime @default(now()) @map("created_at")

  instance   AthleteInstance @relation(fields: [instanceId], references: [id])

  @@unique([instanceId, weekNumber])
  @@map("week_closures")
}
```

**Logica de cierre:**

```typescript
// execution.service.ts
async closeWeek(instanceId: string, weekNumber: number): Promise<WeekClosure> {
  const pendingSessions = await this.prisma.instanceSession.count({
    where: {
      instanceId,
      weekNumber,
      result: null, // sesiones sin resultado
    },
  });

  if (pendingSessions > 0) {
    throw new BusinessException(
      BusinessError.PLAN_INCOMPLETE,
      `La semana ${weekNumber} tiene ${pendingSessions} sesiones pendientes`,
      { instanceId, weekNumber, pendingSessions },
    );
  }

  const closure = await this.prisma.weekClosure.upsert({
    where: {
      instanceId_weekNumber: { instanceId, weekNumber },
    },
    create: {
      instanceId,
      weekNumber,
      isFrozen: true,
      closedAt: new Date(),
    },
    update: {
      isFrozen: true,
      closedAt: new Date(),
    },
  });

  this.eventEmitter.emit('week.closed', new WeekClosedEvent(instanceId, weekNumber));

  return closure;
}
```

---

## 4. Audit Trail

Dos mecanismos para cumplimiento legal (Ley 1581/2012).

### AuditInterceptor — captura automatica de mutaciones

```typescript
// src/modules/common/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            this.persistAuditLog(request, startTime, request.res?.statusCode);
          }
        },
        error: (error) => {
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            const statusCode = error instanceof HttpException ? error.getStatus() : 500;
            this.persistAuditLog(request, startTime, statusCode, error.message);
          }
        },
      }),
    );
  }

  private persistAuditLog(
    request: any,
    startTime: number,
    statusCode?: number,
    error?: string,
  ): void {
    this.prisma.auditLog.create({
      data: {
        userId: request.user?.id ?? null,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
        method: request.method,
        url: request.url,
        statusCode,
        duration: Date.now() - startTime,
        correlationId: request.correlationId,
        error,
      },
    }).catch((err) => this.logger.error('Error persistiendo audit log', err));
  }
}
```

**Prisma schema:**

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  userId        String?  @map("user_id")
  ip            String
  userAgent     String   @map("user_agent")
  method        String
  url           String
  statusCode    Int?     @map("status_code")
  duration      Int      // milliseconds
  correlationId String?  @map("correlation_id")
  error         String?
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([correlationId])
  @@map("audit_logs")
}
```

### Tabla `legal_acceptances` — registro inmutable

Registro de: habeas data, datos sensibles de salud (Ley 1581), consentimiento deportivo.

```prisma
enum DocumentType {
  HABEAS_DATA
  HEALTH_DATA_CONSENT
  SPORT_CONSENT
  TERMS_OF_SERVICE
}

model LegalAcceptance {
  id              String       @id @default(uuid())
  userId          String       @map("user_id")
  documentType    DocumentType @map("document_type")
  documentVersion String       @map("document_version")
  ip              String
  userAgent       String       @map("user_agent")
  planId          String?      @map("plan_id")    // HEALTH_DATA_CONSENT, SPORT_CONSENT
  acceptedAt      DateTime     @default(now()) @map("accepted_at")

  @@index([userId])
  @@map("legal_acceptances")
}
```

> Valores autoritativos de `DocumentType` definidos en skill `legal-guardrails` §3.

**Inmutabilidad en el service:**

```typescript
// legal.service.ts
async accept(userId: string, dto: AcceptLegalDto): Promise<LegalAcceptance> {
  return this.prisma.legalAcceptance.create({
    data: {
      userId,
      documentType: dto.documentType,
      documentVersion: dto.documentVersion,
      ip: dto.ip,
      userAgent: dto.userAgent,
      planId: dto.planId,
    },
  });
}

// NO existe metodo update ni delete — inmutabilidad por diseno
```
