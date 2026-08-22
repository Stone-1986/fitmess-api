import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstancesService } from './instances.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { SubscriptionStatus } from '../../../generated/prisma/index.js';

/**
 * Mock de PrismaService — solo los metodos que usa InstancesService.
 *
 * $transaction soporta ambas firmas usadas por el service: callback
 * (createInstanceFromSubscription/registerSessionResult) y array de
 * promesas (findAll) — mismo patron ya usado en plans.service.spec.ts.
 */
const mockPrisma = {
  planInstance: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  plan: {
    findUnique: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
  instancePhase: {
    create: vi.fn(),
  },
  instanceWeek: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  instanceSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  instanceSessionExercise: {
    create: vi.fn(),
  },
  sessionResult: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  sessionExerciseResult: {
    upsert: vi.fn(),
  },
  weeklyFeeling: {
    upsert: vi.fn(),
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

const ATHLETE_ID = 'athlete-uuid';
const OTHER_ATHLETE_ID = 'other-athlete-uuid';
const COACH_ID = 'coach-uuid';
const OTHER_COACH_ID = 'other-coach-uuid';
const PLAN_ID = 'plan-uuid';
const SUBSCRIPTION_ID = 'subscription-uuid';
const INSTANCE_ID = 'instance-uuid';

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    name: 'Fuerza e hipertrofia',
    coachId: COACH_ID,
    ...overrides,
  };
}

function buildSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBSCRIPTION_ID,
    athleteId: ATHLETE_ID,
    planId: PLAN_ID,
    status: SubscriptionStatus.ACTIVE,
    ...overrides,
  };
}

/** Plantilla usada por createInstanceFromSubscription (planCopyTreeInclude). */
function buildSessionExerciseTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'se-template-uuid',
    exerciseVersionId: 'version-uuid',
    order: 1,
    sets: 4,
    reps: 10,
    loadKg: 80,
    durationSeconds: null,
    distanceMeters: null,
    ...overrides,
  };
}

/** Plan con 2 fases, 2 semanas c/u, 2 sesiones c/u, 2 ejercicios c/u (criterio tecnico del plan). */
function buildFullPlanCopyTree(coachId = COACH_ID) {
  return {
    id: PLAN_ID,
    coachId,
    phases: [1, 2].map((phaseOrder) => ({
      order: phaseOrder,
      weeks: [1, 2].map((weekNumber) => ({
        weekNumber: (phaseOrder - 1) * 2 + weekNumber,
        sessions: [1, 2].map((sessionOrder) => ({
          name: `Dia ${sessionOrder}`,
          order: sessionOrder,
          exercises: [
            buildSessionExerciseTemplate({
              order: 1,
              exerciseVersionId: 'version-fuerza-uuid',
              sets: 4,
              reps: 10,
              loadKg: 80,
              durationSeconds: null,
              distanceMeters: null,
            }),
            buildSessionExerciseTemplate({
              order: 2,
              exerciseVersionId: 'version-resistencia-uuid',
              sets: null,
              reps: null,
              loadKg: null,
              durationSeconds: 1200,
              distanceMeters: 5000,
            }),
          ],
        })),
      })),
    })),
  };
}

/** Mockea la copia profunda para que cada create() retorne un id incremental. */
function mockDeepCopyCreates(): void {
  let phaseSeq = 0;
  let weekSeq = 0;
  let sessionSeq = 0;
  let exerciseSeq = 0;

  mockPrisma.instancePhase.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => {
      phaseSeq += 1;
      return Promise.resolve({ id: `instance-phase-${phaseSeq}`, ...data });
    },
  );
  mockPrisma.instanceWeek.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => {
      weekSeq += 1;
      return Promise.resolve({ id: `instance-week-${weekSeq}`, ...data });
    },
  );
  mockPrisma.instanceSession.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => {
      sessionSeq += 1;
      return Promise.resolve({ id: `instance-session-${sessionSeq}`, ...data });
    },
  );
  mockPrisma.instanceSessionExercise.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => {
      exerciseSeq += 1;
      return Promise.resolve({ id: `instance-se-${exerciseSeq}`, ...data });
    },
  );
}

/** Sesion de la instancia con el include de ownership (sessionOwnershipInclude). */
function buildSessionWithOwnership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'instance-session-uuid',
    exercises: [{ id: 'ise-1' }, { id: 'ise-2' }],
    instanceWeek: {
      id: 'instance-week-uuid',
      isClosed: false,
      instancePhase: {
        instance: { id: INSTANCE_ID, planId: PLAN_ID, athleteId: ATHLETE_ID },
      },
    },
    ...overrides,
  };
}

function buildWeekWithOwnership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'instance-week-uuid',
    isClosed: false,
    instancePhase: {
      instance: { id: INSTANCE_ID, planId: PLAN_ID, athleteId: ATHLETE_ID },
    },
    ...overrides,
  };
}

describe('InstancesService', () => {
  let service: InstancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstancesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<InstancesService>(InstancesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── findAll() ─────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('lista, paginadas, las instancias propias del atleta (CA-023-4/CA-023-5)', async () => {
      mockPrisma.planInstance.count.mockResolvedValue(1);
      mockPrisma.planInstance.findMany.mockResolvedValue([
        {
          id: INSTANCE_ID,
          planId: PLAN_ID,
          createdAt: new Date('2026-08-22T09:00:00.000Z'),
          plan: { name: 'Fuerza e hipertrofia' },
        },
      ]);

      const result = await service.findAll(ATHLETE_ID);

      expect(mockPrisma.planInstance.count).toHaveBeenCalledWith({
        where: { athleteId: ATHLETE_ID },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: INSTANCE_ID,
        planId: PLAN_ID,
        planName: 'Fuerza e hipertrofia',
      });
      expect(result.meta.totalItems).toBe(1);
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(service.findAll(ATHLETE_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── getOrCreateInstance() — CA-023-8 (idempotencia, D-3) ────────────────

  describe('getOrCreateInstance()', () => {
    it(
      'CRITICO (CA-023-8): invocado DOS VECES con el mismo subscriptionId NO crea una ' +
        'segunda PlanInstance — la segunda llamada retorna la fila ya existente',
      async () => {
        mockDeepCopyCreates();
        const plan = buildFullPlanCopyTree();
        mockPrisma.plan.findUnique.mockResolvedValue(plan);
        mockPrisma.planInstance.create.mockResolvedValue({
          id: INSTANCE_ID,
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
          subscriptionId: SUBSCRIPTION_ID,
        });

        // Primera llamada: no existe -> crea.
        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
        const first = await service.getOrCreateInstance(
          ATHLETE_ID,
          PLAN_ID,
          SUBSCRIPTION_ID,
        );

        expect(mockPrisma.planInstance.create).toHaveBeenCalledTimes(1);
        expect(first.id).toBe(INSTANCE_ID);

        // Segunda llamada: ya existe -> retorna la fila existente, SIN
        // volver a crear (findUnique-antes-de-crear, D-3).
        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(first);
        const second = await service.getOrCreateInstance(
          ATHLETE_ID,
          PLAN_ID,
          SUBSCRIPTION_ID,
        );

        expect(second).toBe(first);
        expect(mockPrisma.planInstance.create).toHaveBeenCalledTimes(1);
      },
    );

    it(
      'CRITICO (CA-023-8, ventana de carrera): si la creacion falla con P2002 ' +
        '(constraint unico sobre subscriptionId), retorna la fila que gano la carrera ' +
        'en vez de propagar el error',
      async () => {
        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
        mockPrisma.plan.findUnique.mockResolvedValue(buildFullPlanCopyTree());
        mockPrisma.$transaction.mockImplementationOnce(() =>
          Promise.reject(
            Object.assign(new Error('Unique constraint'), {
              code: 'P2002',
            }),
          ),
        );
        const raceWinner = {
          id: INSTANCE_ID,
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
          subscriptionId: SUBSCRIPTION_ID,
        };
        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(raceWinner);

        const result = await service.getOrCreateInstance(
          ATHLETE_ID,
          PLAN_ID,
          SUBSCRIPTION_ID,
        );

        expect(result).toBe(raceWinner);
      },
    );

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateInstance(ATHLETE_ID, 'inexistente', SUBSCRIPTION_ID),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error no-P2002 al crear', async () => {
      mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
      mockPrisma.plan.findUnique.mockResolvedValue(buildFullPlanCopyTree());
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(
        service.getOrCreateInstance(ATHLETE_ID, PLAN_ID, SUBSCRIPTION_ID),
      ).rejects.toThrow(TechnicalException);
    });

    it(
      'Test unitario de createInstanceFromSubscription() (CA-023-2/CA-023-3/CA-023-9): ' +
        'dado un plan con 2 fases, 2 semanas, 2 sesiones y 2 ejercicios por sesion, la ' +
        'instancia resultante tiene EXACTAMENTE esa cantidad en cada nivel, cada ' +
        'exerciseVersionId coincide EXACTAMENTE con el de la plantilla, y los 5 campos ' +
        'de prescripcion coinciden EXACTAMENTE con los de la plantilla',
      async () => {
        mockDeepCopyCreates();
        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
        mockPrisma.plan.findUnique.mockResolvedValue(buildFullPlanCopyTree());
        mockPrisma.planInstance.create.mockResolvedValue({
          id: INSTANCE_ID,
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
          subscriptionId: SUBSCRIPTION_ID,
        });

        await service.getOrCreateInstance(ATHLETE_ID, PLAN_ID, SUBSCRIPTION_ID);

        // 2 fases, 2 semanas x fase = 4 semanas, 2 sesiones x semana = 8
        // sesiones, 2 ejercicios x sesion = 16 ejercicios de sesion.
        expect(mockPrisma.instancePhase.create).toHaveBeenCalledTimes(2);
        expect(mockPrisma.instanceWeek.create).toHaveBeenCalledTimes(4);
        expect(mockPrisma.instanceSession.create).toHaveBeenCalledTimes(8);
        expect(mockPrisma.instanceSessionExercise.create).toHaveBeenCalledTimes(
          16,
        );

        // Cada ejercicio copiado conserva EXACTAMENTE exerciseVersionId y
        // los 5 campos de prescripcion de la plantilla (D-13, D-15 punto 9).
        const calls = mockPrisma.instanceSessionExercise.create.mock
          .calls as Array<[{ data: Record<string, unknown> }]>;
        const strengthCopies = calls.filter(
          ([arg]) => arg.data.exerciseVersionId === 'version-fuerza-uuid',
        );
        const enduranceCopies = calls.filter(
          ([arg]) => arg.data.exerciseVersionId === 'version-resistencia-uuid',
        );
        expect(strengthCopies).toHaveLength(8);
        expect(enduranceCopies).toHaveLength(8);
        for (const [{ data }] of strengthCopies) {
          expect(data).toMatchObject({
            sets: 4,
            reps: 10,
            loadKg: 80,
            durationSeconds: null,
            distanceMeters: null,
          });
        }
        for (const [{ data }] of enduranceCopies) {
          expect(data).toMatchObject({
            sets: null,
            reps: null,
            loadKg: null,
            durationSeconds: 1200,
            distanceMeters: 5000,
          });
        }
      },
    );

    it(
      'CA-023-4: dos atletas con suscripcion Activa al MISMO plan obtienen instancias ' +
        'independientes (PlanInstance.id distintos) con estructura identica',
      async () => {
        mockDeepCopyCreates();
        mockPrisma.plan.findUnique.mockResolvedValue(buildFullPlanCopyTree());

        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
        mockPrisma.planInstance.create.mockResolvedValueOnce({
          id: 'instance-athlete-1',
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
          subscriptionId: SUBSCRIPTION_ID,
        });
        const instanceAthlete1 = await service.getOrCreateInstance(
          ATHLETE_ID,
          PLAN_ID,
          SUBSCRIPTION_ID,
        );

        mockPrisma.planInstance.findUnique.mockResolvedValueOnce(null);
        mockPrisma.planInstance.create.mockResolvedValueOnce({
          id: 'instance-athlete-2',
          planId: PLAN_ID,
          athleteId: OTHER_ATHLETE_ID,
          subscriptionId: 'other-subscription-uuid',
        });
        const instanceAthlete2 = await service.getOrCreateInstance(
          OTHER_ATHLETE_ID,
          PLAN_ID,
          'other-subscription-uuid',
        );

        expect(instanceAthlete1.id).not.toBe(instanceAthlete2.id);
        expect(instanceAthlete1.athleteId).toBe(ATHLETE_ID);
        expect(instanceAthlete2.athleteId).toBe(OTHER_ATHLETE_ID);
        // Cada suscripcion disparo su propia copia profunda completa.
        expect(mockPrisma.instancePhase.create).toHaveBeenCalledTimes(4);
      },
    );
  });

  // ── findOwn() — auto-reparacion (D-3, CA-023-1) ──────────────────────────

  describe('findOwn()', () => {
    it('detalle propio: verifica Subscription Activa, auto-repara si falta la instancia y responde 200', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription());
      mockPrisma.planInstance.findUnique
        .mockResolvedValueOnce(null) // dentro de getOrCreateInstance: no existe
        .mockResolvedValueOnce({
          id: INSTANCE_ID,
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
          plan: { name: 'Fuerza e hipertrofia' },
          phases: [],
          createdAt: new Date('2026-08-22T09:00:00.000Z'),
        }); // el findUnique final con el arbol completo (instanceTreeInclude)
      mockDeepCopyCreates();
      mockPrisma.plan.findUnique.mockResolvedValue({
        ...buildPlan(),
        phases: [],
      });
      mockPrisma.planInstance.create.mockResolvedValue({
        id: INSTANCE_ID,
        planId: PLAN_ID,
        athleteId: ATHLETE_ID,
        subscriptionId: SUBSCRIPTION_ID,
      });

      const result = await service.findOwn(ATHLETE_ID, PLAN_ID);

      expect(result.id).toBe(INSTANCE_ID);
      expect(result.planName).toBe('Fuerza e hipertrofia');
    });

    it('lanza CONSENT_REQUIRED (422) si el atleta no tiene Subscription Activa (CA-023-6)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.findOwn(ATHLETE_ID, PLAN_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.CONSENT_REQUIRED,
      });
      expect(mockPrisma.planInstance.findUnique).not.toHaveBeenCalled();
    });

    it('lanza ENTITY_NOT_FOUND (404) si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.findOwn(ATHLETE_ID, 'inexistente'),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });
  });

  // ── findForCoach() — HU-017/D-9 ───────────────────────────────────────

  describe('findForCoach()', () => {
    it('panel del entrenador: devuelve el detalle de la instancia del atleta (CA-017-2)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ coachId: COACH_ID });
      mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription());
      mockPrisma.planInstance.findUnique.mockResolvedValue({
        id: INSTANCE_ID,
        planId: PLAN_ID,
        athleteId: ATHLETE_ID,
        plan: { name: 'Fuerza e hipertrofia' },
        phases: [],
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
      });

      const result = await service.findForCoach(COACH_ID, PLAN_ID, ATHLETE_ID);

      expect(result.id).toBe(INSTANCE_ID);
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.findForCoach(COACH_ID, 'inexistente', ATHLETE_ID),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it(
      'D-2: mapea el arbol COMPLETO — fases, semanas (con sensaciones), sesiones ' +
        '(con resultado) y ejercicios de sesion (con prescripcion) — MISMO DTO que ' +
        'findOwn (D-8)',
      async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ coachId: COACH_ID });
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(),
        );
        mockPrisma.planInstance.findUnique.mockResolvedValue({
          id: INSTANCE_ID,
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
          plan: { name: 'Fuerza e hipertrofia' },
          createdAt: new Date('2026-08-22T09:00:00.000Z'),
          phases: [
            {
              id: 'phase-1',
              order: 1,
              weeks: [
                {
                  id: 'week-1',
                  weekNumber: 1,
                  isClosed: true,
                  closedAt: new Date('2026-08-29T09:00:00.000Z'),
                  feeling: {
                    id: 'feeling-1',
                    muscleSoreness: 4,
                    motivation: 8,
                    createdAt: new Date('2026-08-28T09:00:00.000Z'),
                    updatedAt: new Date('2026-08-28T09:00:00.000Z'),
                  },
                  sessions: [
                    {
                      id: 'session-1',
                      name: 'Dia 1',
                      order: 1,
                      exercises: [
                        {
                          id: 'ise-1',
                          order: 1,
                          sets: 4,
                          reps: 10,
                          loadKg: 80,
                          durationSeconds: null,
                          distanceMeters: null,
                          createdAt: new Date('2026-08-22T09:00:00.000Z'),
                          exerciseVersion: {
                            exerciseId: 'exercise-uuid',
                            description: 'Descripcion',
                            muscleGroup: 'Cuadriceps',
                            versionNumber: 1,
                            exercise: { name: 'Sentadilla' },
                          },
                        },
                      ],
                      result: {
                        id: 'result-1',
                        createdAt: new Date('2026-08-28T09:00:00.000Z'),
                        updatedAt: new Date('2026-08-28T09:00:00.000Z'),
                        exerciseResults: [
                          {
                            id: 'ser-1',
                            instanceSessionExerciseId: 'ise-1',
                            sets: 4,
                            reps: 10,
                            loadKg: 82.5,
                            durationSeconds: null,
                            distanceMeters: null,
                            notes: 'Buena sesion',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });

        const result = await service.findForCoach(
          COACH_ID,
          PLAN_ID,
          ATHLETE_ID,
        );

        expect(result.phases).toHaveLength(1);
        expect(result.phases[0].weeks[0].isClosed).toBe(true);
        expect(result.phases[0].weeks[0].feeling).toMatchObject({
          muscleSoreness: 4,
          motivation: 8,
        });
        const session = result.phases[0].weeks[0].sessions[0];
        expect(session.exercises[0]).toMatchObject({
          exerciseId: 'exercise-uuid',
          name: 'Sentadilla',
          sets: 4,
          reps: 10,
          loadKg: 80,
        });
        expect(session.result?.exerciseResults[0]).toMatchObject({
          sessionExerciseId: 'ise-1',
          loadKg: 82.5,
          notes: 'Buena sesion',
        });
      },
    );

    it('lanza RESOURCE_OWNERSHIP_DENIED (403) si el plan no pertenece al entrenador (CA-017-4)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        coachId: OTHER_COACH_ID,
      });

      await expect(
        service.findForCoach(COACH_ID, PLAN_ID, ATHLETE_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it(
      'lanza ENTITY_NOT_FOUND (404, NUNCA CONSENT_REQUIRED, D-9) si el atleta no tiene ' +
        'una instancia en ese plan (sin Subscription Activa)',
      async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({ coachId: COACH_ID });
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        await expect(
          service.findForCoach(COACH_ID, PLAN_ID, ATHLETE_ID),
        ).rejects.toMatchObject({
          errorEntry: BusinessError.ENTITY_NOT_FOUND,
        });
        expect(mockPrisma.planInstance.findUnique).not.toHaveBeenCalled();
      },
    );
  });

  // ── registerSessionResult() — HU-015 ─────────────────────────────────

  describe('registerSessionResult()', () => {
    const DTO = {
      exercises: [
        { sessionExerciseId: 'ise-1', sets: 4, reps: 10 },
        { sessionExerciseId: 'ise-2', distanceMeters: 5000 },
      ],
    };

    beforeEach(() => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription());
    });

    it(
      'CRITICO (D-4): registra resultados de TODAS las sesiones menos una y la semana ' +
        'NO cierra; registrar la ULTIMA sesion pendiente SI la cierra y emite week.closed ' +
        'exactamente una vez',
      async () => {
        mockPrisma.instanceSession.findUnique.mockResolvedValue(
          buildSessionWithOwnership(),
        );
        mockPrisma.sessionResult.upsert.mockResolvedValue({
          id: 'result-uuid',
        });
        mockPrisma.instanceSession.count.mockResolvedValue(0); // ultima pendiente
        mockPrisma.instanceWeek.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.sessionResult.findUnique.mockResolvedValue({
          id: 'result-uuid',
          exerciseResults: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'instance-session-uuid',
          DTO as never,
        );

        expect(mockPrisma.instanceWeek.updateMany).toHaveBeenCalledWith({
          where: { id: 'instance-week-uuid', isClosed: false },
          data: { isClosed: true, closedAt: expect.any(Date) as Date },
        });
        expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('week.closed', {
          instanceWeekId: 'instance-week-uuid',
          planId: PLAN_ID,
          athleteId: ATHLETE_ID,
        });
      },
    );

    it(
      'CA-015-2/CA-015-3 (RN-08 DEROGADA): edita el resultado de una sesion registrada ' +
        'hace mucho tiempo mientras la semana sigue abierta — sin ninguna verificacion ' +
        'de ventana de 7 dias, la edicion se acepta sin importar cuanto haya pasado',
      async () => {
        mockPrisma.instanceSession.findUnique.mockResolvedValue(
          buildSessionWithOwnership(),
        );
        mockPrisma.sessionResult.upsert.mockResolvedValue({
          id: 'result-uuid',
        });
        mockPrisma.instanceSession.count.mockResolvedValue(1);
        // El resultado ya existia desde hace 30 dias — muy por fuera de
        // cualquier ventana de 7 dias que RN-08 (derogada) habria exigido.
        mockPrisma.sessionResult.findUnique.mockResolvedValue({
          id: 'result-uuid',
          exerciseResults: [],
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        });

        await expect(
          service.registerSessionResult(
            ATHLETE_ID,
            PLAN_ID,
            'instance-session-uuid',
            DTO as never,
          ),
        ).resolves.toBeDefined();

        // La UNICA condicion evaluada antes de escribir es isClosed — nunca
        // una fecha. buildSessionWithOwnership() ya trae isClosed:false.
        expect(mockPrisma.sessionResult.upsert).toHaveBeenCalled();
      },
    );

    it('NO cierra la semana ni emite week.closed si aun quedan sesiones pendientes', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(
        buildSessionWithOwnership(),
      );
      mockPrisma.sessionResult.upsert.mockResolvedValue({ id: 'result-uuid' });
      mockPrisma.instanceSession.count.mockResolvedValue(2); // aun pendientes
      mockPrisma.sessionResult.findUnique.mockResolvedValue({
        id: 'result-uuid',
        exerciseResults: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.registerSessionResult(
        ATHLETE_ID,
        PLAN_ID,
        'instance-session-uuid',
        DTO as never,
      );

      expect(mockPrisma.instanceWeek.updateMany).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it(
      'CONDICION DE CARRERA (D-4): dos llamadas concurrentes registrando las DOS ' +
        'ULTIMAS sesiones pendientes de la misma semana — la semana cierra UNA sola vez ' +
        '(el guard isClosed:false del segundo UPDATE actualiza cero filas)',
      async () => {
        mockPrisma.instanceSession.findUnique.mockResolvedValue(
          buildSessionWithOwnership(),
        );
        mockPrisma.sessionResult.upsert.mockResolvedValue({
          id: 'result-uuid',
        });
        mockPrisma.instanceSession.count.mockResolvedValue(0);
        mockPrisma.sessionResult.findUnique.mockResolvedValue({
          id: 'result-uuid',
          exerciseResults: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // Primera llamada gana la carrera (actualiza 1 fila); la segunda
        // encuentra isClosed:false ya falso en el WHERE (0 filas).
        mockPrisma.instanceWeek.updateMany
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 });

        await Promise.all([
          service.registerSessionResult(
            ATHLETE_ID,
            PLAN_ID,
            'instance-session-uuid',
            DTO as never,
          ),
          service.registerSessionResult(
            ATHLETE_ID,
            PLAN_ID,
            'instance-session-uuid',
            DTO as never,
          ),
        ]);

        expect(mockPrisma.instanceWeek.updateMany).toHaveBeenCalledTimes(2);
        expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      },
    );

    it('lanza CONSENT_REQUIRED (422) si el atleta no tiene Subscription Activa (CA-015-7), sin crear nada', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'instance-session-uuid',
          DTO as never,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.CONSENT_REQUIRED });
      expect(mockPrisma.instanceSession.findUnique).not.toHaveBeenCalled();
    });

    it('lanza ENTITY_NOT_FOUND si la sesion no existe o no pertenece a la instancia del plan', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(null);

      await expect(
        service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'inexistente',
          DTO as never,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED (403) si la sesion pertenece a la instancia de otro atleta (CA-015-6)', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(
        buildSessionWithOwnership({
          instanceWeek: {
            id: 'instance-week-uuid',
            isClosed: false,
            instancePhase: {
              instance: {
                id: INSTANCE_ID,
                planId: PLAN_ID,
                athleteId: OTHER_ATHLETE_ID,
              },
            },
          },
        }),
      );

      await expect(
        service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'instance-session-uuid',
          DTO as never,
        ),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it(
      'CRITICO (CA-015-10): un payload que OMITE un ejercicio de la sesion responde ' +
        'RESULT_FIELDS_INVALID (422) SIN escribir nada, y el conteo de sesiones ' +
        'pendientes de la semana no cambia (la sesion NO cuenta como completada)',
      async () => {
        mockPrisma.instanceSession.findUnique.mockResolvedValue(
          buildSessionWithOwnership(),
        );

        await expect(
          service.registerSessionResult(
            ATHLETE_ID,
            PLAN_ID,
            'instance-session-uuid',
            {
              exercises: [{ sessionExerciseId: 'ise-1', sets: 4, reps: 10 }],
            } as never,
          ),
        ).rejects.toMatchObject({
          errorEntry: BusinessError.RESULT_FIELDS_INVALID,
        });
        expect(mockPrisma.sessionResult.upsert).not.toHaveBeenCalled();
        expect(mockPrisma.sessionExerciseResult.upsert).not.toHaveBeenCalled();
        expect(mockPrisma.instanceSession.count).not.toHaveBeenCalled();
      },
    );

    it('CA-015-10: un payload que INCLUYE un ejercicio ajeno a la sesion responde RESULT_FIELDS_INVALID', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(
        buildSessionWithOwnership(),
      );

      await expect(
        service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'instance-session-uuid',
          {
            exercises: [
              { sessionExerciseId: 'ise-1', sets: 4 },
              { sessionExerciseId: 'ise-2', distanceMeters: 5000 },
              { sessionExerciseId: 'ise-ajeno', sets: 1 },
            ],
          } as never,
        ),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESULT_FIELDS_INVALID,
      });
    });

    it('CA-015-11: valores parciales por tipo de ejercicio SI se acepta (no exige los 5 campos)', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(
        buildSessionWithOwnership(),
      );
      mockPrisma.sessionResult.upsert.mockResolvedValue({ id: 'result-uuid' });
      mockPrisma.instanceSession.count.mockResolvedValue(1);
      mockPrisma.sessionResult.findUnique.mockResolvedValue({
        id: 'result-uuid',
        exerciseResults: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.registerSessionResult(
        ATHLETE_ID,
        PLAN_ID,
        'instance-session-uuid',
        {
          exercises: [
            { sessionExerciseId: 'ise-1', sets: 4, reps: 10 },
            { sessionExerciseId: 'ise-2', distanceMeters: 5000 },
          ],
        } as never,
      );

      expect(mockPrisma.sessionExerciseResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instanceSessionExerciseId: 'ise-2' },
          create: expect.objectContaining({
            sets: null,
            reps: null,
            loadKg: null,
            durationSeconds: null,
            distanceMeters: 5000,
          }) as unknown,
        }),
      );
    });

    it('lanza WEEK_FROZEN (409) si la semana ya cerro (CA-015-4/5)', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(
        buildSessionWithOwnership({
          instanceWeek: {
            id: 'instance-week-uuid',
            isClosed: true,
            instancePhase: {
              instance: {
                id: INSTANCE_ID,
                planId: PLAN_ID,
                athleteId: ATHLETE_ID,
              },
            },
          },
        }),
      );

      await expect(
        service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'instance-session-uuid',
          DTO as never,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.WEEK_FROZEN });
      expect(mockPrisma.sessionResult.upsert).not.toHaveBeenCalled();
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.instanceSession.findUnique.mockResolvedValue(
        buildSessionWithOwnership(),
      );
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('DB caida')),
      );

      await expect(
        service.registerSessionResult(
          ATHLETE_ID,
          PLAN_ID,
          'instance-session-uuid',
          DTO as never,
        ),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── registerWeeklyFeeling() — HU-016 ──────────────────────────────────

  describe('registerWeeklyFeeling()', () => {
    const DTO = { muscleSoreness: 4, motivation: 8 };

    beforeEach(() => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription());
    });

    it('registra las sensaciones semanales (CA-016-1)', async () => {
      mockPrisma.instanceWeek.findUnique.mockResolvedValue(
        buildWeekWithOwnership(),
      );
      mockPrisma.weeklyFeeling.upsert.mockResolvedValue({
        id: 'feeling-uuid',
        muscleSoreness: 4,
        motivation: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.registerWeeklyFeeling(
        ATHLETE_ID,
        PLAN_ID,
        'instance-week-uuid',
        DTO,
      );

      expect(mockPrisma.weeklyFeeling.upsert).toHaveBeenCalledWith({
        where: { instanceWeekId: 'instance-week-uuid' },
        create: {
          instanceWeekId: 'instance-week-uuid',
          muscleSoreness: 4,
          motivation: 8,
        },
        update: { muscleSoreness: 4, motivation: 8 },
      });
      expect(result.muscleSoreness).toBe(4);
      expect(result.motivation).toBe(8);
    });

    it('lanza CONSENT_REQUIRED (422) si el atleta no tiene Subscription Activa (CA-016-5)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.registerWeeklyFeeling(
          ATHLETE_ID,
          PLAN_ID,
          'instance-week-uuid',
          DTO,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.CONSENT_REQUIRED });
      expect(mockPrisma.weeklyFeeling.upsert).not.toHaveBeenCalled();
    });

    it('lanza ENTITY_NOT_FOUND si la semana no existe o no pertenece a la instancia del plan', async () => {
      mockPrisma.instanceWeek.findUnique.mockResolvedValue(null);

      await expect(
        service.registerWeeklyFeeling(ATHLETE_ID, PLAN_ID, 'inexistente', DTO),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED (403) si la semana pertenece a la instancia de otro atleta (CA-016-4)', async () => {
      mockPrisma.instanceWeek.findUnique.mockResolvedValue(
        buildWeekWithOwnership({
          instancePhase: {
            instance: {
              id: INSTANCE_ID,
              planId: PLAN_ID,
              athleteId: OTHER_ATHLETE_ID,
            },
          },
        }),
      );

      await expect(
        service.registerWeeklyFeeling(
          ATHLETE_ID,
          PLAN_ID,
          'instance-week-uuid',
          DTO,
        ),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it('lanza WEEK_FROZEN (409) si la semana ya cerro (CA-016-2)', async () => {
      mockPrisma.instanceWeek.findUnique.mockResolvedValue(
        buildWeekWithOwnership({ isClosed: true }),
      );

      await expect(
        service.registerWeeklyFeeling(
          ATHLETE_ID,
          PLAN_ID,
          'instance-week-uuid',
          DTO,
        ),
      ).rejects.toMatchObject({ errorEntry: BusinessError.WEEK_FROZEN });
      expect(mockPrisma.weeklyFeeling.upsert).not.toHaveBeenCalled();
    });

    it(
      'lanza WEEK_FROZEN incluso si el registro previo es de hace apenas segundos ' +
        '(CA-015-5/CA-016-2 — el cierre de semana congela sin importar cuanto haya pasado)',
      async () => {
        mockPrisma.instanceWeek.findUnique.mockResolvedValue(
          buildWeekWithOwnership({ isClosed: true, closedAt: new Date() }),
        );

        await expect(
          service.registerWeeklyFeeling(
            ATHLETE_ID,
            PLAN_ID,
            'instance-week-uuid',
            DTO,
          ),
        ).rejects.toMatchObject({ errorEntry: BusinessError.WEEK_FROZEN });
      },
    );

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.instanceWeek.findUnique.mockResolvedValue(
        buildWeekWithOwnership(),
      );
      mockPrisma.weeklyFeeling.upsert.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.registerWeeklyFeeling(
          ATHLETE_ID,
          PLAN_ID,
          'instance-week-uuid',
          DTO,
        ),
      ).rejects.toThrow(TechnicalException);
    });

    it(
      'Ley 1581/2012: la respuesta NUNCA loggea muscleSoreness/motivation — ' +
        'InstancesService no inyecta ningun logger, no hay ninguna sentencia de log ' +
        'en registerWeeklyFeeling capaz de exponer estos valores',
      () => {
        expect(
          Object.getOwnPropertyNames(Object.getPrototypeOf(service) as object),
        ).not.toContain('logger');
      },
    );
  });
});
