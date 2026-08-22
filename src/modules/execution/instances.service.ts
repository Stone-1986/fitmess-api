import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PlanInstance,
  Subscription,
  SubscriptionStatus,
  WeeklyFeeling,
  Prisma,
} from '../../../generated/prisma/index.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { TechnicalError } from '../common/exceptions/technical-error.enum.js';
import { PaginationMeta } from '../common/interceptors/response.interceptor.js';
import { RegisterSessionResultDto } from './dto/register-session-result.dto.js';
import { RegisterWeeklyFeelingDto } from './dto/register-weekly-feeling.dto.js';
import { InstanceSummaryResponseDto } from './dto/instance-summary-response.dto.js';
import { InstanceDetailResponseDto } from './dto/instance-detail-response.dto.js';
import { InstancePhaseResponseDto } from './dto/instance-phase-response.dto.js';
import { InstanceWeekResponseDto } from './dto/instance-week-response.dto.js';
import { InstanceSessionResponseDto } from './dto/instance-session-response.dto.js';
import { InstanceSessionExerciseResponseDto } from './dto/instance-session-exercise-response.dto.js';
import { SessionResultResponseDto } from './dto/session-result-response.dto.js';
import { WeeklyFeelingResponseDto } from './dto/weekly-feeling-response.dto.js';

// Arbol de la PLANTILLA (Plan) usado por la copia profunda (D-1/D-3): solo
// los campos necesarios para crear la instancia, en el mismo orden en que
// se van a copiar. exerciseVersionId y los 5 campos de prescripcion se
// copian TAL CUAL (D-13, D-15 punto 8) — nunca se vuelve a resolver la
// version vigente ni se recalcula la prescripcion.
const planCopyTreeInclude = {
  phases: {
    orderBy: { order: 'asc' as const },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' as const },
        include: {
          sessions: {
            orderBy: { order: 'asc' as const },
            include: {
              exercises: { orderBy: { order: 'asc' as const } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PlanInclude;

type PlanCopyTree = Prisma.PlanGetPayload<{
  include: typeof planCopyTreeInclude;
}>;

// Arbol completo de la INSTANCIA (D-2): usado por GET /instances/:planId y
// GET /instances/:planId/athletes/:athleteId — MISMO DTO para ambos (D-8).
const instanceTreeInclude = {
  plan: { select: { name: true } },
  phases: {
    orderBy: { order: 'asc' as const },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' as const },
        include: {
          feeling: true,
          sessions: {
            orderBy: { order: 'asc' as const },
            include: {
              result: { include: { exerciseResults: true } },
              exercises: {
                orderBy: { order: 'asc' as const },
                include: { exerciseVersion: { include: { exercise: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PlanInstanceInclude;

type InstanceTree = Prisma.PlanInstanceGetPayload<{
  include: typeof instanceTreeInclude;
}>;
type InstancePhaseTree = InstanceTree['phases'][number];
type InstanceWeekTree = InstancePhaseTree['weeks'][number];
type InstanceSessionTree = InstanceWeekTree['sessions'][number];
type InstanceSessionExerciseTree = InstanceSessionTree['exercises'][number];
type SessionResultWithChildren = NonNullable<InstanceSessionTree['result']>;

// Sesion de la instancia con lo necesario para verificar ownership/estado
// en el registro de resultados (HU-015): remonta hasta PlanInstance via
// InstanceWeek -> InstancePhase (unica relacion real hacia PlanInstance —
// InstanceWeek.instanceId es una columna denormalizada, sin relacion propia).
const sessionOwnershipInclude = {
  exercises: true,
  instanceWeek: {
    include: {
      instancePhase: { include: { instance: true } },
    },
  },
} satisfies Prisma.InstanceSessionInclude;

type SessionWithOwnership = Prisma.InstanceSessionGetPayload<{
  include: typeof sessionOwnershipInclude;
}>;

// Semana de la instancia con lo necesario para verificar ownership/estado
// en el registro de sensaciones (HU-016). Mismo criterio que arriba.
const weekOwnershipInclude = {
  instancePhase: { include: { instance: true } },
} satisfies Prisma.InstanceWeekInclude;

/**
 * InstancesService — ejecucion de la instancia personalizada del plan
 * (EPICA-05, modulo nuevo `execution`): creacion automatica (HU-023),
 * registro de resultados (HU-015), sensaciones semanales (HU-016) y
 * cierre automatico de semana (HU-017).
 *
 * D-2 (execution): lee Plan/Subscription directamente via PrismaService
 * (compartido, @Global) — NUNCA importa PlansService, PlansModule,
 * SubscriptionsService ni SubscriptionsModule. La copia profunda confia en
 * que `plans` ya garantizo RN-07 (version congelada, D-13) y la
 * prescripcion significativa (D-15 punto 9) antes de publicar — este
 * service nunca vuelve a validar ninguna de las dos, solo copia.
 */
@Injectable()
export class InstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── HU-023: Listado y detalle propio ──────────────────────────────────────

  /**
   * Lista, paginada, todas las instancias propias del atleta autenticado
   * (CA-023-4, CA-023-5) — resumen liviano, sin el arbol completo (D-8).
   */
  async findAll(
    athleteId: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: InstanceSummaryResponseDto[]; meta: PaginationMeta }> {
    const pageNum = this.normalizePage(page);
    const limitNum = this.normalizeLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    let total: number;
    let instances: Array<PlanInstance & { plan: { name: string } }>;

    try {
      [total, instances] = await this.prisma.$transaction([
        this.prisma.planInstance.count({ where: { athleteId } }),
        this.prisma.planInstance.findMany({
          where: { athleteId },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: { plan: { select: { name: true } } },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al listar las instancias del atleta',
        {},
        error as Error,
      );
    }

    const data: InstanceSummaryResponseDto[] = instances.map((instance) => ({
      id: instance.id,
      planId: instance.planId,
      planName: instance.plan.name,
      createdAt: instance.createdAt,
    }));

    const totalPages = Math.ceil(total / limitNum);
    const meta: PaginationMeta = {
      page: pageNum,
      limit: limitNum,
      totalItems: total,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    };

    return { data, meta };
  }

  /**
   * Detalle propio del atleta para el plan `planId` (D-2). AUTO-REPARABLE
   * (D-3): si la Subscription esta Activa pero la instancia todavia no
   * existe (ventana de carrera del listener), la crea sobre la marcha con
   * el mismo metodo idempotente que usa el listener antes de responder —
   * el atleta nunca ve un 404 "todavia no existe" (CA-023-1).
   */
  async findOwn(
    athleteId: string,
    planId: string,
  ): Promise<InstanceDetailResponseDto> {
    const subscription = await this.findActiveSubscriptionOrFail(
      athleteId,
      planId,
    );

    await this.getOrCreateInstance(athleteId, planId, subscription.id);

    const instance = await this.prisma.planInstance.findUnique({
      where: { subscriptionId: subscription.id },
      include: instanceTreeInclude,
    });

    if (!instance) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'La instancia personalizada no pudo recuperarse inmediatamente despues de crearse',
        { athleteId, planId },
      );
    }

    return this.toInstanceDetailResponseDto(instance);
  }

  /**
   * D-3: metodo idempotente compartido por DOS caminos hacia la misma
   * creacion — SubscriptionActivatedListener (camino rapido) y
   * findOwn/findForCoach (camino de auto-reparacion). `findUnique` por
   * `subscriptionId` (unico) primero; si no existe, crea dentro de un
   * `$transaction` interactivo. Captura P2002 como salvaguarda de la
   * ventana de carrera entre ambos pasos — mismo patron que
   * SubscriptionsService.create() (CA-023-8).
   */
  async getOrCreateInstance(
    athleteId: string,
    planId: string,
    subscriptionId: string,
  ): Promise<PlanInstance> {
    const existing = await this.prisma.planInstance.findUnique({
      where: { subscriptionId },
    });

    if (existing) {
      return existing;
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: planCopyTreeInclude,
    });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${planId}' no fue encontrado`,
        { entity: 'Plan', identifier: planId },
      );
    }

    try {
      return await this.createInstanceFromSubscription(
        plan,
        athleteId,
        subscriptionId,
      );
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const raceWinner = await this.prisma.planInstance.findUnique({
          where: { subscriptionId },
        });
        if (raceWinner) {
          return raceWinner;
        }
      }
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al crear la instancia personalizada del plan',
        {},
        error as Error,
      );
    }
  }

  /**
   * Copia profunda de la plantilla dentro de un unico `$transaction`
   * interactivo (D-3): fase -> semana -> sesion -> ejercicio de sesion,
   * secuencial (no `createMany`, riesgo documentado y aceptado a escala
   * MVP). exerciseVersionId y los 5 campos de prescripcion se copian TAL
   * CUAL (D-13, D-15 punto 8/9) — nunca se vuelven a resolver ni a
   * validar. Si la transaccion falla a mitad, Prisma revierte TODO: nunca
   * queda una instancia parcial.
   */
  private async createInstanceFromSubscription(
    plan: PlanCopyTree,
    athleteId: string,
    subscriptionId: string,
  ): Promise<PlanInstance> {
    return this.prisma.$transaction(async (tx) => {
      const instance = await tx.planInstance.create({
        data: { planId: plan.id, athleteId, subscriptionId },
      });

      for (const phase of plan.phases) {
        const instancePhase = await tx.instancePhase.create({
          data: { instanceId: instance.id, order: phase.order },
        });

        for (const week of phase.weeks) {
          const instanceWeek = await tx.instanceWeek.create({
            data: {
              instancePhaseId: instancePhase.id,
              instanceId: instance.id,
              weekNumber: week.weekNumber,
            },
          });

          for (const session of week.sessions) {
            const instanceSession = await tx.instanceSession.create({
              data: {
                instanceWeekId: instanceWeek.id,
                name: session.name,
                order: session.order,
              },
            });

            for (const sessionExercise of session.exercises) {
              await tx.instanceSessionExercise.create({
                data: {
                  instanceSessionId: instanceSession.id,
                  exerciseVersionId: sessionExercise.exerciseVersionId,
                  order: sessionExercise.order,
                  sets: sessionExercise.sets,
                  reps: sessionExercise.reps,
                  loadKg: sessionExercise.loadKg,
                  durationSeconds: sessionExercise.durationSeconds,
                  distanceMeters: sessionExercise.distanceMeters,
                },
              });
            }
          }
        }
      }

      return instance;
    });
  }

  // ── HU-017: Panel del entrenador ──────────────────────────────────────────

  /**
   * Panel del entrenador sobre la instancia de un atleta especifico en un
   * plan propio (CA-017-2, CA-017-4; tambien satisface la lectura de
   * sensaciones de CA-016-3/CA-016-6). MISMO DTO que findOwn (D-8). Si el
   * atleta no tiene una Subscription Activa a `planId` (o el plan no
   * existe, o la instancia todavia no se creo), responde ENTITY_NOT_FOUND
   * — NUNCA CONSENT_REQUIRED (D-9).
   */
  async findForCoach(
    coachId: string,
    planId: string,
    athleteId: string,
  ): Promise<InstanceDetailResponseDto> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { coachId: true },
    });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${planId}' no fue encontrado`,
        { entity: 'Plan', identifier: planId },
      );
    }

    if (plan.coachId !== coachId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El coach '${coachId}' no tiene acceso al plan '${planId}' (CA-017-4)`,
        { resource: 'Plan', resourceId: planId },
      );
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { athleteId, planId, status: SubscriptionStatus.ACTIVE },
    });

    const instance = subscription
      ? await this.prisma.planInstance.findUnique({
          where: { subscriptionId: subscription.id },
          include: instanceTreeInclude,
        })
      : null;

    if (!instance) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `El atleta '${athleteId}' no tiene una instancia en el plan '${planId}' (sin suscripcion Activa, D-9)`,
        { entity: 'PlanInstance', athleteId, planId },
      );
    }

    return this.toInstanceDetailResponseDto(instance);
  }

  // ── HU-015: Registro de resultados ────────────────────────────────────────

  /**
   * Upsert de los resultados de una sesion de la instancia propia (D-6b).
   * Orden de verificacion: (1) Subscription Activa (CONSENT_REQUIRED, 422,
   * CA-015-7); (2) ownership de la sesion (ENTITY_NOT_FOUND o
   * RESOURCE_OWNERSHIP_DENIED, CA-015-6); (3) conjunto EXACTO de ejercicios
   * (RESULT_FIELDS_INVALID, 422, CA-015-10); (4) semana no cerrada
   * (WEEK_FROZEN, 409, CA-015-4/5). Si las cuatro pasan, upsert atomico del
   * resultado y de cada resultado de ejercicio dentro de una unica
   * `$transaction` interactiva que ADEMAS cuenta las sesiones pendientes de
   * la semana y la cierra si el conteo llega a cero (D-4, RN-30). Emite
   * week.closed DESPUES del commit, solo si esa transaccion cerro la
   * semana.
   */
  async registerSessionResult(
    athleteId: string,
    planId: string,
    sessionId: string,
    dto: RegisterSessionResultDto,
  ): Promise<SessionResultResponseDto> {
    await this.findActiveSubscriptionOrFail(athleteId, planId);

    const session = await this.prisma.instanceSession.findUnique({
      where: { id: sessionId },
      include: sessionOwnershipInclude,
    });

    if (
      !session ||
      session.instanceWeek.instancePhase.instance.planId !== planId
    ) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Sesion con id '${sessionId}' no fue encontrada en la instancia del plan '${planId}'`,
        { entity: 'InstanceSession', identifier: sessionId },
      );
    }

    if (session.instanceWeek.instancePhase.instance.athleteId !== athleteId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El atleta '${athleteId}' no tiene acceso a la sesion '${sessionId}' (CA-015-6)`,
        { resource: 'InstanceSession', resourceId: sessionId },
      );
    }

    this.assertExactExerciseSet(session, dto, sessionId);

    if (session.instanceWeek.isClosed) {
      throw new BusinessException(
        BusinessError.WEEK_FROZEN,
        `La semana '${session.instanceWeek.id}' ya cerro y sus datos son definitivos (CA-015-4/5)`,
        { instanceWeekId: session.instanceWeek.id },
      );
    }

    const instanceWeekId = session.instanceWeek.id;
    let weekJustClosed = false;
    let sessionResult: SessionResultWithChildren;

    try {
      sessionResult = await this.prisma.$transaction(async (tx) => {
        const upserted = await tx.sessionResult.upsert({
          where: { instanceSessionId: sessionId },
          create: { instanceSessionId: sessionId, athleteId },
          update: {},
        });

        for (const item of dto.exercises) {
          const values = {
            sets: item.sets ?? null,
            reps: item.reps ?? null,
            loadKg: item.loadKg ?? null,
            durationSeconds: item.durationSeconds ?? null,
            distanceMeters: item.distanceMeters ?? null,
            notes: item.notes ?? null,
          };

          await tx.sessionExerciseResult.upsert({
            where: { instanceSessionExerciseId: item.sessionExerciseId },
            create: {
              sessionResultId: upserted.id,
              instanceSessionExerciseId: item.sessionExerciseId,
              ...values,
            },
            update: values,
          });
        }

        // D-4: cuenta las sesiones de la semana SIN resultado (anti-join
        // contra SessionResult.instanceSessionId) DENTRO de la misma
        // transaccion — ve el upsert que la precede en esta misma tx
        // (aislamiento suficiente, D-4). Si llega a cero, cierra la
        // semana de forma idempotente (`where: { isClosed: false }`).
        const pendingCount = await tx.instanceSession.count({
          where: { instanceWeekId, result: null },
        });

        if (pendingCount === 0) {
          const closed = await tx.instanceWeek.updateMany({
            where: { id: instanceWeekId, isClosed: false },
            data: { isClosed: true, closedAt: new Date() },
          });
          weekJustClosed = closed.count > 0;
        }

        const withChildren = await tx.sessionResult.findUnique({
          where: { id: upserted.id },
          include: { exerciseResults: true },
        });

        // No puede ser null: se acaba de upsertar en esta misma transaccion.
        return withChildren as SessionResultWithChildren;
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al registrar los resultados de la sesion',
        {},
        error as Error,
      );
    }

    if (weekJustClosed) {
      this.eventEmitter.emit('week.closed', {
        instanceWeekId,
        planId,
        athleteId,
      });
    }

    return this.toSessionResultResponseDto(sessionResult);
  }

  /**
   * CA-015-10: el payload debe traer EXACTAMENTE los ejercicios
   * programados de la sesion, ni de mas ni de menos (duplicados tambien
   * se rechazan — rompen la correspondencia 1:1 exigida). No valida
   * completitud de VALORES dentro de cada item (CA-015-11) — eso es
   * responsabilidad del propio DTO/tipo de ejercicio, no de este service.
   */
  private assertExactExerciseSet(
    session: SessionWithOwnership,
    dto: RegisterSessionResultDto,
    sessionId: string,
  ): void {
    const programmedIds = new Set(session.exercises.map((e) => e.id));
    const payloadIds = new Set(dto.exercises.map((e) => e.sessionExerciseId));

    const missing = [...programmedIds].filter((id) => !payloadIds.has(id));
    const extra = [...payloadIds].filter((id) => !programmedIds.has(id));
    const hasDuplicates = payloadIds.size !== dto.exercises.length;

    if (missing.length > 0 || extra.length > 0 || hasDuplicates) {
      throw new BusinessException(
        BusinessError.RESULT_FIELDS_INVALID,
        `El registro de resultados de la sesion '${sessionId}' no incluye exactamente los ejercicios programados (CA-015-10)`,
        { sessionId, missing, extra },
      );
    }
  }

  // ── HU-016: Sensaciones semanales ─────────────────────────────────────────

  /**
   * Upsert de las sensaciones (dolor muscular, motivacion; DATO SENSIBLE
   * DE SALUD, Ley 1581/2012 — nunca loggeado) de una semana de la
   * instancia propia (D-6b). Orden: (1) Subscription Activa
   * (CONSENT_REQUIRED, 422, CA-016-5); (2) ownership de la semana
   * (ENTITY_NOT_FOUND o RESOURCE_OWNERSHIP_DENIED, CA-016-4); (3) semana
   * no cerrada (WEEK_FROZEN, 409, CA-016-2). El rango 1-10 ya lo garantiza
   * el ValidationPipe global (CA-016-9) — este service nunca lo revalida.
   */
  async registerWeeklyFeeling(
    athleteId: string,
    planId: string,
    weekId: string,
    dto: RegisterWeeklyFeelingDto,
  ): Promise<WeeklyFeelingResponseDto> {
    await this.findActiveSubscriptionOrFail(athleteId, planId);

    const week = await this.prisma.instanceWeek.findUnique({
      where: { id: weekId },
      include: weekOwnershipInclude,
    });

    if (!week || week.instancePhase.instance.planId !== planId) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Semana con id '${weekId}' no fue encontrada en la instancia del plan '${planId}'`,
        { entity: 'InstanceWeek', identifier: weekId },
      );
    }

    if (week.instancePhase.instance.athleteId !== athleteId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El atleta '${athleteId}' no tiene acceso a la semana '${weekId}' (CA-016-4)`,
        { resource: 'InstanceWeek', resourceId: weekId },
      );
    }

    if (week.isClosed) {
      throw new BusinessException(
        BusinessError.WEEK_FROZEN,
        `La semana '${weekId}' ya cerro y sus datos son definitivos (CA-016-2)`,
        { instanceWeekId: weekId },
      );
    }

    let feeling: WeeklyFeeling;

    try {
      feeling = await this.prisma.weeklyFeeling.upsert({
        where: { instanceWeekId: weekId },
        create: {
          instanceWeekId: weekId,
          muscleSoreness: dto.muscleSoreness,
          motivation: dto.motivation,
        },
        update: {
          muscleSoreness: dto.muscleSoreness,
          motivation: dto.motivation,
        },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al registrar las sensaciones semanales',
        {},
        error as Error,
      );
    }

    return this.toWeeklyFeelingResponseDto(feeling);
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Obligacion heredada de EPICA-04 (D-9, CA-014-3 diferido a esta epica):
   * verifica primero que el plan exista (ENTITY_NOT_FOUND, 404), luego que
   * exista una Subscription propia en estado Activa para ese plan
   * (CONSENT_REQUIRED, 422, si no).
   */
  private async findActiveSubscriptionOrFail(
    athleteId: string,
    planId: string,
  ): Promise<Subscription> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${planId}' no fue encontrado`,
        { entity: 'Plan', identifier: planId },
      );
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { athleteId, planId, status: SubscriptionStatus.ACTIVE },
    });

    if (!subscription) {
      throw new BusinessException(
        BusinessError.CONSENT_REQUIRED,
        `Se requiere una inscripcion activa con consentimiento informado aceptado para el plan '${planId}'`,
        { athleteId, planId },
      );
    }

    return subscription;
  }

  private toInstanceDetailResponseDto(
    instance: InstanceTree,
  ): InstanceDetailResponseDto {
    return {
      id: instance.id,
      planId: instance.planId,
      planName: instance.plan.name,
      athleteId: instance.athleteId,
      phases: instance.phases.map((phase) =>
        this.toInstancePhaseResponseDto(phase),
      ),
      createdAt: instance.createdAt,
    };
  }

  private toInstancePhaseResponseDto(
    phase: InstancePhaseTree,
  ): InstancePhaseResponseDto {
    return {
      id: phase.id,
      order: phase.order,
      weeks: phase.weeks.map((week) => this.toInstanceWeekResponseDto(week)),
    };
  }

  private toInstanceWeekResponseDto(
    week: InstanceWeekTree,
  ): InstanceWeekResponseDto {
    return {
      id: week.id,
      weekNumber: week.weekNumber,
      isClosed: week.isClosed,
      closedAt: week.closedAt,
      sessions: week.sessions.map((session) =>
        this.toInstanceSessionResponseDto(session),
      ),
      feeling: week.feeling
        ? this.toWeeklyFeelingResponseDto(week.feeling)
        : null,
    };
  }

  private toInstanceSessionResponseDto(
    session: InstanceSessionTree,
  ): InstanceSessionResponseDto {
    return {
      id: session.id,
      name: session.name,
      order: session.order,
      exercises: session.exercises.map((exercise) =>
        this.toInstanceSessionExerciseResponseDto(exercise),
      ),
      result: session.result
        ? this.toSessionResultResponseDto(session.result)
        : null,
    };
  }

  private toInstanceSessionExerciseResponseDto(
    exercise: InstanceSessionExerciseTree,
  ): InstanceSessionExerciseResponseDto {
    return {
      id: exercise.id,
      order: exercise.order,
      exerciseId: exercise.exerciseVersion.exerciseId,
      name: exercise.exerciseVersion.exercise.name,
      description: exercise.exerciseVersion.description,
      muscleGroup: exercise.exerciseVersion.muscleGroup,
      versionNumber: exercise.exerciseVersion.versionNumber,
      sets: exercise.sets,
      reps: exercise.reps,
      loadKg: exercise.loadKg,
      durationSeconds: exercise.durationSeconds,
      distanceMeters: exercise.distanceMeters,
      createdAt: exercise.createdAt,
    };
  }

  private toSessionResultResponseDto(
    result: SessionResultWithChildren,
  ): SessionResultResponseDto {
    return {
      id: result.id,
      exerciseResults: result.exerciseResults.map((exerciseResult) => ({
        id: exerciseResult.id,
        sessionExerciseId: exerciseResult.instanceSessionExerciseId,
        sets: exerciseResult.sets,
        reps: exerciseResult.reps,
        loadKg: exerciseResult.loadKg,
        durationSeconds: exerciseResult.durationSeconds,
        distanceMeters: exerciseResult.distanceMeters,
        notes: exerciseResult.notes,
      })),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  private toWeeklyFeelingResponseDto(
    feeling: WeeklyFeeling,
  ): WeeklyFeelingResponseDto {
    return {
      id: feeling.id,
      muscleSoreness: feeling.muscleSoreness,
      motivation: feeling.motivation,
      createdAt: feeling.createdAt,
      updatedAt: feeling.updatedAt,
    };
  }

  /** Detecta errores de constraint unico de Prisma (P2002). */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  private normalizePage(page?: number): number {
    return Number.isInteger(page) && (page as number) > 0
      ? (page as number)
      : 1;
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isInteger(limit) || (limit as number) <= 0) {
      return 20;
    }
    return Math.min(limit as number, 100);
  }
}
