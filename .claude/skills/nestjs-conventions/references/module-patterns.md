# Patrones de Módulo — Referencia Detallada

Patrones de implementación para componentes reutilizables del proyecto.
Leer este archivo cuando se necesite implementar cualquiera de estos patrones.

## Tabla de contenido

1. [PrismaService y módulo compartido](#1-prismaservice-y-módulo-compartido)
2. [PaginationDto](#2-paginationdto)
3. [@CurrentUser() decorator](#3-currentuser-decorator)
4. [Registro de módulos en AppModule](#4-registro-de-módulos-en-appmodule)
5. [Naming de eventos](#5-naming-de-eventos)
6. [Service patterns (CRUD con Prisma)](#6-service-patterns-crud-con-prisma)

---

## 1. PrismaService y módulo compartido

### PrismaService

```typescript
// src/modules/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    // Para middleware de soft-delete (archivedAt) → ver skill `design-patterns` → data-patterns.md
    async onModuleInit(): Promise<void> {
        await this.$connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }
}
```

### PrismaModule

```typescript
// src/modules/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
```

- `@Global()` — disponible en toda la app sin importar en cada módulo
- Registrar en `AppModule.imports` una sola vez

---

## 2. PaginationDto

DTO reutilizable para query params de endpoints paginados.
Ubicación: `src/modules/common/dto/pagination.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class PaginationDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    page: number = 1;

    @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 10;
}
```

### Uso en controller

```typescript
@Get()
@ApiOperation({ summary: 'Listar planes de entrenamiento' })
async findAll(@Query() query: PaginationDto) {
    return this.planService.findAll(query);
}
```

### Cálculo de meta en service

```typescript
async findAll(query: PaginationDto): Promise<{ data: Plan[]; meta: PaginationMeta }> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
        this.prisma.plan.findMany({ skip, take: limit }),
        this.prisma.plan.count(),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
        data,
        meta: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        },
    };
}
```

---

## 3. @CurrentUser() decorator

Decorator para extraer el usuario autenticado del request.
Ubicación: `src/modules/common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
    id: string;
    email: string;
    role: string;
}

export const CurrentUser = createParamDecorator(
    (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | unknown => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as AuthUser;
        return data ? user?.[data] : user;
    },
);
```

### Uso

```typescript
// Obtener usuario completo
@Get('profile')
async getProfile(@CurrentUser() user: AuthUser) {
    return this.userService.findOne(user.id);
}

// Obtener solo un campo
@Get('my-plans')
async getMyPlans(@CurrentUser('id') userId: string) {
    return this.planService.findByCoach(userId);
}
```

El objeto `user` es inyectado en `request.user` por Passport después de validar el JWT en `JwtAuthGuard`.

---

## 4. Registro de módulos en AppModule

```typescript
@Module({
    imports: [
        // --- Infraestructura (orden: config → logging → db → seguridad → eventos) ---
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({
            pinoHttp: {
                // configuración de pino
            },
        }),
        PrismaModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        EventEmitterModule.forRoot(),

        // --- Módulos de dominio (orden alfabético) ---
        AuthModule,
        ExercisesModule,
        PlansModule,
        SubscriptionsModule,
        ExecutionModule,
        MetricsModule,
        AiModule,

        // --- Transversales ---
        NotificationsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    }
}
```

**Notas de orden:**
- `ConfigModule.forRoot({ isGlobal: true })` siempre primero — otros módulos dependen de `ConfigService`
- `PrismaModule` es `@Global()`, se registra una vez y está disponible en todos los módulos
- `EventEmitterModule.forRoot()` antes de módulos de dominio que emitan eventos

---

## 5. Naming de eventos

Convención: `[entidad].[acción]` en minúsculas, usando dot notation.

> **Catálogo completo de eventos** → skill `design-patterns` (sección 7). La tabla aquí es un subconjunto para ilustrar el patrón.

### Clase de evento

```typescript
// src/modules/plans/events/plan-published.event.ts
export class PlanPublishedEvent {
    constructor(
        public readonly planId: string,
        public readonly coachId: string,
    ) {}
}
```

### Listener

Los listeners NO pasan por el pipeline HTTP, por lo tanto SÍ requieren try/catch.

```typescript
// src/modules/notifications/listeners/plan-published.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PlanPublishedEvent } from '../../plans/events/plan-published.event';

@Injectable()
export class PlanPublishedListener {
    private readonly logger = new Logger(PlanPublishedListener.name);

    constructor(private readonly notificationService: NotificationService) {}

    @OnEvent('plan.published')
    async handle(event: PlanPublishedEvent): Promise<void> {
        try {
            await this.notificationService.notifyAthletes(event.planId);
        } catch (error) {
            this.logger.error(
                `Error al notificar atletas del plan ${event.planId}`,
                error,
            );
        }
    }
}
```

Los listeners se registran en el array `providers` de su módulo.

---

## 6. Service patterns (CRUD con Prisma)

### Estructura típica de un service

```typescript
@Injectable()
export class PlanService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    // --- Queries ---

    async findOne(id: string): Promise<PlanResponseDto> {
        const plan = await this.prisma.plan.findUnique({
            where: { id, archivedAt: null },
        });

        if (!plan) {
            throw new BusinessException(
                BusinessError.ENTITY_NOT_FOUND,
                `El plan con id ${id} no existe`,
                { entityType: 'Plan', entityId: id },
            );
        }

        return plan;
    }

    async findAll(query: PaginationDto): Promise<{ data: Plan[]; meta: PaginationMeta }> {
        const { page, limit } = query;
        const skip = (page - 1) * limit;
        const where = { archivedAt: null };

        const [data, totalItems] = await Promise.all([
            this.prisma.plan.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.plan.count({ where }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return {
            data,
            meta: { page, limit, totalItems, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
        };
    }

    // --- Commands ---

    async create(coachId: string, dto: CreatePlanDto): Promise<PlanResponseDto> {
        return this.prisma.plan.create({
            data: {
                ...dto,
                coachId,
                status: PlanStatus.DRAFT,
            },
        });
    }

    async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
        const plan = await this.findOne(id); // reutiliza validación de existencia

        if (plan.status !== PlanStatus.DRAFT) {
            throw new BusinessException(
                BusinessError.PLAN_IMMUTABLE,
                'Solo se pueden editar planes en estado borrador',
                { planId: id, currentStatus: plan.status },
            );
        }

        return this.prisma.plan.update({ where: { id }, data: dto });
    }

    // --- Soft delete ---

    async archive(id: string): Promise<{ data: null; message: string }> {
        await this.findOne(id); // valida existencia

        await this.prisma.plan.update({
            where: { id },
            data: { archivedAt: new Date() },
        });

        this.eventEmitter.emit('plan.archived', new PlanArchivedEvent(id));

        return { data: null, message: 'Plan archivado exitosamente' };
    }
}
```

### Patrones clave

- **Queries incluyen `archivedAt: null`** en el `where` para excluir archivados (ver convencion en skill `design-patterns`)
- **`findOne` lanza `BusinessException`** si no encuentra — reutilizable desde otros métodos
- **Retorno de soft-delete** es `{ data: null, message: '...' }` — el `ResponseInterceptor` lo envuelve
- **Eventos se emiten después** de la operación exitosa, no antes

### Transacciones

```typescript
async publish(id: string): Promise<PlanResponseDto> {
    const plan = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.plan.update({
            where: { id },
            data: { status: PlanStatus.PUBLISHED, publishedAt: new Date() },
        });

        await tx.planHistory.create({
            data: { planId: id, action: 'PUBLISHED', timestamp: new Date() },
        });

        return updated;
    });

    // Emitir evento DESPUÉS del commit — si la transacción falla, el evento no se emite
    this.eventEmitter.emit('plan.published', new PlanPublishedEvent(id, plan.coachId));

    return plan;
}
```
