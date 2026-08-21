import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionsService } from './subscriptions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import {
  SubscriptionStatus,
  PlanStatus,
  DocumentType,
} from '../../../generated/prisma/index.js';

/**
 * Mock de PrismaService — solo los metodos que usa SubscriptionsService.
 *
 * $transaction soporta la unica firma que usa este service: array de
 * promesas (acceptConsent, findMine, findPending) — mismo patron ya usado
 * en plans.service.spec.ts.
 */
const mockPrisma = {
  plan: {
    findUnique: vi.fn(),
  },
  subscription: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  legalAcceptance: {
    create: vi.fn(),
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

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    name: 'Fuerza e hipertrofia',
    status: PlanStatus.PUBLISHED,
    coachId: COACH_ID,
    endDate: null as Date | null,
    ...overrides,
  };
}

function buildSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBSCRIPTION_ID,
    athleteId: ATHLETE_ID,
    planId: PLAN_ID,
    status: SubscriptionStatus.PENDING,
    reviewedAt: null as Date | null,
    reviewedBy: null as string | null,
    activatedAt: null as Date | null,
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    updatedAt: new Date('2026-08-20T00:00:00.000Z'),
    ...overrides,
  };
}

function buildSubscriptionWithPlan(
  subscriptionOverrides: Record<string, unknown> = {},
  planOverrides: Record<string, unknown> = {},
) {
  return {
    ...buildSubscription(subscriptionOverrides),
    plan: buildPlan(planOverrides),
  };
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── create() ──────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crea la suscripcion Pendiente y emite subscription.requested (CA-012-1)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(buildSubscription());

      const result = await service.create(ATHLETE_ID, { planId: PLAN_ID });

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: { athleteId: ATHLETE_ID, planId: PLAN_ID },
      });
      expect(result.status).toBe(SubscriptionStatus.PENDING);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscription.requested',
        {
          subscriptionId: SUBSCRIPTION_ID,
          athleteId: ATHLETE_ID,
          planId: PLAN_ID,
          coachId: COACH_ID,
        },
      );
    });

    it('el payload del evento subscription.requested contiene UNICAMENTE IDs — ningun dato de salud ni dato personal completo (Ley 1273/2009)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(buildSubscription());

      await service.create(ATHLETE_ID, { planId: PLAN_ID });

      const [, payload] = mockEventEmitter.emit.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(Object.keys(payload).sort()).toEqual(
        ['athleteId', 'coachId', 'planId', 'subscriptionId'].sort(),
      );
    });

    it('lanza ENTITY_NOT_FOUND si el plan no existe', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    });

    it('lanza PLAN_NOT_PUBLISHED si el plan esta en Borrador (CA-012-4)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.DRAFT }),
      );

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).rejects.toMatchObject({ errorEntry: BusinessError.PLAN_NOT_PUBLISHED });
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    });

    it('lanza PLAN_NOT_PUBLISHED si el plan esta Archivado (CA-012-4)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.ARCHIVED }),
      );

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).rejects.toMatchObject({ errorEntry: BusinessError.PLAN_NOT_PUBLISHED });
    });

    it(
      'lanza PLAN_NOT_PUBLISHED (CASO CRITICO) si el plan tiene status PERSISTIDO en ' +
        'PUBLISHED pero su endDate ya paso, SIN write-through previo — demuestra que ' +
        'isPlanCurrentlyPublished() evalua el estado EFECTIVO, nunca la columna cruda',
      async () => {
        const vencido = new Date(Date.now() - 24 * 60 * 60 * 1000);
        mockPrisma.plan.findUnique.mockResolvedValue(
          buildPlan({ status: PlanStatus.PUBLISHED, endDate: vencido }),
        );

        await expect(
          service.create(ATHLETE_ID, { planId: PLAN_ID }),
        ).rejects.toMatchObject({
          errorEntry: BusinessError.PLAN_NOT_PUBLISHED,
        });
        expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
      },
    );

    it('permite la solicitud si el plan esta Publicado con endDate en el futuro', async () => {
      const futuro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      mockPrisma.plan.findUnique.mockResolvedValue(
        buildPlan({ status: PlanStatus.PUBLISHED, endDate: futuro }),
      );
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(buildSubscription());

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).resolves.toMatchObject({ status: SubscriptionStatus.PENDING });
    });

    it.each([
      SubscriptionStatus.PENDING,
      SubscriptionStatus.APPROVED,
      SubscriptionStatus.ACTIVE,
    ])(
      'lanza SUBSCRIPTION_ALREADY_EXISTS si ya existe una suscripcion propia en estado %s (CA-012-2)',
      async (status) => {
        mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription({ status }),
        );

        await expect(
          service.create(ATHLETE_ID, { planId: PLAN_ID }),
        ).rejects.toMatchObject({
          errorEntry: BusinessError.SUBSCRIPTION_ALREADY_EXISTS,
        });
        expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
      },
    );

    it('una suscripcion Rechazada previa NO bloquea una nueva solicitud (CA-012-3)', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      // El pre-check filtra por status IN [PENDING, APPROVED, ACTIVE] — una
      // fila REJECTED nunca aparece en el resultado de findFirst.
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(buildSubscription());

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).resolves.toMatchObject({ status: SubscriptionStatus.PENDING });
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          athleteId: ATHLETE_ID,
          planId: PLAN_ID,
          status: {
            in: [
              SubscriptionStatus.PENDING,
              SubscriptionStatus.APPROVED,
              SubscriptionStatus.ACTIVE,
            ],
          },
        },
      });
    });

    it('traduce P2002 (indice unico parcial D-3) a SUBSCRIPTION_ALREADY_EXISTS — ventana de carrera', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.SUBSCRIPTION_ALREADY_EXISTS,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error no-P2002', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(buildPlan());
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.create(ATHLETE_ID, { planId: PLAN_ID }),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── findMine() ────────────────────────────────────────────────────────

  describe('findMine()', () => {
    it('lista las suscripciones propias paginadas (CA-014-1, CA-014-4)', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([1, [buildSubscription()]]);

      const result = await service.findMine(ATHLETE_ID, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
    });

    it('usa page=1 y limit=20 por defecto cuando no se envian', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([0, []]);

      const result = await service.findMine(ATHLETE_ID);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('limita el limit a 100 aunque se pida mas', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([0, []]);

      const result = await service.findMine(ATHLETE_ID, 1, 500);

      expect(result.meta.limit).toBe(100);
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB caida'));

      await expect(service.findMine(ATHLETE_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── findPending() ─────────────────────────────────────────────────────

  describe('findPending()', () => {
    it('lista las suscripciones Pendientes de los planes del coach, con athleteName/planName (CA-013-3)', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([
        1,
        [
          {
            ...buildSubscription(),
            athlete: { name: 'Maria Fernanda' },
            plan: { name: 'Fuerza e hipertrofia' },
          },
        ],
      ]);

      const result = await service.findPending(COACH_ID, 1, 20);

      expect(result.data[0]).toMatchObject({
        id: SUBSCRIPTION_ID,
        athleteId: ATHLETE_ID,
        athleteName: 'Maria Fernanda',
        planId: PLAN_ID,
        planName: 'Fuerza e hipertrofia',
        status: SubscriptionStatus.PENDING,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB caida'));

      await expect(service.findPending(COACH_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── approve() ─────────────────────────────────────────────────────────

  describe('approve()', () => {
    it('Pendiente -> Aprobada y emite subscription.approved (CA-013-1)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription(),
        plan: { coachId: COACH_ID },
      });
      mockPrisma.subscription.update.mockResolvedValue(
        buildSubscription({ status: SubscriptionStatus.APPROVED }),
      );

      const result = await service.approve(COACH_ID, SUBSCRIPTION_ID);

      expect(result.status).toBe(SubscriptionStatus.APPROVED);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: SUBSCRIPTION_ID },
        data: expect.objectContaining({
          status: SubscriptionStatus.APPROVED,
          reviewedBy: COACH_ID,
        }) as unknown,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscription.approved',
        {
          subscriptionId: SUBSCRIPTION_ID,
          athleteId: ATHLETE_ID,
          planId: PLAN_ID,
          coachId: COACH_ID,
        },
      );
    });

    it('lanza ENTITY_NOT_FOUND si la suscripcion no existe', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.approve(COACH_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan de la suscripcion no es del coach (CA-013-4)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription(),
        plan: { coachId: OTHER_COACH_ID },
      });

      await expect(
        service.approve(COACH_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('lanza INVALID_STATE_TRANSITION si la suscripcion ya no esta Pendiente (CA-013-6)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription({ status: SubscriptionStatus.APPROVED }),
        plan: { coachId: COACH_ID },
      });

      await expect(
        service.approve(COACH_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription(),
        plan: { coachId: COACH_ID },
      });
      mockPrisma.subscription.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.approve(COACH_ID, SUBSCRIPTION_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── reject() ──────────────────────────────────────────────────────────

  describe('reject()', () => {
    it('Pendiente -> Rechazada y emite subscription.rejected (CA-013-2)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription(),
        plan: { coachId: COACH_ID },
      });
      mockPrisma.subscription.update.mockResolvedValue(
        buildSubscription({ status: SubscriptionStatus.REJECTED }),
      );

      const result = await service.reject(COACH_ID, SUBSCRIPTION_ID);

      expect(result.status).toBe(SubscriptionStatus.REJECTED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscription.rejected',
        {
          subscriptionId: SUBSCRIPTION_ID,
          athleteId: ATHLETE_ID,
          planId: PLAN_ID,
          coachId: COACH_ID,
        },
      );
    });

    it('lanza ENTITY_NOT_FOUND si la suscripcion no existe', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.reject(COACH_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si el plan de la suscripcion no es del coach (CA-013-4)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription(),
        plan: { coachId: OTHER_COACH_ID },
      });

      await expect(
        service.reject(COACH_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
    });

    it('lanza INVALID_STATE_TRANSITION si la suscripcion ya no esta Pendiente (CA-013-6)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription({ status: SubscriptionStatus.REJECTED }),
        plan: { coachId: COACH_ID },
      });

      await expect(
        service.reject(COACH_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...buildSubscription(),
        plan: { coachId: COACH_ID },
      });
      mockPrisma.subscription.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.reject(COACH_ID, SUBSCRIPTION_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── acceptConsent() ───────────────────────────────────────────────────

  describe('acceptConsent()', () => {
    const DTO = { documentVersion: '1.0.0' };
    const IP = '127.0.0.1';
    const USER_AGENT = 'vitest';

    it(
      'Aprobada -> Activa: crea LegalAcceptance(SPORT_CONSENT) + actualiza la ' +
        'suscripcion en UNA sola $transaction atomica, y emite subscription.activated (CA-014-2)',
      async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue(
          buildSubscriptionWithPlan({ status: SubscriptionStatus.APPROVED }),
        );
        mockPrisma.$transaction.mockResolvedValueOnce([
          { id: 'legal-acceptance-uuid' },
          buildSubscription({ status: SubscriptionStatus.ACTIVE }),
        ]);

        const result = await service.acceptConsent(
          ATHLETE_ID,
          SUBSCRIPTION_ID,
          DTO,
          IP,
          USER_AGENT,
        );

        expect(result.status).toBe(SubscriptionStatus.ACTIVE);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        const transactionArg = mockPrisma.$transaction.mock
          .calls[0][0] as unknown[];
        expect(transactionArg).toHaveLength(2);
        expect(mockPrisma.legalAcceptance.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: ATHLETE_ID,
            documentType: DocumentType.SPORT_CONSENT,
            documentVersion: DTO.documentVersion,
            planId: PLAN_ID,
            ip: IP,
            userAgent: USER_AGENT,
          }) as unknown,
        });
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'subscription.activated',
          {
            subscriptionId: SUBSCRIPTION_ID,
            athleteId: ATHLETE_ID,
            planId: PLAN_ID,
          },
        );
      },
    );

    it('lanza ENTITY_NOT_FOUND si la suscripcion no existe', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptConsent(ATHLETE_ID, SUBSCRIPTION_ID, DTO, IP, USER_AGENT),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza RESOURCE_OWNERSHIP_DENIED si la suscripcion no es del atleta autenticado (CA-014-6)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        buildSubscriptionWithPlan({
          athleteId: OTHER_ATHLETE_ID,
          status: SubscriptionStatus.APPROVED,
        }),
      );

      await expect(
        service.acceptConsent(ATHLETE_ID, SUBSCRIPTION_ID, DTO, IP, USER_AGENT),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('lanza INVALID_STATE_TRANSITION si la suscripcion no esta Aprobada', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        buildSubscriptionWithPlan({ status: SubscriptionStatus.PENDING }),
      );

      await expect(
        service.acceptConsent(ATHLETE_ID, SUBSCRIPTION_ID, DTO, IP, USER_AGENT),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it(
      'lanza PLAN_NOT_PUBLISHED (CA-014-8, caso 1 de 2 — plan Archivado) SIN escribir nada: ' +
        'ninguna $transaction se abre, la suscripcion permanece en Aprobada',
      async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue(
          buildSubscriptionWithPlan(
            { status: SubscriptionStatus.APPROVED },
            { status: PlanStatus.ARCHIVED },
          ),
        );

        await expect(
          service.acceptConsent(
            ATHLETE_ID,
            SUBSCRIPTION_ID,
            DTO,
            IP,
            USER_AGENT,
          ),
        ).rejects.toMatchObject({
          errorEntry: BusinessError.PLAN_NOT_PUBLISHED,
        });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.legalAcceptance.create).not.toHaveBeenCalled();
        expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      },
    );

    it(
      'lanza PLAN_NOT_PUBLISHED (CA-014-8, CASO CRITICO 2 de 2 — status PERSISTIDO ' +
        'todavia en PUBLISHED pero endDate ya paso, SIN write-through previo): demuestra ' +
        'que isPlanCurrentlyPublished() evalua el estado EFECTIVO, no la columna cruda — ' +
        'un chequeo ingenuo `status !== PUBLISHED` dejaria pasar exactamente este caso',
      async () => {
        const vencido = new Date(Date.now() - 24 * 60 * 60 * 1000);
        mockPrisma.subscription.findUnique.mockResolvedValue(
          buildSubscriptionWithPlan(
            { status: SubscriptionStatus.APPROVED },
            { status: PlanStatus.PUBLISHED, endDate: vencido },
          ),
        );

        await expect(
          service.acceptConsent(
            ATHLETE_ID,
            SUBSCRIPTION_ID,
            DTO,
            IP,
            USER_AGENT,
          ),
        ).rejects.toMatchObject({
          errorEntry: BusinessError.PLAN_NOT_PUBLISHED,
        });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('permite aceptar el consentimiento si el plan esta Publicado con endDate en el futuro', async () => {
      const futuro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      mockPrisma.subscription.findUnique.mockResolvedValue(
        buildSubscriptionWithPlan(
          { status: SubscriptionStatus.APPROVED },
          { status: PlanStatus.PUBLISHED, endDate: futuro },
        ),
      );
      mockPrisma.$transaction.mockResolvedValueOnce([
        { id: 'legal-acceptance-uuid' },
        buildSubscription({ status: SubscriptionStatus.ACTIVE }),
      ]);

      await expect(
        service.acceptConsent(ATHLETE_ID, SUBSCRIPTION_ID, DTO, IP, USER_AGENT),
      ).resolves.toMatchObject({ status: SubscriptionStatus.ACTIVE });
    });

    it(
      'atomicidad: si la $transaction falla, se traduce a TechnicalException — ni el ' +
        'LegalAcceptance ni el cambio a Activa quedan escritos parcialmente',
      async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue(
          buildSubscriptionWithPlan({ status: SubscriptionStatus.APPROVED }),
        );
        mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB caida'));

        await expect(
          service.acceptConsent(
            ATHLETE_ID,
            SUBSCRIPTION_ID,
            DTO,
            IP,
            USER_AGENT,
          ),
        ).rejects.toThrow(TechnicalException);
        // La unica escritura observable es la que ocurre DENTRO del array
        // pasado a $transaction — si $transaction rechaza, ninguna de las
        // dos operaciones se considera commiteada por Prisma.
        expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      },
    );
  });
});
