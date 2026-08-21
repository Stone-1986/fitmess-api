import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  Subscription,
  SubscriptionStatus,
  PlanStatus,
  DocumentType,
  Prisma,
} from '../../../generated/prisma/index.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { TechnicalError } from '../common/exceptions/technical-error.enum.js';
import { PaginationMeta } from '../common/interceptors/response.interceptor.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { AcceptConsentDto } from './dto/accept-consent.dto.js';
import { SubscriptionResponseDto } from './dto/subscription-response.dto.js';
import { SubscriptionPendingSummaryResponseDto } from './dto/subscription-pending-summary-response.dto.js';

// CA-012-2/CA-012-3: estos tres estados bloquean una nueva solicitud al
// mismo plan; una suscripcion Rechazada NUNCA aparece aqui.
const BLOCKING_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PENDING,
  SubscriptionStatus.APPROVED,
  SubscriptionStatus.ACTIVE,
];

const subscriptionWithPlanInclude = {
  plan: true,
} satisfies Prisma.SubscriptionInclude;

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionWithPlanInclude;
}>;

/**
 * SubscriptionsService — inscripcion de atletas a planes de entrenamiento
 * (EPICA-04): solicitud (HU-012), aprobacion/rechazo (HU-013) y
 * consentimiento informado deportivo (HU-014).
 *
 * D-2: lee Plan/User directamente via PrismaService (compartido, @Global) —
 * NUNCA importa PlansService, PlansModule, AuthService ni AuthModule.
 * `isPlanCurrentlyPublished()` replica `computeEffectiveStatus` de
 * PlansService dentro de este modulo (duplicacion CROSS-MODULO intencional,
 * ver D-2 del plan de implementacion).
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── HU-012: Solicitud de inscripcion ──────────────────────────────────────

  /**
   * Crea una suscripcion Pendiente para (atleta autenticado, dto.planId)
   * (CA-012-1). Rechaza con PLAN_NOT_PUBLISHED (409, CA-012-4) si el plan
   * no esta efectivamente Publicado, y con SUBSCRIPTION_ALREADY_EXISTS
   * (409, CA-012-2) si ya existe una suscripcion propia a ese plan en
   * estado Pendiente, Aprobada o Activa — una Rechazada previa NO bloquea
   * (CA-012-3, nueva fila). El indice unico parcial de base de datos
   * (D-3) es la salvaguarda contra la ventana de carrera entre este
   * pre-check y el INSERT. Emite subscription.requested.
   */
  async create(
    athleteId: string,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Plan con id '${dto.planId}' no fue encontrado`,
        { entity: 'Plan', identifier: dto.planId },
      );
    }

    if (!this.isPlanCurrentlyPublished(plan)) {
      throw new BusinessException(
        BusinessError.PLAN_NOT_PUBLISHED,
        `El plan '${dto.planId}' no acepta nuevas inscripciones en su estado actual (CA-012-4)`,
        { planId: dto.planId },
      );
    }

    const existing = await this.prisma.subscription.findFirst({
      where: {
        athleteId,
        planId: dto.planId,
        status: { in: BLOCKING_SUBSCRIPTION_STATUSES },
      },
    });

    if (existing) {
      throw new BusinessException(
        BusinessError.SUBSCRIPTION_ALREADY_EXISTS,
        `Ya existe una suscripcion del atleta '${athleteId}' al plan '${dto.planId}' en estado Pendiente, Aprobada o Activa (CA-012-2)`,
        { athleteId, planId: dto.planId },
      );
    }

    let subscription: Subscription;

    try {
      subscription = await this.prisma.subscription.create({
        data: { athleteId, planId: dto.planId },
      });
    } catch (error) {
      // Salvaguarda del indice unico parcial (D-3) contra la ventana de
      // carrera entre el pre-check y este INSERT.
      if (this.isUniqueConstraintError(error)) {
        throw new BusinessException(
          BusinessError.SUBSCRIPTION_ALREADY_EXISTS,
          `Ya existe una suscripcion del atleta '${athleteId}' al plan '${dto.planId}' en estado Pendiente, Aprobada o Activa (CA-012-2)`,
          { athleteId, planId: dto.planId },
        );
      }
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al crear la suscripcion',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('subscription.requested', {
      subscriptionId: subscription.id,
      athleteId,
      planId: dto.planId,
      coachId: plan.coachId,
    });

    return this.toResponseDto(subscription);
  }

  // ── HU-014: Listado propio ────────────────────────────────────────────────

  /**
   * Lista TODAS las suscripciones propias del atleta autenticado, en
   * cualquier estado, paginado (CA-014-1, CA-014-4) — sin filtro
   * server-side por estado (mismo criterio D-8 de EPICA-03).
   */
  async findMine(
    athleteId: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: SubscriptionResponseDto[]; meta: PaginationMeta }> {
    const pageNum = this.normalizePage(page);
    const limitNum = this.normalizeLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    let total: number;
    let subscriptions: Subscription[];

    try {
      [total, subscriptions] = await this.prisma.$transaction([
        this.prisma.subscription.count({ where: { athleteId } }),
        this.prisma.subscription.findMany({
          where: { athleteId },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al listar las suscripciones del atleta',
        {},
        error as Error,
      );
    }

    const data = subscriptions.map((subscription) =>
      this.toResponseDto(subscription),
    );
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

  // ── HU-013: Panel de pendientes ───────────────────────────────────────────

  /**
   * Lista, paginada, las suscripciones Pendientes de TODOS los planes
   * propios del entrenador autenticado (CA-013-3), con el nombre del
   * atleta y del plan resueltos via `include` de solo lectura (D-2).
   */
  async findPending(
    coachId: string,
    page?: number,
    limit?: number,
  ): Promise<{
    data: SubscriptionPendingSummaryResponseDto[];
    meta: PaginationMeta;
  }> {
    const pageNum = this.normalizePage(page);
    const limitNum = this.normalizeLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.SubscriptionWhereInput = {
      status: SubscriptionStatus.PENDING,
      plan: { coachId },
    };

    let total: number;
    let subscriptions: Array<
      Subscription & { athlete: { name: string }; plan: { name: string } }
    >;

    try {
      [total, subscriptions] = await this.prisma.$transaction([
        this.prisma.subscription.count({ where }),
        this.prisma.subscription.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'asc' },
          include: {
            athlete: { select: { name: true } },
            plan: { select: { name: true } },
          },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al listar las solicitudes pendientes del entrenador',
        {},
        error as Error,
      );
    }

    const data = subscriptions.map(
      (subscription): SubscriptionPendingSummaryResponseDto => ({
        id: subscription.id,
        athleteId: subscription.athleteId,
        athleteName: subscription.athlete.name,
        planId: subscription.planId,
        planName: subscription.plan.name,
        status: subscription.status,
        createdAt: subscription.createdAt,
      }),
    );
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

  // ── HU-013: Aprobacion / rechazo ──────────────────────────────────────────

  /**
   * Pendiente -> Aprobada (CA-013-1). NO verifica vigencia del plan — esa
   * verificacion ocurre en acceptConsent (D-10). Emite subscription.approved.
   */
  async approve(coachId: string, id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.findOwnedByCoachOrFail(coachId, id);

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `La suscripcion '${id}' ya fue resuelta previamente (CA-013-6)`,
        {
          entity: 'Subscription',
          currentState: subscription.status,
          targetState: 'APPROVED',
        },
      );
    }

    let updated: Subscription;

    try {
      updated = await this.prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: coachId,
        },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al aprobar la suscripcion',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('subscription.approved', {
      subscriptionId: updated.id,
      athleteId: updated.athleteId,
      planId: updated.planId,
      coachId,
    });

    return this.toResponseDto(updated);
  }

  /**
   * Pendiente -> Rechazada (CA-013-2). Sin motivo de rechazo (D-4). La
   * suscripcion Rechazada NUNCA se elimina y queda disponible para que el
   * atleta vuelva a solicitar el mismo plan (CA-012-3). Emite
   * subscription.rejected.
   */
  async reject(coachId: string, id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.findOwnedByCoachOrFail(coachId, id);

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `La suscripcion '${id}' ya fue resuelta previamente (CA-013-6)`,
        {
          entity: 'Subscription',
          currentState: subscription.status,
          targetState: 'REJECTED',
        },
      );
    }

    let updated: Subscription;

    try {
      updated = await this.prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedBy: coachId,
        },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al rechazar la suscripcion',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('subscription.rejected', {
      subscriptionId: updated.id,
      athleteId: updated.athleteId,
      planId: updated.planId,
      coachId,
    });

    return this.toResponseDto(updated);
  }

  // ── HU-014: Consentimiento informado deportivo ────────────────────────────

  /**
   * Aprobada -> Activa (CA-014-2). Rechaza con INVALID_STATE_TRANSITION
   * (409) si status !== APPROVED. Si status === APPROVED pero el plan
   * referenciado ya no esta efectivamente vigente (CA-014-8), rechaza con
   * PLAN_NOT_PUBLISHED (409) SIN escribir nada — la suscripcion permanece
   * en Aprobada, ninguna $transaction se abre (D-10). Si ambos checks
   * pasan, crea LegalAcceptance(SPORT_CONSENT) y actualiza la suscripcion
   * a Activa en una unica $transaction atomica (mismo patron que
   * AuthService.registerAthlete). Emite subscription.activated.
   */
  async acceptConsent(
    athleteId: string,
    id: string,
    dto: AcceptConsentDto,
    ip: string,
    userAgent: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.findOwnSubscriptionOrFail(athleteId, id);

    if (subscription.status !== SubscriptionStatus.APPROVED) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `La suscripcion '${id}' no esta en estado Aprobada`,
        {
          entity: 'Subscription',
          currentState: subscription.status,
          targetState: 'ACTIVE',
        },
      );
    }

    if (!this.isPlanCurrentlyPublished(subscription.plan)) {
      throw new BusinessException(
        BusinessError.PLAN_NOT_PUBLISHED,
        `El plan '${subscription.planId}' ya no esta vigente — la suscripcion '${id}' permanece en Aprobada (CA-014-8)`,
        { planId: subscription.planId, subscriptionId: id },
      );
    }

    let updated: Subscription;

    try {
      [, updated] = await this.prisma.$transaction([
        this.prisma.legalAcceptance.create({
          data: {
            userId: athleteId,
            documentType: DocumentType.SPORT_CONSENT,
            documentVersion: dto.documentVersion,
            planId: subscription.planId,
            ip,
            userAgent,
          },
        }),
        this.prisma.subscription.update({
          where: { id },
          data: { status: SubscriptionStatus.ACTIVE, activatedAt: new Date() },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al aceptar el consentimiento informado deportivo',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('subscription.activated', {
      subscriptionId: updated.id,
      athleteId: updated.athleteId,
      planId: updated.planId,
    });

    return this.toResponseDto(updated);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * D-2/D-10: valor EFECTIVO de vigencia del plan, replicado de
   * `computeEffectiveStatus` de PlansService (duplicacion cross-modulo
   * intencional). Un plan con status PERSISTIDO en PUBLISHED pero endDate
   * ya vencida NO cuenta como vigente — exactamente el caso que CA-014-8
   * exige cubrir y que un chequeo ingenuo `status !== PUBLISHED` dejaria
   * pasar. Usado tanto por create() (CA-012-4) como por acceptConsent()
   * (CA-014-8).
   */
  private isPlanCurrentlyPublished(plan: {
    status: PlanStatus;
    endDate: Date | null;
  }): boolean {
    return (
      plan.status === PlanStatus.PUBLISHED &&
      (plan.endDate === null || plan.endDate.getTime() >= Date.now())
    );
  }

  private async findOwnedByCoachOrFail(
    coachId: string,
    id: string,
  ): Promise<Subscription & { plan: { coachId: string } }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: { select: { coachId: true } } },
    });

    if (!subscription) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Suscripcion con id '${id}' no fue encontrada`,
        { entity: 'Subscription', identifier: id },
      );
    }

    if (subscription.plan.coachId !== coachId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El coach '${coachId}' no tiene acceso a la suscripcion '${id}' (CA-013-4)`,
        { resource: 'Subscription', resourceId: id },
      );
    }

    return subscription;
  }

  private async findOwnSubscriptionOrFail(
    athleteId: string,
    id: string,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: subscriptionWithPlanInclude,
    });

    if (!subscription) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Suscripcion con id '${id}' no fue encontrada`,
        { entity: 'Subscription', identifier: id },
      );
    }

    if (subscription.athleteId !== athleteId) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `El atleta '${athleteId}' no tiene acceso a la suscripcion '${id}' (CA-014-6)`,
        { resource: 'Subscription', resourceId: id },
      );
    }

    return subscription;
  }

  private toResponseDto(subscription: Subscription): SubscriptionResponseDto {
    return {
      id: subscription.id,
      athleteId: subscription.athleteId,
      planId: subscription.planId,
      status: subscription.status,
      reviewedAt: subscription.reviewedAt,
      activatedAt: subscription.activatedAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

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
