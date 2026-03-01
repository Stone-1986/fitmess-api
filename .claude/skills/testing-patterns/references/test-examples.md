# Test Examples — Implementacion completa

Ejemplos de test por capa. Todos usan Vitest con `globals: true` (no requieren import de `vi`, `describe`, `it`, `expect`).

## Tabla de contenido

1. [Service (dominio — target 80%)](#1-service-dominio--target-80)
2. [Controller (adaptador — target 70%)](#2-controller-adaptador--target-70)
3. [Exception Filter](#3-exception-filter)
4. [Guard](#4-guard)
5. [Listener](#5-listener)
6. [E2e](#6-e2e)

---

## 1. Service (dominio — target 80%)

El service es la capa mas importante. Aislar con mock de PrismaService y EventEmitter2.

```typescript
// src/modules/plans/plans.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { BusinessError } from '../common/exceptions/business-error.enum';
import { PlanStatus } from '../../../generated/prisma';

// Mock de PrismaService — solo los metodos que usa PlansService
const mockPrisma = {
  plan: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  subscription: {
    count: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

const mockEventEmitter = {
  emit: vi.fn(),
};

describe('PlansService', () => {
  let service: PlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('publish()', () => {
    it('publica un plan en estado DRAFT correctamente', async () => {
      const planId = 'plan-uuid';
      const coachId = 'coach-uuid';

      mockPrisma.plan.findUnique.mockResolvedValue({
        id: planId,
        coachId,
        status: PlanStatus.DRAFT,
        name: 'Plan Fuerza',
        startDate: new Date(),
        sessions: [{ id: 'session-1', blocks: [{ id: 'block-1' }] }],
      });
      mockPrisma.plan.update.mockResolvedValue({
        id: planId,
        status: PlanStatus.PUBLISHED,
      });

      const result = await service.publish(planId, coachId);

      expect(result.status).toBe(PlanStatus.PUBLISHED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'plan.published',
        expect.objectContaining({ planId, coachId }),
      );
    });

    it('lanza BusinessException INVALID_STATE_TRANSITION si el plan no esta en DRAFT', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-uuid',
        coachId: 'coach-uuid',
        status: PlanStatus.ARCHIVED,
      });

      await expect(
        service.publish('plan-uuid', 'coach-uuid'),
      ).rejects.toThrow(BusinessException);

      await expect(
        service.publish('plan-uuid', 'coach-uuid'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
    });

    it('lanza BusinessException ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.publish('inexistente', 'coach-uuid'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });

    it('lanza BusinessException RESOURCE_OWNERSHIP_DENIED si el coach no es el dueno', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-uuid',
        coachId: 'otro-coach',
        status: PlanStatus.DRAFT,
      });

      await expect(
        service.publish('plan-uuid', 'coach-uuid'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });
  });
});
```

**Patron para mock de `$transaction`:**

```typescript
// Mock que ejecuta el callback pasandole el mismo mockPrisma
const mockPrisma = {
  plan: { update: vi.fn(), /* ... */ },
  planHistory: { create: vi.fn() },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};
```

---

## 2. Controller (adaptador — target 70%)

El controller es thin: verificar que delega correctamente y retorna el resultado.

```typescript
// src/modules/plans/plans.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

const mockPlansService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  publish: vi.fn(),
};

describe('PlansController', () => {
  let controller: PlansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        { provide: PlansService, useValue: mockPlansService },
      ],
    }).compile();

    controller = module.get<PlansController>(PlansController);
  });

  afterEach(() => vi.clearAllMocks());

  describe('create()', () => {
    it('delega al service y retorna el resultado', async () => {
      const dto = { name: 'Plan Fuerza', startDate: '2026-03-01', sessions: [] };
      const user = { id: 'coach-uuid', role: 'COACH' };
      const expected = { id: 'plan-uuid', ...dto, status: 'DRAFT' };

      mockPlansService.create.mockResolvedValue(expected);

      const result = await controller.create(user as any, dto as any);

      expect(mockPlansService.create).toHaveBeenCalledWith(user.id, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('publish()', () => {
    it('delega al service con el id correcto', async () => {
      const planId = 'plan-uuid';
      const user = { id: 'coach-uuid' };
      const expected = { id: planId, status: 'PUBLISHED' };

      mockPlansService.publish.mockResolvedValue(expected);

      const result = await controller.publish(user as any, planId);

      expect(mockPlansService.publish).toHaveBeenCalledWith(planId, user.id);
      expect(result).toEqual(expected);
    });
  });
});
```

---

## 3. Exception Filter

```typescript
// src/modules/common/filters/problem-detail.filter.spec.ts
import { ProblemDetailFilter } from './problem-detail.filter';
import { BusinessException } from '../exceptions/business.exception';
import { BusinessError } from '../exceptions/business-error.enum';

describe('ProblemDetailFilter', () => {
  let filter: ProblemDetailFilter;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    filter = new ProblemDetailFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockRequest = {
      url: '/api/plans/uuid/publish',
      correlationId: 'correlation-uuid',
    };
  });

  it('responde con RFC 9457 y Content-Type application/problem+json', () => {
    const exception = new BusinessException(
      BusinessError.INVALID_STATE_TRANSITION,
      `No se puede transicionar Plan de 'ARCHIVED' a 'PUBLISHED'`,
      { entity: 'Plan', currentState: 'ARCHIVED', targetState: 'PUBLISHED' },
    );

    const host = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;

    filter.catch(exception, host);

    expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'INVALID_STATE_TRANSITION',
        status: 409,
        correlationId: 'correlation-uuid',
      }),
    );
  });
});
```

---

## 4. Guard

```typescript
// src/modules/common/guards/week-frozen.guard.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { WeekFrozenGuard } from './week-frozen.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../exceptions/business.exception';
import { BusinessError } from '../exceptions/business-error.enum';

const mockPrisma = {
  weekClosure: {
    findFirst: vi.fn(),
  },
};

describe('WeekFrozenGuard', () => {
  let guard: WeekFrozenGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeekFrozenGuard,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<WeekFrozenGuard>(WeekFrozenGuard);
  });

  afterEach(() => vi.clearAllMocks());

  const createMockContext = (params: Record<string, string>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ params }),
      }),
    }) as any;

  it('permite acceso si la semana NO esta congelada', async () => {
    mockPrisma.weekClosure.findFirst.mockResolvedValue(null);

    const context = createMockContext({ instanceId: 'inst-uuid', weekNumber: '1' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('lanza BusinessException WEEK_FROZEN si la semana esta congelada', async () => {
    mockPrisma.weekClosure.findFirst.mockResolvedValue({
      id: 'closure-uuid',
      isFrozen: true,
    });

    const context = createMockContext({ instanceId: 'inst-uuid', weekNumber: '2' });

    await expect(guard.canActivate(context)).rejects.toThrow(BusinessException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorEntry: BusinessError.WEEK_FROZEN,
    });
  });
});
```

---

## 5. Listener

Los listeners requieren try/catch. Testear que NO relanzan excepciones y que loggean el error.

```typescript
// src/modules/execution/listeners/subscription-approved.listener.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionApprovedListener } from './subscription-approved.listener';
import { InstanceFactoryService } from '../services/instance-factory.service';
import { SubscriptionApprovedEvent } from '../../subscriptions/events/subscription-approved.event';

const mockInstanceFactory = {
  createInstanceFromPlan: vi.fn(),
};

describe('SubscriptionApprovedListener', () => {
  let listener: SubscriptionApprovedListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionApprovedListener,
        { provide: InstanceFactoryService, useValue: mockInstanceFactory },
      ],
    }).compile();

    listener = module.get<SubscriptionApprovedListener>(SubscriptionApprovedListener);
  });

  afterEach(() => vi.clearAllMocks());

  it('crea instancia al recibir evento subscription.approved', async () => {
    const event = new SubscriptionApprovedEvent('sub-uuid', 'plan-uuid', 'athlete-uuid', 'coach-uuid');

    mockInstanceFactory.createInstanceFromPlan.mockResolvedValue({ id: 'instance-uuid' });

    await listener.handle(event);

    expect(mockInstanceFactory.createInstanceFromPlan).toHaveBeenCalledWith('plan-uuid', 'athlete-uuid');
  });

  it('NO relanza si el service falla — solo loggea', async () => {
    const event = new SubscriptionApprovedEvent('sub-uuid', 'plan-uuid', 'athlete-uuid', 'coach-uuid');

    mockInstanceFactory.createInstanceFromPlan.mockRejectedValue(new Error('DB connection lost'));

    // El listener NO debe relanzar la excepcion
    await expect(listener.handle(event)).resolves.not.toThrow();
  });
});
```

---

## 6. E2e

```typescript
// test/plans.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailFilter } from '../src/modules/common/filters/problem-detail.filter';
import { PrismaExceptionFilter } from '../src/modules/common/filters/prisma-exception.filter';
import { ValidationExceptionFilter } from '../src/modules/common/filters/validation-exception.filter';
import { GlobalExceptionFilter } from '../src/modules/common/filters/global-exception.filter';

describe('Plans (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Replicar configuracion exacta de main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));

    app.useGlobalFilters(
      new GlobalExceptionFilter(),
      new PrismaExceptionFilter(),
      new ValidationExceptionFilter(),
      new ProblemDetailFilter(),
    );

    await app.init();

    // Auth token via seed de test
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'coach@test.com', password: 'password123' });

    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /plans', () => {
    it('crea un plan correctamente (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Plan Fuerza Fase 1',
          startDate: '2026-03-01',
          sessions: [{ weekNumber: 1, dayOfWeek: 'MONDAY', sessionType: 'STRENGTH', blocks: [] }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('retorna 400 con application/problem+json si faltan campos requeridos', async () => {
      const res = await request(app.getHttpServer())
        .post('/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Plan incompleto' });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch('application/problem+json');
      expect(res.body.errors).toBeDefined();
    });

    it('retorna 401 sin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/plans')
        .send({ name: 'Plan' });

      expect(res.status).toBe(401);
    });
  });
});
```

**Consideraciones e2e:**
- El e2e usa `AppModule` real con DB de test (PostgreSQL via `DATABASE_URL` de test)
- Requiere seed previo con datos minimos (coach user, credenciales)
- El cleanup de datos creados durante tests puede hacerse en `afterAll` o via transacciones que se revierten
- Replicar TODA la configuracion de `main.ts` (pipes, filters, interceptors) en el setup del test
