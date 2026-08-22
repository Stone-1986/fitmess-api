import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlansService } from './plans.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import {
  PlanStatus,
  CoachRequestStatus,
  SubscriptionStatus,
} from '../../../generated/prisma/index.js';

/**
 * Mock de PrismaService — solo los metodos que usa PlansService.
 *
 * $transaction soporta ambas firmas usadas por el service: callback
 * (addPhase/addWeek/addSession/addSessionExercise) y array de promesas
 * (findAll/findPublished).
 */
const mockPrisma = {
  plan: {
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  phase: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  week: {
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  session: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  sessionExercise: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  exercise: {
    findUnique: vi.fn(),
  },
  // EPICA-04: hasSubscribers(planId) dejo de ser un stub — consulta
  // Subscription.count() real (plans.service.ts:1081-1091).
  subscription: {
    count: vi.fn(),
  },
  $transaction: vi.fn((arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mockPrisma) => unknown)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const mockEventEmitter = {
  emit: vi.fn(),
};

const COACH_ID = 'coach-uuid';
const OTHER_COACH_ID = 'other-coach-uuid';
const PLAN_ID = 'plan-uuid';

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    name: 'Fuerza e hipertrofia',
    description: 'Bloque de 8 semanas',
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-10-27T00:00:00.000Z'),
    status: PlanStatus.DRAFT,
    coachId: COACH_ID,
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    updatedAt: new Date('2026-08-20T00:00:00.000Z'),
    ...overrides,
  };
}

function buildExerciseVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-uuid',
    exerciseId: 'exercise-uuid',
    versionNumber: 1,
    description: 'Descripcion del ejercicio',
    muscleGroup: 'Cuadriceps',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    exercise: { id: 'exercise-uuid', name: 'Sentadilla' },
    ...overrides,
  };
}

function buildSessionExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-exercise-uuid',
    sessionId: 'session-uuid',
    exerciseVersionId: 'version-uuid',
    order: 1,
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    exerciseVersion: buildExerciseVersion(),
    ...overrides,
  };
}

function buildPlanTree(overrides: Record<string, unknown> = {}) {
  return {
    ...buildPlan(),
    phases: [],
    ...overrides,
  };
}

/** Espera a que las microtareas del write-through fire-and-forget corran. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

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

  // ── create() ──────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crea el shell del plan en Borrador con trim() aplicado (CA-008-1)', async () => {
      mockPrisma.plan.create.mockResolvedValue(buildPlan());

      const result = await service.create(COACH_ID, {
        name: '  Fuerza e hipertrofia  ',
        description: '  Bloque de 8 semanas  ',
        startDate: '2026-09-01',
        endDate: '2026-10-27',
      } as never);

      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          name: 'Fuerza e hipertrofia',
          description: 'Bloque de 8 semanas',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-10-27'),
          coachId: COACH_ID,
        },
      });
      expect(result.id).toBe(PLAN_ID);
      expect(result.status).toBe(PlanStatus.DRAFT);
    });

    it('permite crear un plan sin description ni fechas (CA-008-2)', async () => {
      mockPrisma.plan.create.mockResolvedValue(
        buildPlan({ description: null, startDate: null, endDate: null }),
      );

      const result = await service.create(COACH_ID, {
        name: 'Plan minimo',
      } as never);

      expect(mockPrisma.plan.create).toHaveBeenCalledWith({
        data: {
          name: 'Plan minimo',
          description: undefined,
          startDate: undefined,
          endDate: undefined,
          coachId: COACH_ID,
        },
      });
      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.create.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.create(COACH_ID, { name: 'x' } as never),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('lista los planes propios paginados, en cualquier estado', async () => {
      mockPrisma.plan.count.mockResolvedValue(1);
      mockPrisma.plan.findMany.mockResolvedValue([buildPlan()]);

      const result = await service.findAll(COACH_ID);

      expect(mockPrisma.plan.count).toHaveBeenCalledWith({
        where: { coachId: COACH_ID },
      });
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { coachId: COACH_ID } }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('respeta page/limit para el skip', async () => {
      mockPrisma.plan.count.mockResolvedValue(50);
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const result = await service.findAll(COACH_ID, 3, 10);

      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
    });

    it('normaliza page/limit invalidos a los valores por defecto', async () => {
      mockPrisma.plan.count.mockResolvedValue(0);
      mockPrisma.plan.findMany.mockResolvedValue([]);

      await service.findAll(COACH_ID, -1, 500);

      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
    });

    it('aplica el write-through oportunista (D-1) para un plan Publicado ya vencido', async () => {
      const expiredPlan = buildPlan({
        status: PlanStatus.PUBLISHED,
        endDate: new Date('2020-01-01T00:00:00.000Z'),
      });
      mockPrisma.plan.count.mockResolvedValue(1);
      mockPrisma.plan.findMany.mockResolvedValue([expiredPlan]);
      mockPrisma.plan.update.mockResolvedValue({
        ...expiredPlan,
        status: PlanStatus.FINALIZED,
      });

      const result = await service.findAll(COACH_ID);

      expect(result.data[0].status).toBe(PlanStatus.FINALIZED);

      await flushMicrotasks();

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: { status: PlanStatus.FINALIZED },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan.finalized', {
        planId: PLAN_ID,
        coachId: COACH_ID,
      });
    });

    it('registra un error (sin lanzar) si el write-through falla — fire-and-forget', async () => {
      const expiredPlan = buildPlan({
        status: PlanStatus.PUBLISHED,
        endDate: new Date('2020-01-01T00:00:00.000Z'),
      });
      mockPrisma.plan.count.mockResolvedValue(1);
      mockPrisma.plan.findMany.mockResolvedValue([expiredPlan]);
      mockPrisma.plan.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.findAll(COACH_ID)).resolves.toBeDefined();

      await flushMicrotasks();

      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'plan.finalized',
        expect.anything(),
      );
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('timeout')),
      );

      await expect(service.findAll(COACH_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retorna el arbol completo del plan propio (D-8)', async () => {
      const tree = buildPlanTree({
        phases: [
          {
            id: 'phase-uuid',
            name: 'Fase 1',
            order: 1,
            weeks: [
              {
                id: 'week-uuid',
                weekNumber: 1,
                sessions: [
                  {
                    id: 'session-uuid',
                    name: 'Dia 1',
                    order: 1,
                    exercises: [buildSessionExercise()],
                  },
                ],
              },
            ],
          },
        ],
      });
      mockPrisma.plan.findUnique.mockResolvedValue(tree);

      const result = await service.findOne(COACH_ID, PLAN_ID);

      expect(result.id).toBe(PLAN_ID);
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].weeks[0].sessions[0].exercises[0]).toMatchObject({
        id: 'session-exercise-uuid',
        exerciseId: 'exercise-uuid',
        name: 'Sentadilla',
        versionNumber: 1,
      });
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(COACH_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan pertenece a otro coach (CA-008-6)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlanTree({ coachId: OTHER_COACH_ID }),
      );

      await expect(service.findOne(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });
  });

  // ── update() ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('edita name/description en cualquier estado', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ name: 'Nuevo nombre' }),
      );

      const result = await service.update(COACH_ID, PLAN_ID, {
        name: 'Nuevo nombre',
      } as never);

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: { name: 'Nuevo nombre' },
      });
      expect(result.name).toBe('Nuevo nombre');
    });

    it('edita startDate/endDate cuando el plan sigue en Borrador', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );
      mockPrisma.plan.update.mockResolvedValue(buildPlan());

      await service.update(COACH_ID, PLAN_ID, {
        startDate: '2026-09-08',
        endDate: '2026-11-03',
      } as never);

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: {
          startDate: new Date('2026-09-08'),
          endDate: new Date('2026-11-03'),
        },
      });
    });

    it('lanza PLAN_IMMUTABLE si se envian fechas y el plan no esta en Borrador (D-6, RN-31)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );

      await expect(
        service.update(COACH_ID, PLAN_ID, {
          startDate: '2026-09-08',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.PLAN_IMMUTABLE });
      expect(mockPrisma.plan.update).not.toHaveBeenCalled();
    });

    it('permite editar name aunque el plan este Publicado (D-6)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED, name: 'Renombrado' }),
      );

      const result = await service.update(COACH_ID, PLAN_ID, {
        name: 'Renombrado',
      } as never);

      expect(result.name).toBe('Renombrado');
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.update(COACH_ID, 'inexistente', { name: 'x' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ coachId: OTHER_COACH_ID }),
      );

      await expect(
        service.update(COACH_ID, PLAN_ID, { name: 'x' } as never),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.plan.update.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.update(COACH_ID, PLAN_ID, { name: 'x' } as never),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── addPhase() ────────────────────────────────────────────────────────

  describe('addPhase()', () => {
    it('agrega una fase con order = maximo existente + 1 (D-5)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.aggregate.mockResolvedValue({ _max: { order: 2 } });
      mockPrisma.phase.create.mockResolvedValue({
        id: 'phase-uuid',
        name: 'Fase 3',
        order: 3,
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      });

      const result = await service.addPhase(COACH_ID, PLAN_ID, {
        name: 'Fase 3',
      } as never);

      expect(mockPrisma.phase.create).toHaveBeenCalledWith({
        data: { planId: PLAN_ID, name: 'Fase 3', order: 3 },
      });
      expect(result.order).toBe(3);
    });

    it('calcula order=1 cuando no hay fases previas', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.aggregate.mockResolvedValue({ _max: { order: null } });
      mockPrisma.phase.create.mockResolvedValue({
        id: 'phase-uuid',
        name: 'Fase 1',
        order: 1,
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      });

      await service.addPhase(COACH_ID, PLAN_ID, { name: 'Fase 1' } as never);

      expect(mockPrisma.phase.create).toHaveBeenCalledWith({
        data: { planId: PLAN_ID, name: 'Fase 1', order: 1 },
      });
    });

    it('traduce P2002 a DUPLICATE_ENTITY (condicion de carrera del @@unique)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(
          Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
        ),
      );

      await expect(
        service.addPhase(COACH_ID, PLAN_ID, { name: 'x' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.DUPLICATE_ENTITY });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error no-P2002', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(
        service.addPhase(COACH_ID, PLAN_ID, { name: 'x' } as never),
      ).rejects.toThrow(TechnicalException);
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.addPhase(COACH_ID, 'inexistente', { name: 'x' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });
  });

  // ── removePhase() ─────────────────────────────────────────────────────

  describe('removePhase()', () => {
    it('elimina la fase (hard-delete real, D-7)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue({
        id: 'phase-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.phase.delete.mockResolvedValue({});

      const result = await service.removePhase(COACH_ID, PLAN_ID, 'phase-uuid');

      expect(mockPrisma.phase.delete).toHaveBeenCalledWith({
        where: { id: 'phase-uuid' },
      });
      expect(result).toEqual({
        data: null,
        message: 'Fase eliminada exitosamente',
      });
    });

    it('lanza ENTITY_NOT_FOUND si la fase no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue(null);

      await expect(
        service.removePhase(COACH_ID, PLAN_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
      expect(mockPrisma.phase.delete).not.toHaveBeenCalled();
    });

    it('lanza ENTITY_NOT_FOUND si la fase pertenece a otro plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue({
        id: 'phase-uuid',
        planId: 'otro-plan-uuid',
      });

      await expect(
        service.removePhase(COACH_ID, PLAN_ID, 'phase-uuid'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue({
        id: 'phase-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.phase.delete.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.removePhase(COACH_ID, PLAN_ID, 'phase-uuid'),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── addWeek() ─────────────────────────────────────────────────────────

  describe('addWeek()', () => {
    it('agrega una semana con weekNumber secuencial a TODO el plan (D-4)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue({
        id: 'phase-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.week.count.mockResolvedValue(3);
      mockPrisma.week.create.mockResolvedValue({
        id: 'week-uuid',
        weekNumber: 4,
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      });

      const result = await service.addWeek(COACH_ID, PLAN_ID, 'phase-uuid');

      expect(mockPrisma.week.count).toHaveBeenCalledWith({
        where: { planId: PLAN_ID },
      });
      expect(mockPrisma.week.create).toHaveBeenCalledWith({
        data: { phaseId: 'phase-uuid', planId: PLAN_ID, weekNumber: 4 },
      });
      expect(result.weekNumber).toBe(4);
    });

    it('lanza ENTITY_NOT_FOUND si la fase no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue(null);

      await expect(
        service.addWeek(COACH_ID, PLAN_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('traduce P2002 a DUPLICATE_ENTITY', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue({
        id: 'phase-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(
          Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
        ),
      );

      await expect(
        service.addWeek(COACH_ID, PLAN_ID, 'phase-uuid'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.DUPLICATE_ENTITY });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error no-P2002', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.phase.findUnique.mockResolvedValue({
        id: 'phase-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(
        service.addWeek(COACH_ID, PLAN_ID, 'phase-uuid'),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── removeWeek() ──────────────────────────────────────────────────────

  describe('removeWeek()', () => {
    it('elimina la semana (hard-delete real, ruta plana D-9)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue({
        id: 'week-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.week.delete.mockResolvedValue({});

      const result = await service.removeWeek(COACH_ID, PLAN_ID, 'week-uuid');

      expect(mockPrisma.week.delete).toHaveBeenCalledWith({
        where: { id: 'week-uuid' },
      });
      expect(result.message).toBe('Semana eliminada exitosamente');
    });

    it('lanza ENTITY_NOT_FOUND si la semana no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue({
        id: 'week-uuid',
        planId: 'otro-plan-uuid',
      });

      await expect(
        service.removeWeek(COACH_ID, PLAN_ID, 'week-uuid'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue({
        id: 'week-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.week.delete.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.removeWeek(COACH_ID, PLAN_ID, 'week-uuid'),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── addSession() ──────────────────────────────────────────────────────

  describe('addSession()', () => {
    it('agrega una sesion con order = maximo existente en la semana + 1', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue({
        id: 'week-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.session.aggregate.mockResolvedValue({ _max: { order: 1 } });
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-uuid',
        name: 'Dia 2',
        order: 2,
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      });

      const result = await service.addSession(COACH_ID, PLAN_ID, 'week-uuid', {
        name: 'Dia 2',
      } as never);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: { weekId: 'week-uuid', name: 'Dia 2', order: 2 },
      });
      expect(result.order).toBe(2);
    });

    it('lanza ENTITY_NOT_FOUND si la semana no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue(null);

      await expect(
        service.addSession(COACH_ID, PLAN_ID, 'inexistente', {
          name: 'x',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('traduce P2002 a DUPLICATE_ENTITY', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue({
        id: 'week-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(
          Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
        ),
      );

      await expect(
        service.addSession(COACH_ID, PLAN_ID, 'week-uuid', {
          name: 'x',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.DUPLICATE_ENTITY });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error no-P2002', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.week.findUnique.mockResolvedValue({
        id: 'week-uuid',
        planId: PLAN_ID,
      });
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(
        service.addSession(COACH_ID, PLAN_ID, 'week-uuid', {
          name: 'x',
        } as never),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── removeSession() ───────────────────────────────────────────────────

  describe('removeSession()', () => {
    it('elimina la sesion (hard-delete real, ruta plana D-9)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.session.delete.mockResolvedValue({});

      const result = await service.removeSession(
        COACH_ID,
        PLAN_ID,
        'session-uuid',
      );

      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-uuid' },
      });
      expect(result.message).toBe('Sesion eliminada exitosamente');
    });

    it('lanza ENTITY_NOT_FOUND si la sesion no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: 'otro-plan-uuid' },
      });

      await expect(
        service.removeSession(COACH_ID, PLAN_ID, 'session-uuid'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.session.delete.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.removeSession(COACH_ID, PLAN_ID, 'session-uuid'),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── addSessionExercise() ──────────────────────────────────────────────

  describe('addSessionExercise()', () => {
    it('agrega el ejercicio resolviendo la ExerciseVersion vigente (RN-07, D-2)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.exercise.findUnique.mockResolvedValue({
        id: 'exercise-uuid',
        name: 'Sentadilla',
        isActive: true,
        versions: [buildExerciseVersion({ versionNumber: 2 })],
      });
      mockPrisma.sessionExercise.aggregate.mockResolvedValue({
        _max: { order: null },
      });
      mockPrisma.sessionExercise.create.mockResolvedValue(
        buildSessionExercise({ order: 1 }),
      );

      const result = await service.addSessionExercise(
        COACH_ID,
        PLAN_ID,
        'session-uuid',
        { exerciseId: 'exercise-uuid' } as never,
      );

      expect(mockPrisma.sessionExercise.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-uuid',
          exerciseVersionId: 'version-uuid',
          order: 1,
          sets: null,
          reps: null,
          loadKg: null,
          durationSeconds: null,
          distanceMeters: null,
        },
      });
      expect(result.versionNumber).toBe(2);
      expect(result.exerciseId).toBe('exercise-uuid');
    });

    it('lanza ENTITY_NOT_FOUND si la sesion no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.addSessionExercise(COACH_ID, PLAN_ID, 'inexistente', {
          exerciseId: 'exercise-uuid',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza ENTITY_NOT_FOUND si el ejercicio no existe en la biblioteca (RN-04)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.addSessionExercise(COACH_ID, PLAN_ID, 'session-uuid', {
          exerciseId: 'inexistente',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
      expect(mockPrisma.sessionExercise.create).not.toHaveBeenCalled();
    });

    it('lanza EXERCISE_INACTIVE (422) si el ejercicio esta inhabilitado, sin crear el SessionExercise', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.exercise.findUnique.mockResolvedValue({
        id: 'exercise-uuid',
        name: 'Sentadilla',
        isActive: false,
        versions: [buildExerciseVersion()],
      });

      await expect(
        service.addSessionExercise(COACH_ID, PLAN_ID, 'session-uuid', {
          exerciseId: 'exercise-uuid',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.EXERCISE_INACTIVE });
      expect(mockPrisma.sessionExercise.create).not.toHaveBeenCalled();
    });

    it('traduce P2002 a DUPLICATE_ENTITY', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.exercise.findUnique.mockResolvedValue({
        id: 'exercise-uuid',
        name: 'Sentadilla',
        isActive: true,
        versions: [buildExerciseVersion()],
      });
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(
          Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
        ),
      );

      await expect(
        service.addSessionExercise(COACH_ID, PLAN_ID, 'session-uuid', {
          exerciseId: 'exercise-uuid',
        } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.DUPLICATE_ENTITY });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error no-P2002', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.exercise.findUnique.mockResolvedValue({
        id: 'exercise-uuid',
        name: 'Sentadilla',
        isActive: true,
        versions: [buildExerciseVersion()],
      });
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(
        service.addSessionExercise(COACH_ID, PLAN_ID, 'session-uuid', {
          exerciseId: 'exercise-uuid',
        } as never),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── updateSessionExercisePrescription() ───────────────────────────────

  describe('updateSessionExercisePrescription()', () => {
    it('D-15: edita la prescripcion (actualizacion PARCIAL — solo los campos enviados)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue(
        buildSessionExercise(),
      );
      mockPrisma.sessionExercise.update.mockResolvedValue(
        buildSessionExercise({ sets: 5, reps: 8 }),
      );

      const result = await service.updateSessionExercisePrescription(
        COACH_ID,
        PLAN_ID,
        'session-uuid',
        'session-exercise-uuid',
        { sets: 5, reps: 8 } as never,
      );

      expect(mockPrisma.sessionExercise.update).toHaveBeenCalledWith({
        where: { id: 'session-exercise-uuid' },
        data: { sets: 5, reps: 8 },
        include: { exerciseVersion: { include: { exercise: true } } },
      });
      expect(result.sets).toBe(5);
      expect(result.reps).toBe(8);
    });

    it('D-15: un campo omitido del DTO NO se sobreescribe a null (actualizacion parcial)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue(
        buildSessionExercise(),
      );
      mockPrisma.sessionExercise.update.mockResolvedValue(
        buildSessionExercise({ loadKg: 80 }),
      );

      await service.updateSessionExercisePrescription(
        COACH_ID,
        PLAN_ID,
        'session-uuid',
        'session-exercise-uuid',
        { loadKg: 80 } as never,
      );

      expect(mockPrisma.sessionExercise.update).toHaveBeenCalledWith({
        where: { id: 'session-exercise-uuid' },
        data: { loadKg: 80 },
        include: { exerciseVersion: { include: { exercise: true } } },
      });
    });

    it('lanza ENTITY_NOT_FOUND si la sesion no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSessionExercisePrescription(
          COACH_ID,
          PLAN_ID,
          'inexistente',
          'session-exercise-uuid',
          { sets: 4 } as never,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza ENTITY_NOT_FOUND si el ejercicio de sesion no existe o no pertenece a la sesion', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSessionExercisePrescription(
          COACH_ID,
          PLAN_ID,
          'session-uuid',
          'inexistente',
          { sets: 4 } as never,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ coachId: OTHER_COACH_ID }),
      );

      await expect(
        service.updateSessionExercisePrescription(
          COACH_ID,
          PLAN_ID,
          'session-uuid',
          'session-exercise-uuid',
          { sets: 4 } as never,
        ),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue(
        buildSessionExercise(),
      );
      mockPrisma.sessionExercise.update.mockRejectedValue(
        new Error('DB caida'),
      );

      await expect(
        service.updateSessionExercisePrescription(
          COACH_ID,
          PLAN_ID,
          'session-uuid',
          'session-exercise-uuid',
          { sets: 4 } as never,
        ),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── removeSessionExercise() ───────────────────────────────────────────

  describe('removeSessionExercise()', () => {
    it('elimina el ejercicio de la sesion (hard-delete real)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue({
        id: 'session-exercise-uuid',
        sessionId: 'session-uuid',
      });
      mockPrisma.sessionExercise.delete.mockResolvedValue({});

      const result = await service.removeSessionExercise(
        COACH_ID,
        PLAN_ID,
        'session-uuid',
        'session-exercise-uuid',
      );

      expect(mockPrisma.sessionExercise.delete).toHaveBeenCalledWith({
        where: { id: 'session-exercise-uuid' },
      });
      expect(result.message).toBe(
        'Ejercicio eliminado exitosamente de la sesion',
      );
    });

    it('lanza ENTITY_NOT_FOUND si la sesion no existe o no pertenece al plan', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.removeSessionExercise(
          COACH_ID,
          PLAN_ID,
          'inexistente',
          'session-exercise-uuid',
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza ENTITY_NOT_FOUND si el ejercicio de sesion no existe o no pertenece a la sesion', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue({
        id: 'session-exercise-uuid',
        sessionId: 'otra-sesion-uuid',
      });

      await expect(
        service.removeSessionExercise(
          COACH_ID,
          PLAN_ID,
          'session-uuid',
          'session-exercise-uuid',
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-uuid',
        week: { planId: PLAN_ID },
      });
      mockPrisma.sessionExercise.findUnique.mockResolvedValue({
        id: 'session-exercise-uuid',
        sessionId: 'session-uuid',
      });
      mockPrisma.sessionExercise.delete.mockRejectedValue(
        new Error('DB caida'),
      );

      await expect(
        service.removeSessionExercise(
          COACH_ID,
          PLAN_ID,
          'session-uuid',
          'session-exercise-uuid',
        ),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── publish() ─────────────────────────────────────────────────────────

  describe('publish()', () => {
    function buildCompleteTree() {
      return buildPlanTree({
        phases: [
          {
            id: 'phase-uuid',
            weeks: [
              {
                id: 'week-uuid',
                sessions: [
                  {
                    id: 'session-uuid',
                    exercises: [buildSessionExercise()],
                  },
                ],
              },
            ],
          },
        ],
      });
    }

    it('publica el plan (Borrador -> Publicado) y emite plan.published', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildCompleteTree());
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );

      const result = await service.publish(COACH_ID, PLAN_ID);

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: { status: PlanStatus.PUBLISHED },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan.published', {
        planId: PLAN_ID,
        coachId: COACH_ID,
      });
      expect(result.status).toBe(PlanStatus.PUBLISHED);
    });

    it('lanza INVALID_STATE_TRANSITION si el plan no esta en Borrador', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlanTree({ status: PlanStatus.PUBLISHED }),
      );

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
      expect(mockPrisma.plan.update).not.toHaveBeenCalled();
    });

    it('lanza PLAN_INCOMPLETE listando TODOS los requisitos faltantes de un plan vacio (CA-009-2)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlanTree({
          name: '',
          startDate: null,
          endDate: null,
          phases: [],
        }),
      );

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.PLAN_INCOMPLETE,
        context: expect.objectContaining({
          missingRequirements: expect.arrayContaining([
            'nombre',
            'fecha de inicio',
            'fecha de fin',
            'al menos una fase',
          ]),
        }),
      });
    });

    it('lanza PLAN_INCOMPLETE si hay fase pero ninguna semana', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlanTree({ phases: [{ id: 'phase-uuid', weeks: [] }] }),
      );

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        context: expect.objectContaining({
          missingRequirements: ['al menos una semana en una fase'],
        }),
      });
    });

    it('lanza PLAN_INCOMPLETE si hay semana pero ninguna sesion', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlanTree({
          phases: [
            { id: 'phase-uuid', weeks: [{ id: 'week-uuid', sessions: [] }] },
          ],
        }),
      );

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        context: expect.objectContaining({
          missingRequirements: ['al menos una sesion en una semana'],
        }),
      });
    });

    it('lanza PLAN_INCOMPLETE si hay sesion pero ningun ejercicio', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlanTree({
          phases: [
            {
              id: 'phase-uuid',
              weeks: [
                {
                  id: 'week-uuid',
                  sessions: [{ id: 'session-uuid', exercises: [] }],
                },
              ],
            },
          ],
        }),
      );

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        context: expect.objectContaining({
          missingRequirements: ['al menos un ejercicio en una sesion'],
        }),
      });
    });

    it(
      'D-15: lanza PLAN_INCOMPLETE cuando un SessionExercise tiene sets sin reps ' +
        '(ni durationSeconds ni distanceMeters) — prescripcion NO significativa por ' +
        'ninguno de los dos regimenes',
      async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(
          buildPlanTree({
            phases: [
              {
                id: 'phase-uuid',
                weeks: [
                  {
                    id: 'week-uuid',
                    sessions: [
                      {
                        id: 'session-uuid',
                        name: 'Dia 1',
                        exercises: [
                          buildSessionExercise({
                            sets: 4,
                            reps: null,
                            loadKg: null,
                            durationSeconds: null,
                            distanceMeters: null,
                          }),
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        );

        await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
          errorEntry: BusinessError.PLAN_INCOMPLETE,
          context: expect.objectContaining({
            missingRequirements: expect.arrayContaining([
              expect.stringContaining('prescripcion'),
            ]) as unknown,
          }),
        });
        expect(mockPrisma.plan.update).not.toHaveBeenCalled();
      },
    );

    it(
      'D-15: ACEPTA un plan con un SessionExercise de regimen de fuerza (sets+reps, ' +
        'sin loadKg) y otro de regimen de resistencia (solo distanceMeters, sin ' +
        'durationSeconds) en la MISMA sesion — no exige los 5 campos ni el par completo',
      async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(
          buildPlanTree({
            phases: [
              {
                id: 'phase-uuid',
                weeks: [
                  {
                    id: 'week-uuid',
                    sessions: [
                      {
                        id: 'session-uuid',
                        name: 'Dia 1',
                        exercises: [
                          buildSessionExercise({
                            id: 'session-exercise-fuerza',
                            sets: 4,
                            reps: 10,
                            loadKg: null,
                            durationSeconds: null,
                            distanceMeters: null,
                          }),
                          buildSessionExercise({
                            id: 'session-exercise-resistencia',
                            sets: null,
                            reps: null,
                            loadKg: null,
                            durationSeconds: null,
                            distanceMeters: 5000,
                          }),
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        );
        mockPrisma.plan.update.mockResolvedValue(
          buildPlan({ status: PlanStatus.PUBLISHED }),
        );

        const result = await service.publish(COACH_ID, PLAN_ID);

        expect(result.status).toBe(PlanStatus.PUBLISHED);
        expect(mockPrisma.plan.update).toHaveBeenCalledWith({
          where: { id: PLAN_ID },
          data: { status: PlanStatus.PUBLISHED },
        });
      },
    );

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.publish(COACH_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach (CA-009-5)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        ...buildCompleteTree(),
        coachId: OTHER_COACH_ID,
      });

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB al publicar', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildCompleteTree());
      mockPrisma.plan.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.publish(COACH_ID, PLAN_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── unpublish() ───────────────────────────────────────────────────────

  describe('unpublish()', () => {
    it('despublica el plan (Publicado -> Borrador) cuando NO tiene suscriptores', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );

      const result = await service.unpublish(COACH_ID, PLAN_ID);

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: { status: PlanStatus.DRAFT },
      });
      expect(result.status).toBe(PlanStatus.DRAFT);
    });

    it('lanza PLAN_HAS_SUBSCRIBERS (CA-009-7) cuando hay al menos un suscriptor Aprobado o Activo — hasSubscribers() ya NO es un stub (EPICA-04)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );
      mockPrisma.subscription.count.mockResolvedValue(1);

      await expect(service.unpublish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.PLAN_HAS_SUBSCRIBERS,
      });
      expect(mockPrisma.plan.update).not.toHaveBeenCalled();
    });

    it(
      'hasSubscribers(planId) consulta Subscription con status IN [APPROVED, ACTIVE] ' +
        'y excluye PENDING (cierra el gap declarado de CA-009-7 de EPICA-03)',
      async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(
          buildPlan({ status: PlanStatus.PUBLISHED }),
        );
        mockPrisma.subscription.count.mockResolvedValue(0);
        mockPrisma.plan.update.mockResolvedValue(
          buildPlan({ status: PlanStatus.DRAFT }),
        );

        await service.unpublish(COACH_ID, PLAN_ID);

        expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
          where: {
            planId: PLAN_ID,
            status: {
              in: [SubscriptionStatus.APPROVED, SubscriptionStatus.ACTIVE],
            },
          },
        });
      },
    );

    it('un plan con solo suscripciones Pendientes SI se puede despublicar (Pendiente no cuenta como "suscrito")', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );
      // El mock replica el filtro real: count() sobre status IN [APPROVED,
      // ACTIVE] retorna 0 aunque existan suscripciones Pendientes en la DB.
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );

      await expect(service.unpublish(COACH_ID, PLAN_ID)).resolves.toMatchObject(
        { status: PlanStatus.DRAFT },
      );
    });

    it('lanza INVALID_STATE_TRANSITION si el plan no esta Publicado', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );

      await expect(service.unpublish(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.unpublish(COACH_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED }),
      );
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.plan.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.unpublish(COACH_ID, PLAN_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── archive() ─────────────────────────────────────────────────────────

  describe('archive()', () => {
    it('archiva un plan en Borrador', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ status: PlanStatus.ARCHIVED }),
      );

      const result = await service.archive(COACH_ID, PLAN_ID);

      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: { status: PlanStatus.ARCHIVED },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan.archived', {
        planId: PLAN_ID,
        coachId: COACH_ID,
      });
      expect(result.status).toBe(PlanStatus.ARCHIVED);
    });

    it(
      'archiva sin error un plan Publicado-y-vencido (persistido aun PUBLISHED) — ' +
        'D-1 no acopla archive() a una coercion previa a FINALIZED',
      async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(
          buildPlan({
            status: PlanStatus.PUBLISHED,
            endDate: new Date('2020-01-01T00:00:00.000Z'),
          }),
        );
        mockPrisma.plan.update.mockResolvedValue(
          buildPlan({ status: PlanStatus.ARCHIVED }),
        );

        await expect(service.archive(COACH_ID, PLAN_ID)).resolves.toMatchObject(
          { status: PlanStatus.ARCHIVED },
        );

        // Emite plan.finalized ANTES de archivar (status efectivo FINALIZED,
        // persistido todavia PUBLISHED) y siempre plan.archived
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan.finalized', {
          planId: PLAN_ID,
          coachId: COACH_ID,
        });
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan.archived', {
          planId: PLAN_ID,
          coachId: COACH_ID,
        });
      },
    );

    it('NO emite plan.finalized si el plan ya estaba FINALIZED persistido', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({
          status: PlanStatus.FINALIZED,
          endDate: new Date('2020-01-01T00:00:00.000Z'),
        }),
      );
      mockPrisma.plan.update.mockResolvedValue(
        buildPlan({ status: PlanStatus.ARCHIVED }),
      );

      await service.archive(COACH_ID, PLAN_ID);

      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'plan.finalized',
        expect.anything(),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan.archived', {
        planId: PLAN_ID,
        coachId: COACH_ID,
      });
    });

    it('lanza INVALID_STATE_TRANSITION si el plan ya esta Archivado (CA-010-3)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.ARCHIVED }),
      );

      await expect(service.archive(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
      expect(mockPrisma.plan.update).not.toHaveBeenCalled();
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.archive(COACH_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach (CA-010-4)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ coachId: OTHER_COACH_ID }),
      );

      await expect(service.archive(COACH_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );
      mockPrisma.plan.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.archive(COACH_ID, PLAN_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── findPublished() (catalogo, HU-011) ───────────────────────────────

  describe('findPublished()', () => {
    it('filtra status=PUBLISHED AND endDate>=now() a nivel de query (D-1, CA-011-1/CA-011-3)', async () => {
      mockPrisma.plan.count.mockResolvedValue(1);
      mockPrisma.plan.findMany.mockResolvedValue([
        {
          ...buildPlan(),
          coach: { id: COACH_ID, name: 'Carlos', avatarUrl: null },
        },
      ]);

      const result = await service.findPublished();

      expect(mockPrisma.plan.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: PlanStatus.PUBLISHED,
          endDate: { gte: expect.any(Date) },
        }),
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].coach).toEqual({
        id: COACH_ID,
        name: 'Carlos',
        avatarUrl: null,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('timeout')),
      );

      await expect(service.findPublished()).rejects.toThrow(TechnicalException);
    });
  });

  // ── findPublishedOne() (catalogo, HU-011) ────────────────────────────

  describe('findPublishedOne()', () => {
    it('retorna el perfil publico COMPLETO del entrenador cuando tiene CoachRequest APPROVED (D-2b)', async () => {
      mockPrisma.plan.findFirst.mockResolvedValue({
        ...buildPlanTree({
          phases: [
            {
              id: 'phase-uuid',
              name: 'Fase 1',
              weeks: [
                {
                  id: 'week-uuid',
                  weekNumber: 1,
                  sessions: [
                    {
                      id: 'session-uuid',
                      name: 'Dia 1',
                      _count: { exercises: 5 },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        coach: {
          id: COACH_ID,
          name: 'Carlos',
          avatarUrl: null,
          coachRequest: {
            status: CoachRequestStatus.APPROVED,
            planDescription: 'Entrenador certificado',
            bannerUrl: 'https://storage.fitmess.co/banners/carlos.jpg',
          },
        },
      });

      const result = await service.findPublishedOne(PLAN_ID);

      expect(result.phases[0].weeks[0].sessions[0]).toEqual({
        id: 'session-uuid',
        name: 'Dia 1',
        exerciseCount: 5,
      });
      expect(result.coach).toEqual({
        id: COACH_ID,
        name: 'Carlos',
        avatarUrl: null,
        description: 'Entrenador certificado',
        bannerUrl: 'https://storage.fitmess.co/banners/carlos.jpg',
      });
    });

    it('retorna description/bannerUrl en null si el entrenador NO tiene CoachRequest APPROVED (D-2b)', async () => {
      mockPrisma.plan.findFirst.mockResolvedValue({
        ...buildPlanTree({ phases: [] }),
        coach: {
          id: COACH_ID,
          name: 'Carlos',
          avatarUrl: null,
          coachRequest: null,
        },
      });

      const result = await service.findPublishedOne(PLAN_ID);

      expect(result.coach.description).toBeNull();
      expect(result.coach.bannerUrl).toBeNull();
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe, no esta Publicado o ya vencio', async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublishedOne('inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });
  });

  // ── normalizePage()/normalizeLimit() (via findAll) ───────────────────

  describe('normalizacion de paginacion', () => {
    it('usa page=1 cuando no se envia page', async () => {
      mockPrisma.plan.count.mockResolvedValue(0);
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const result = await service.findAll(COACH_ID, undefined, undefined);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('usa limit=20 por defecto cuando limit es 0 o negativo', async () => {
      mockPrisma.plan.count.mockResolvedValue(0);
      mockPrisma.plan.findMany.mockResolvedValue([]);

      await service.findAll(COACH_ID, 1, 0);

      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });
});
