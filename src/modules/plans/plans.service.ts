import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  Plan,
  Phase,
  Week,
  Session,
  SessionExercise,
  PlanStatus,
  CoachRequestStatus,
  Prisma,
} from '../../../generated/prisma/index.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { TechnicalError } from '../common/exceptions/technical-error.enum.js';
import { PaginationMeta } from '../common/interceptors/response.interceptor.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';
import { AddPhaseDto } from './dto/add-phase.dto.js';
import { AddSessionDto } from './dto/add-session.dto.js';
import { AddSessionExerciseDto } from './dto/add-session-exercise.dto.js';
import { PlanResponseDto } from './dto/plan-response.dto.js';
import { PlanDetailResponseDto } from './dto/plan-detail-response.dto.js';
import { PhaseResponseDto } from './dto/phase-response.dto.js';
import { WeekResponseDto } from './dto/week-response.dto.js';
import { SessionResponseDto } from './dto/session-response.dto.js';
import { SessionExerciseResponseDto } from './dto/session-exercise-response.dto.js';
import { PlanCatalogSummaryResponseDto } from './dto/plan-catalog-summary-response.dto.js';
import { PlanCatalogDetailResponseDto } from './dto/plan-catalog-detail-response.dto.js';

// Arbol completo del plan propio (D-8: GET /plans/:id) y base para la
// verificacion de completitud de publish() (RN-01 atraviesa los cuatro
// niveles: fase -> semana -> sesion -> ejercicio de sesion).
const planTreeInclude = {
  phases: {
    orderBy: { order: 'asc' as const },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' as const },
        include: {
          sessions: {
            orderBy: { order: 'asc' as const },
            include: {
              exercises: {
                orderBy: { order: 'asc' as const },
                include: {
                  exerciseVersion: { include: { exercise: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PlanInclude;

type PlanTree = Prisma.PlanGetPayload<{ include: typeof planTreeInclude }>;
type SessionExerciseTree =
  PlanTree['phases'][number]['weeks'][number]['sessions'][number]['exercises'][number];

// Arbol del catalogo (HU-011, CA-011-2): mismos cuatro niveles, pero cada
// sesion solo trae la CANTIDAD de ejercicios (_count), no su detalle, mas
// el perfil publico del entrenador (User + su unica CoachRequest, si la tiene).
const catalogTreeInclude = {
  phases: {
    orderBy: { order: 'asc' as const },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' as const },
        include: {
          sessions: {
            orderBy: { order: 'asc' as const },
            include: { _count: { select: { exercises: true } } },
          },
        },
      },
    },
  },
  coach: { include: { coachRequest: true } },
} satisfies Prisma.PlanInclude;

type CatalogPlanTree = Prisma.PlanGetPayload<{
  include: typeof catalogTreeInclude;
}>;

/**
 * PlansService — creacion, publicacion, ciclo de vida y catalogo de planes
 * de entrenamiento (EPICA-03).
 *
 * Jerarquia: Plan -> Phase -> Week -> Session -> SessionExercise (decision
 * confirmada del humano, 2026-08-20). La escritura es granular por nivel
 * (D-8): cada Add/Remove opera sobre un solo nivel; la lectura del plan
 * propio (findOne) agrega el arbol completo en una sola respuesta.
 *
 * HU-008 (shell + estructura), HU-009 (publish/unpublish), HU-010 (archive),
 * HU-011 (catalogo de planes Publicados).
 */
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── HU-008: Shell del plan ────────────────────────────────────────────────

  /**
   * Crea el shell del plan (name obligatorio; description, startDate,
   * endDate opcionales) en estado Borrador, sin ninguna fase todavia
   * (CA-008-1/CA-008-2). RN-01/RN-02 solo se verifican en publish() (D-3).
   */
  async create(coachId: string, dto: CreatePlanDto): Promise<PlanResponseDto> {
    let plan: Plan;

    try {
      plan = await this.prisma.plan.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          coachId,
        },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al crear el plan',
        {},
        error as Error,
      );
    }

    return this.mapPlanResponseDto(plan, this.computeEffectiveStatus(plan));
  }

  /**
   * Lista los planes propios del entrenador autenticado, en cualquier
   * estado, paginado (decision D-8 — soporte para ubicar el borrador en
   * construccion). Aplica el write-through oportunista de D-1 por cada
   * plan cuya transicion a Finalizado se detecta en esta lectura.
   */
  async findAll(
    coachId: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: PlanResponseDto[]; meta: PaginationMeta }> {
    const pageNum = this.normalizePage(page);
    const limitNum = this.normalizeLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    let total: number;
    let plans: Plan[];

    try {
      [total, plans] = await this.prisma.$transaction([
        this.prisma.plan.count({ where: { coachId } }),
        this.prisma.plan.findMany({
          where: { coachId },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al listar los planes del entrenador',
        {},
        error as Error,
      );
    }

    const data = plans.map((plan) => this.toOwnReadPlanResponseDto(plan));
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
   * Detalle del plan propio con el arbol completo embebido (D-8). CA-008-6
   * (ownership) via findPlanTreeOwnedOrFail. Aplica el write-through
   * oportunista de D-1 si corresponde.
   */
  async findOne(coachId: string, id: string): Promise<PlanDetailResponseDto> {
    const plan = await this.findPlanTreeOwnedOrFail(coachId, id);
    const effectiveStatus = this.computeEffectiveStatus(plan);
    this.applyEffectiveStatusWriteThrough(plan, effectiveStatus);

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      startDate: this.formatDateOnly(plan.startDate),
      endDate: this.formatDateOnly(plan.endDate),
      status: effectiveStatus,
      coachId: plan.coachId,
      phases: plan.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        order: phase.order,
        weeks: phase.weeks.map((week) => ({
          id: week.id,
          weekNumber: week.weekNumber,
          sessions: week.sessions.map((session) => ({
            id: session.id,
            name: session.name,
            order: session.order,
            exercises: session.exercises.map((exercise) =>
              this.toSessionExerciseResponseDto(exercise),
            ),
          })),
        })),
      })),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  /**
   * Edita name/description en cualquier estado; startDate/endDate solo si
   * el plan sigue en Borrador — si se envian con el plan ya publicado,
   * rechaza con PLAN_IMMUTABLE (409, decision D-6, RN-31).
   */
  async update(
    coachId: string,
    id: string,
    dto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    const plan = await this.findOwnedOrFail(coachId, id);

    const data: Prisma.PlanUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }

    const changesDates =
      dto.startDate !== undefined || dto.endDate !== undefined;

    if (changesDates) {
      if (plan.status !== PlanStatus.DRAFT) {
        throw new BusinessException(
          BusinessError.PLAN_IMMUTABLE,
          `El plan '${id}' no permite modificar sus fechas fuera del estado Borrador (RN-31, D-6)`,
          { planId: id, currentStatus: plan.status },
        );
      }

      if (dto.startDate !== undefined) {
        data.startDate = new Date(dto.startDate);
      }

      if (dto.endDate !== undefined) {
        data.endDate = new Date(dto.endDate);
      }
    }

    let updated: Plan;

    try {
      updated = await this.prisma.plan.update({ where: { id }, data });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al actualizar el plan',
        {},
        error as Error,
      );
    }

    return this.mapPlanResponseDto(
      updated,
      this.computeEffectiveStatus(updated),
    );
  }

  // ── HU-008: Estructura — fases ────────────────────────────────────────────

  /**
   * Agrega una fase al plan. order = maximo order existente en el plan + 1
   * (D-5), calculado dentro de una transaccion; el `@@unique([planId, order])`
   * del schema es la salvaguarda real contra dos altas concurrentes.
   */
  async addPhase(
    coachId: string,
    id: string,
    dto: AddPhaseDto,
  ): Promise<PhaseResponseDto> {
    await this.findOwnedOrFail(coachId, id);
    const name = dto.name.trim();

    let phase: Phase;

    try {
      phase = await this.prisma.$transaction(async (tx) => {
        const maxOrder = await tx.phase.aggregate({
          where: { planId: id },
          _max: { order: true },
        });
        const order = (maxOrder._max.order ?? 0) + 1;
        return tx.phase.create({ data: { planId: id, name, order } });
      });
    } catch (error) {
      throw this.toStructureWriteError(error, 'Error al agregar la fase');
    }

    return {
      id: phase.id,
      name: phase.name,
      order: phase.order,
      createdAt: phase.createdAt,
    };
  }

  /**
   * Quita una fase (hard-delete real — D-7): cascada de Prisma/Postgres a
   * sus semanas, sesiones y ejercicios de sesion. Solo procede en Borrador
   * (PlanPublishedGuard, aplicado a nivel de controller).
   */
  async removePhase(
    coachId: string,
    id: string,
    phaseId: string,
  ): Promise<{ data: null; message: string }> {
    await this.findOwnedOrFail(coachId, id);

    const phase = await this.prisma.phase.findUnique({
      where: { id: phaseId },
    });

    if (!phase || phase.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Fase con id '${phaseId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Phase', identifier: phaseId },
      );
    }

    try {
      await this.prisma.phase.delete({ where: { id: phaseId } });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al eliminar la fase',
        {},
        error as Error,
      );
    }

    return { data: null, message: 'Fase eliminada exitosamente' };
  }

  // ── HU-008: Estructura — semanas ──────────────────────────────────────────

  /**
   * Agrega una semana a una fase. weekNumber es secuencial a lo largo de
   * TODO el plan, no reinicia por fase (D-4) — calculado dentro de una
   * transaccion; el `@@unique([planId, weekNumber])` del schema es la
   * salvaguarda real contra dos altas concurrentes.
   */
  async addWeek(
    coachId: string,
    id: string,
    phaseId: string,
  ): Promise<WeekResponseDto> {
    await this.findOwnedOrFail(coachId, id);

    const phase = await this.prisma.phase.findUnique({
      where: { id: phaseId },
    });

    if (!phase || phase.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Fase con id '${phaseId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Phase', identifier: phaseId },
      );
    }

    let week: Week;

    try {
      week = await this.prisma.$transaction(async (tx) => {
        const weekCount = await tx.week.count({ where: { planId: id } });
        const weekNumber = weekCount + 1;
        return tx.week.create({ data: { phaseId, planId: id, weekNumber } });
      });
    } catch (error) {
      throw this.toStructureWriteError(error, 'Error al agregar la semana');
    }

    return {
      id: week.id,
      weekNumber: week.weekNumber,
      createdAt: week.createdAt,
    };
  }

  /**
   * Quita una semana (hard-delete real — D-7): cascada a sus sesiones y
   * ejercicios de sesion. Ruta plana — weekId ya identifica univocamente
   * sin arrastrar phaseId (D-9).
   */
  async removeWeek(
    coachId: string,
    id: string,
    weekId: string,
  ): Promise<{ data: null; message: string }> {
    await this.findOwnedOrFail(coachId, id);

    const week = await this.prisma.week.findUnique({ where: { id: weekId } });

    if (!week || week.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Semana con id '${weekId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Week', identifier: weekId },
      );
    }

    try {
      await this.prisma.week.delete({ where: { id: weekId } });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al eliminar la semana',
        {},
        error as Error,
      );
    }

    return { data: null, message: 'Semana eliminada exitosamente' };
  }

  // ── HU-008: Estructura — sesiones ─────────────────────────────────────────

  /**
   * Agrega una sesion a una semana. order = maximo order existente en la
   * semana + 1 (D-5), calculado dentro de una transaccion.
   */
  async addSession(
    coachId: string,
    id: string,
    weekId: string,
    dto: AddSessionDto,
  ): Promise<SessionResponseDto> {
    await this.findOwnedOrFail(coachId, id);

    const week = await this.prisma.week.findUnique({ where: { id: weekId } });

    if (!week || week.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Semana con id '${weekId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Week', identifier: weekId },
      );
    }

    const name = dto.name.trim();
    let session: Session;

    try {
      session = await this.prisma.$transaction(async (tx) => {
        const maxOrder = await tx.session.aggregate({
          where: { weekId },
          _max: { order: true },
        });
        const order = (maxOrder._max.order ?? 0) + 1;
        return tx.session.create({ data: { weekId, name, order } });
      });
    } catch (error) {
      throw this.toStructureWriteError(error, 'Error al agregar la sesion');
    }

    return {
      id: session.id,
      name: session.name,
      order: session.order,
      createdAt: session.createdAt,
    };
  }

  /**
   * Quita una sesion (hard-delete real — D-7): cascada a sus ejercicios de
   * sesion. Ruta plana (D-9).
   */
  async removeSession(
    coachId: string,
    id: string,
    sessionId: string,
  ): Promise<{ data: null; message: string }> {
    await this.findOwnedOrFail(coachId, id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { week: true },
    });

    if (!session || session.week.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Sesion con id '${sessionId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Session', identifier: sessionId },
      );
    }

    try {
      await this.prisma.session.delete({ where: { id: sessionId } });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al eliminar la sesion',
        {},
        error as Error,
      );
    }

    return { data: null, message: 'Sesion eliminada exitosamente' };
  }

  // ── HU-008 (CA-008-3): Estructura — ejercicios de sesion ─────────────────

  /**
   * Agrega un ejercicio de la biblioteca global a una sesion. Resuelve
   * exerciseId -> ExerciseVersion vigente (mayor versionNumber) en el
   * momento de la llamada y persiste SessionExercise.exerciseVersionId,
   * nunca un puntero al ejercicio (RN-07). Rechaza con ENTITY_NOT_FOUND si
   * el ejercicio no existe (RN-04) y con EXERCISE_INACTIVE (422) si esta
   * inhabilitado — mismo precedente que CA-006-6 de EPICA-02. Esta es la
   * escritura que hace real isUsedInPlan() de EPICA-02 (D-2): lee
   * Exercise/ExerciseVersion directamente via PrismaService, sin importar
   * ExercisesModule ni ExercisesService.
   */
  async addSessionExercise(
    coachId: string,
    id: string,
    sessionId: string,
    dto: AddSessionExerciseDto,
  ): Promise<SessionExerciseResponseDto> {
    await this.findOwnedOrFail(coachId, id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { week: true },
    });

    if (!session || session.week.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Sesion con id '${sessionId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Session', identifier: sessionId },
      );
    }

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!exercise) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Ejercicio con id '${dto.exerciseId}' no existe en la biblioteca global (RN-04)`,
        { entity: 'Exercise', identifier: dto.exerciseId },
      );
    }

    if (!exercise.isActive) {
      throw new BusinessException(
        BusinessError.EXERCISE_INACTIVE,
        `El ejercicio con id '${dto.exerciseId}' esta inhabilitado y no puede agregarse a una sesion`,
        { entity: 'Exercise', identifier: dto.exerciseId },
      );
    }

    const currentVersion = exercise.versions[0];
    let sessionExercise: SessionExercise;

    try {
      sessionExercise = await this.prisma.$transaction(async (tx) => {
        const maxOrder = await tx.sessionExercise.aggregate({
          where: { sessionId },
          _max: { order: true },
        });
        const order = (maxOrder._max.order ?? 0) + 1;
        return tx.sessionExercise.create({
          data: { sessionId, exerciseVersionId: currentVersion.id, order },
        });
      });
    } catch (error) {
      throw this.toStructureWriteError(
        error,
        'Error al agregar el ejercicio a la sesion',
      );
    }

    return {
      id: sessionExercise.id,
      order: sessionExercise.order,
      exerciseId: exercise.id,
      name: exercise.name,
      description: currentVersion.description,
      muscleGroup: currentVersion.muscleGroup,
      versionNumber: currentVersion.versionNumber,
      createdAt: sessionExercise.createdAt,
    };
  }

  /** Quita un ejercicio de una sesion (hard-delete real — D-7). */
  async removeSessionExercise(
    coachId: string,
    id: string,
    sessionId: string,
    sessionExerciseId: string,
  ): Promise<{ data: null; message: string }> {
    await this.findOwnedOrFail(coachId, id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { week: true },
    });

    if (!session || session.week.planId !== id) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Sesion con id '${sessionId}' no fue encontrada en el plan '${id}'`,
        { entity: 'Session', identifier: sessionId },
      );
    }

    const sessionExercise = await this.prisma.sessionExercise.findUnique({
      where: { id: sessionExerciseId },
    });

    if (!sessionExercise || sessionExercise.sessionId !== sessionId) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Ejercicio de sesion con id '${sessionExerciseId}' no fue encontrado en la sesion '${sessionId}'`,
        { entity: 'SessionExercise', identifier: sessionExerciseId },
      );
    }

    try {
      await this.prisma.sessionExercise.delete({
        where: { id: sessionExerciseId },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al eliminar el ejercicio de la sesion',
        {},
        error as Error,
      );
    }

    return {
      data: null,
      message: 'Ejercicio eliminado exitosamente de la sesion',
    };
  }

  // ── HU-009: Publicacion ───────────────────────────────────────────────────

  /**
   * Borrador -> Publicado. Rechaza con INVALID_STATE_TRANSITION (409) si el
   * estado actual no es Borrador; con PLAN_INCOMPLETE (422) si no cumple
   * RN-01 (CA-009-2), listando explicitamente los requisitos faltantes.
   */
  async publish(coachId: string, id: string): Promise<PlanResponseDto> {
    const plan = await this.findPlanTreeOwnedOrFail(coachId, id);

    if (plan.status !== PlanStatus.DRAFT) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `No se puede publicar el plan '${id}' desde el estado '${plan.status}'`,
        { entity: 'Plan', currentState: plan.status, targetState: 'PUBLISHED' },
      );
    }

    this.validatePlanCompleteness(plan);

    let updated: Plan;

    try {
      updated = await this.prisma.plan.update({
        where: { id },
        data: { status: PlanStatus.PUBLISHED },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al publicar el plan',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('plan.published', { planId: id, coachId });

    return this.mapPlanResponseDto(
      updated,
      this.computeEffectiveStatus(updated),
    );
  }

  /**
   * Publicado -> Borrador. Rechaza con INVALID_STATE_TRANSITION (409) si el
   * estado actual no es Publicado; con PLAN_HAS_SUBSCRIBERS (409) si
   * hasSubscribers(planId) retorna true (CA-009-7). hasSubscribers es un
   * stub que hoy siempre retorna false (mismo patron que isUsedInPlan de
   * EPICA-02) — gap e2e declarado, cubierto solo con test unitario.
   */
  async unpublish(coachId: string, id: string): Promise<PlanResponseDto> {
    const plan = await this.findOwnedOrFail(coachId, id);

    if (plan.status !== PlanStatus.PUBLISHED) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `No se puede despublicar el plan '${id}' desde el estado '${plan.status}'`,
        { entity: 'Plan', currentState: plan.status, targetState: 'DRAFT' },
      );
    }

    const hasSubs = await this.hasSubscribers(id);

    if (hasSubs) {
      throw new BusinessException(
        BusinessError.PLAN_HAS_SUBSCRIBERS,
        `El plan '${id}' tiene atletas suscritos y no puede regresar a Borrador (CA-009-7)`,
        { planId: id },
      );
    }

    let updated: Plan;

    try {
      updated = await this.prisma.plan.update({
        where: { id },
        data: { status: PlanStatus.DRAFT },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al despublicar el plan',
        {},
        error as Error,
      );
    }

    return this.mapPlanResponseDto(
      updated,
      this.computeEffectiveStatus(updated),
    );
  }

  // ── HU-010: Archivo ───────────────────────────────────────────────────────

  /**
   * Borrador, Publicado o Finalizado -> Archivado (CA-010-2). Rechaza con
   * INVALID_STATE_TRANSITION (409) si el estado PERSISTIDO ya es Archivado
   * (CA-010-3) — un plan Publicado ya vencido (endDate pasada) se archiva
   * sin problema aunque la columna aun diga PUBLISHED (D-1): el chequeo es
   * "!= ARCHIVED", no depende de distinguir Publicado de Finalizado. Emite
   * plan.finalized ANTES de archivar solo si el valor EFECTIVO es
   * Finalizado y el persistido todavia no lo refleja.
   */
  async archive(coachId: string, id: string): Promise<PlanResponseDto> {
    const plan = await this.findOwnedOrFail(coachId, id);

    if (plan.status === PlanStatus.ARCHIVED) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `El plan '${id}' ya esta archivado (CA-010-3)`,
        { entity: 'Plan', currentState: plan.status, targetState: 'ARCHIVED' },
      );
    }

    const effectiveStatus = this.computeEffectiveStatus(plan);

    if (
      effectiveStatus === PlanStatus.FINALIZED &&
      plan.status !== PlanStatus.FINALIZED
    ) {
      this.eventEmitter.emit('plan.finalized', { planId: id, coachId });
    }

    let updated: Plan;

    try {
      updated = await this.prisma.plan.update({
        where: { id },
        data: { status: PlanStatus.ARCHIVED },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al archivar el plan',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('plan.archived', { planId: id, coachId });

    return this.mapPlanResponseDto(
      updated,
      this.computeEffectiveStatus(updated),
    );
  }

  // ── HU-011: Catalogo (atleta) ─────────────────────────────────────────────

  /**
   * Lista planes en estado Publicado y NO vencidos (CA-011-1, CA-011-3).
   * Filtro a nivel de query (D-1): status=PUBLISHED AND endDate>=now().
   */
  async findPublished(
    page?: number,
    limit?: number,
  ): Promise<{ data: PlanCatalogSummaryResponseDto[]; meta: PaginationMeta }> {
    const pageNum = this.normalizePage(page);
    const limitNum = this.normalizeLimit(limit);
    const skip = (pageNum - 1) * limitNum;
    const now = new Date();

    const where: Prisma.PlanWhereInput = {
      status: PlanStatus.PUBLISHED,
      endDate: { gte: now },
    };

    let total: number;
    let plans: Array<
      Plan & { coach: { id: string; name: string; avatarUrl: string | null } }
    >;

    try {
      [total, plans] = await this.prisma.$transaction([
        this.prisma.plan.count({ where }),
        this.prisma.plan.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            coach: { select: { id: true, name: true, avatarUrl: true } },
          },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al listar el catalogo de planes',
        {},
        error as Error,
      );
    }

    const data: PlanCatalogSummaryResponseDto[] = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      startDate: this.formatDateOnly(plan.startDate),
      endDate: this.formatDateOnly(plan.endDate),
      coach: {
        id: plan.coach.id,
        name: plan.coach.name,
        avatarUrl: plan.coach.avatarUrl,
      },
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
   * Detalle de un plan Publicado y no vencido (CA-011-2). Un plan que no
   * cumple esa condicion responde ENTITY_NOT_FOUND (404), igual que si no
   * existiera — el atleta no debe poder distinguir "no existe" de "no esta
   * publicado" (mismo mensaje en ambos casos).
   */
  async findPublishedOne(id: string): Promise<PlanCatalogDetailResponseDto> {
    const now = new Date();

    const plan = await this.prisma.plan.findFirst({
      where: { id, status: PlanStatus.PUBLISHED, endDate: { gte: now } },
      include: catalogTreeInclude,
    });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${id}' no fue encontrado`,
        { entity: 'Plan', identifier: id },
      );
    }

    return this.toCatalogDetailResponseDto(plan);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /** Existencia + ownership (CA-008-6/CA-009-5/CA-010-4), sin arbol. */
  private async findOwnedOrFail(coachId: string, id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${id}' no fue encontrado`,
        { entity: 'Plan', identifier: id },
      );
    }

    if (plan.coachId !== coachId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El coach '${coachId}' no tiene acceso al plan '${id}'`,
        { resource: 'Plan', resourceId: id },
      );
    }

    return plan;
  }

  /** Existencia + ownership + arbol completo (D-8), usado por findOne/publish. */
  private async findPlanTreeOwnedOrFail(
    coachId: string,
    id: string,
  ): Promise<PlanTree> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: planTreeInclude,
    });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${id}' no fue encontrado`,
        { entity: 'Plan', identifier: id },
      );
    }

    if (plan.coachId !== coachId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El coach '${coachId}' no tiene acceso al plan '${id}'`,
        { resource: 'Plan', resourceId: id },
      );
    }

    return plan;
  }

  /**
   * RN-01 atraviesa los cuatro niveles: nombre + fechas + al menos una fase
   * con al menos una semana con al menos una sesion con al menos un
   * ejercicio (CA-009-2). Lista explicitamente los requisitos faltantes —
   * nunca un mensaje generico (criterio tecnico del plan de implementacion).
   */
  private validatePlanCompleteness(plan: PlanTree): void {
    const issues: string[] = [];

    if (!plan.name) issues.push('nombre');
    if (!plan.startDate) issues.push('fecha de inicio');
    if (!plan.endDate) issues.push('fecha de fin');

    const weeks = plan.phases.flatMap((phase) => phase.weeks);
    const sessions = weeks.flatMap((week) => week.sessions);

    if (plan.phases.length === 0) {
      issues.push('al menos una fase');
    } else if (weeks.length === 0) {
      issues.push('al menos una semana en una fase');
    } else if (sessions.length === 0) {
      issues.push('al menos una sesion en una semana');
    } else {
      const hasExercises = sessions.some(
        (session) => session.exercises.length > 0,
      );
      if (!hasExercises) {
        issues.push('al menos un ejercicio en una sesion');
      }
    }

    if (issues.length > 0) {
      throw new BusinessException(
        BusinessError.PLAN_INCOMPLETE,
        `El plan '${plan.id}' no cumple los requisitos minimos para publicarse. Falta: ${issues.join(', ')}`,
        { planId: plan.id, missingRequirements: issues },
      );
    }
  }

  /**
   * D-1: valor EFECTIVO del estado del plan. Si el valor persistido es
   * PUBLISHED pero endDate ya paso, retorna FINALIZED sin tocar la base —
   * la fuente de verdad es siempre este valor computado, nunca la columna.
   */
  private computeEffectiveStatus(plan: {
    status: PlanStatus;
    endDate: Date | null;
  }): PlanStatus {
    if (
      plan.status === PlanStatus.PUBLISHED &&
      plan.endDate &&
      plan.endDate.getTime() < Date.now()
    ) {
      return PlanStatus.FINALIZED;
    }
    return plan.status;
  }

  /**
   * D-1: write-through oportunista y NO bloqueante (fire-and-forget, mismo
   * patron que AuditMiddleware) — solo en los puntos de lectura donde el
   * propio coach consulta su plan (GET /plans/:id, GET /plans). Si dos
   * requests concurrentes detectan la misma transicion, la segunda escritura
   * es idempotente (pone el mismo valor) — no requiere lock ni transaccion
   * adicional (riesgo documentado y aceptado en el plan de implementacion).
   */
  private applyEffectiveStatusWriteThrough(
    plan: { id: string; coachId: string; status: PlanStatus },
    effectiveStatus: PlanStatus,
  ): void {
    if (effectiveStatus === plan.status) {
      return;
    }

    const planId = plan.id;
    const coachId = plan.coachId;

    void this.prisma.plan
      .update({ where: { id: planId }, data: { status: PlanStatus.FINALIZED } })
      .then(() => {
        this.eventEmitter.emit('plan.finalized', { planId, coachId });
      })
      .catch((error: unknown) => {
        this.logger.error(
          `No se pudo persistir la transicion automatica a Finalizado del plan '${planId}'`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  /**
   * Punto de integracion con EPICA-04 (suscripciones). HOY siempre retorna
   * false porque no existe tabla de suscripciones — mismo patron que
   * isUsedInPlan de EPICA-02. EPICA-04 debe reemplazar UNICAMENTE el cuerpo
   * de este metodo por una query real contra Subscription, sin tocar
   * ninguna otra linea de unpublish().
   */
  private hasSubscribers(planId: string): Promise<boolean> {
    void planId;
    return Promise.resolve(false);
  }

  private toOwnReadPlanResponseDto(plan: Plan): PlanResponseDto {
    const effectiveStatus = this.computeEffectiveStatus(plan);
    this.applyEffectiveStatusWriteThrough(plan, effectiveStatus);
    return this.mapPlanResponseDto(plan, effectiveStatus);
  }

  private mapPlanResponseDto(
    plan: Plan,
    effectiveStatus: PlanStatus,
  ): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      startDate: this.formatDateOnly(plan.startDate),
      endDate: this.formatDateOnly(plan.endDate),
      status: effectiveStatus,
      coachId: plan.coachId,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private toSessionExerciseResponseDto(
    sessionExercise: SessionExerciseTree,
  ): SessionExerciseResponseDto {
    return {
      id: sessionExercise.id,
      order: sessionExercise.order,
      exerciseId: sessionExercise.exerciseVersion.exerciseId,
      name: sessionExercise.exerciseVersion.exercise.name,
      description: sessionExercise.exerciseVersion.description,
      muscleGroup: sessionExercise.exerciseVersion.muscleGroup,
      versionNumber: sessionExercise.exerciseVersion.versionNumber,
      createdAt: sessionExercise.createdAt,
    };
  }

  private toCatalogDetailResponseDto(
    plan: CatalogPlanTree,
  ): PlanCatalogDetailResponseDto {
    const coachRequest = plan.coach.coachRequest;
    const isApproved = coachRequest?.status === CoachRequestStatus.APPROVED;

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      startDate: this.formatDateOnly(plan.startDate),
      endDate: this.formatDateOnly(plan.endDate),
      phases: plan.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        weeks: phase.weeks.map((week) => ({
          id: week.id,
          weekNumber: week.weekNumber,
          sessions: week.sessions.map((session) => ({
            id: session.id,
            name: session.name,
            exerciseCount: session._count.exercises,
          })),
        })),
      })),
      coach: {
        id: plan.coach.id,
        name: plan.coach.name,
        avatarUrl: plan.coach.avatarUrl,
        description: isApproved ? coachRequest.planDescription : null,
        bannerUrl: isApproved ? (coachRequest.bannerUrl ?? null) : null,
      },
    };
  }

  private formatDateOnly(date: Date | null): string | null {
    if (!date) return null;
    return date.toISOString().slice(0, 10);
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

  /**
   * Traduce un error de escritura de estructura (Phase/Week/Session/
   * SessionExercise) a una excepcion del catalogo. P2002 en estos niveles
   * es casi siempre la salvaguarda `@@unique` por padre (order/weekNumber)
   * reaccionando a una condicion de carrera entre dos altas concurrentes —
   * se traduce a un 409 de negocio claro en vez de un 500 generico.
   */
  private toStructureWriteError(
    error: unknown,
    detail: string,
  ): BusinessException | TechnicalException {
    if (this.isPrismaUniqueConstraintError(error)) {
      return new BusinessException(
        BusinessError.DUPLICATE_ENTITY,
        `${detail}: conflicto al calcular la posicion, intente nuevamente`,
        {},
      );
    }
    return new TechnicalException(
      TechnicalError.DATABASE_ERROR,
      detail,
      {},
      error as Error,
    );
  }

  /** Detecta errores de constraint unico de Prisma (P2002). */
  private isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
