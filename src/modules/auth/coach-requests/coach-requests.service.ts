import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CoachRequestStatus,
  IdentificationType,
} from '../../../../generated/prisma/index.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../../common/exceptions/technical.exception.js';
import { TechnicalError } from '../../common/exceptions/technical-error.enum.js';
import { SearchCoachRequestsDto } from './dto/search-coach-requests.dto.js';
import { RejectCoachRequestDto } from './dto/reject-coach-request.dto.js';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto.js';
import { CoachRequestDetailResponseDto } from './dto/coach-request-detail-response.dto.js';
import { CoachRequestSummaryResponseDto } from './dto/coach-request-summary-response.dto.js';
import { PaginationMeta } from '../../common/interceptors/response.interceptor.js';

/**
 * Offset UTC de la zona horaria de Colombia (America/Bogota).
 *
 * Es un valor fijo: Colombia no observa horario de verano, por lo que el offset
 * no varia a lo largo del anio. Si el proyecto llegara a operar en paises con DST,
 * esto debe reemplazarse por una conversion con zona horaria real (Intl / date-fns-tz).
 */
const COLOMBIA_UTC_OFFSET = '-05:00';

@Injectable()
export class CoachRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * HU-002: Busqueda avanzada de solicitudes de entrenadores.
   *
   * Filtros opcionales combinables con logica AND.
   * Body vacio retorna todas las solicitudes con paginacion por defecto (page=1, limit=20).
   * Arrays ids y status soportan multiples valores (OR dentro del array).
   * name: busqueda parcial ILIKE %valor%.
   * createdAtFrom/createdAtTo: rango inclusivo en hora local de Colombia.
   */
  async search(
    dto: SearchCoachRequestsDto,
  ): Promise<{ data: CoachRequestSummaryResponseDto[]; meta: PaginationMeta }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Construir filtros where para CoachRequest
    const coachRequestWhere: Record<string, unknown> = {};

    if (dto.ids && dto.ids.length > 0) {
      coachRequestWhere['id'] = { in: dto.ids };
    }

    if (dto.status && dto.status.length > 0) {
      coachRequestWhere['status'] = { in: dto.status };
    }

    // Rango de fechas de creacion — ambos extremos opcionales e inclusivos.
    // Las fechas del filtro se interpretan en hora local de Colombia, no en UTC:
    // un admin que busca "2026-03-02" espera su dia local completo. Sin esta
    // conversion las solicitudes creadas despues de las 19:00 hora local caerian
    // en el dia UTC siguiente y quedarian fuera del resultado.
    if (dto.createdAtFrom || dto.createdAtTo) {
      const createdAtRange: { gte?: Date; lte?: Date } = {};

      if (dto.createdAtFrom) {
        createdAtRange.gte = new Date(
          `${dto.createdAtFrom}T00:00:00.000${COLOMBIA_UTC_OFFSET}`,
        );
      }

      if (dto.createdAtTo) {
        createdAtRange.lte = new Date(
          `${dto.createdAtTo}T23:59:59.999${COLOMBIA_UTC_OFFSET}`,
        );
      }

      coachRequestWhere['createdAt'] = createdAtRange;
    }

    // Filtros sobre User (JOIN via user)
    const userWhere: Record<string, unknown> = {};

    if (dto.email) {
      userWhere['email'] = dto.email.toLowerCase();
    }

    if (dto.name) {
      userWhere['name'] = { contains: dto.name, mode: 'insensitive' };
    }

    if (dto.identificationNumber) {
      userWhere['identificationNumber'] = dto.identificationNumber;
    }

    if (Object.keys(userWhere).length > 0) {
      coachRequestWhere['user'] = userWhere;
    }

    let total: number;
    let requests: Array<{
      id: string;
      userId: string;
      status: CoachRequestStatus;
      bannerUrl: string | null;
      reviewedAt: Date | null;
      createdAt: Date;
      user: {
        name: string;
        email: string;
        identificationType: IdentificationType;
        identificationNumber: string;
      };
    }>;

    try {
      [total, requests] = await this.prisma.$transaction([
        this.prisma.coachRequest.count({ where: coachRequestWhere }),
        this.prisma.coachRequest.findMany({
          where: coachRequestWhere,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            status: true,
            bannerUrl: true,
            reviewedAt: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true,
                identificationType: true,
                identificationNumber: true,
              },
            },
          },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al buscar solicitudes de entrenadores',
        {},
        error as Error,
      );
    }

    const totalPages = Math.ceil(total / limit);

    const data: CoachRequestSummaryResponseDto[] = requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      coachName: r.user.name,
      coachEmail: r.user.email,
      identificationType: r.user.identificationType,
      identificationNumber: r.user.identificationNumber,
      status: r.status,
      bannerUrl: r.bannerUrl ?? undefined,
      reviewedAt: r.reviewedAt ?? undefined,
      createdAt: r.createdAt,
    }));

    const meta: PaginationMeta = {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };

    return { data, meta };
  }

  /**
   * HU-002: Obtiene el detalle completo de una solicitud de entrenador por UUID.
   *
   * Incluye todos los campos del formulario para revision del administrador.
   * Lanza ENTITY_NOT_FOUND si la solicitud no existe.
   */
  async findOne(id: string): Promise<CoachRequestDetailResponseDto> {
    const request = await this.prisma.coachRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            phoneCountryCode: true,
            identificationType: true,
            identificationNumber: true,
            dateOfBirth: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!request) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Solicitud de entrenador con id '${id}' no fue encontrada`,
        { entity: 'CoachRequest', identifier: id },
      );
    }

    return {
      id: request.id,
      status: request.status,
      userId: request.userId,
      coachName: request.user.name,
      coachEmail: request.user.email,
      phoneCountryCode: request.user.phoneCountryCode,
      phone: request.user.phone,
      identificationType: request.user.identificationType,
      identificationNumber: request.user.identificationNumber,
      dateOfBirth: request.user.dateOfBirth
        ? request.user.dateOfBirth.toISOString().split('T')[0]
        : undefined,
      avatarUrl: request.user.avatarUrl ?? undefined,
      planDescription: request.planDescription,
      bannerUrl: request.bannerUrl ?? undefined,
      rejectionReason: request.rejectionReason ?? undefined,
      reviewedAt: request.reviewedAt ?? undefined,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  /**
   * HU-002: Aprueba una solicitud de entrenador (PENDING → APPROVED).
   *
   * State machine: solo PENDING puede aprobarse.
   * APPROVED o REJECTED lanzan INVALID_STATE_TRANSITION (409).
   * Registra reviewedAt y reviewedBy (id del admin).
   * Emite coach.request.approved.
   */
  async approve(id: string, adminId: string): Promise<CoachRequestResponseDto> {
    const request = await this.findOneOrFail(id);

    if (request.status !== CoachRequestStatus.PENDING) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `No se puede aprobar una solicitud en estado '${request.status}'. Solo las solicitudes PENDING pueden ser aprobadas.`,
        {
          entity: 'CoachRequest',
          currentState: request.status,
          targetState: CoachRequestStatus.APPROVED,
        },
      );
    }

    let updated: { id: string; status: CoachRequestStatus; createdAt: Date };

    try {
      updated = await this.prisma.coachRequest.update({
        where: { id },
        data: {
          status: CoachRequestStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: adminId,
        },
        select: { id: true, status: true, createdAt: true },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al aprobar la solicitud de entrenador',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('coach.request.approved', {
      coachRequestId: updated.id,
      coachUserId: request.userId,
      adminId,
    });

    return {
      id: updated.id,
      status: updated.status,
      createdAt: updated.createdAt,
      message:
        'Solicitud aprobada. El entrenador ha sido habilitado en la plataforma.',
    };
  }

  /**
   * HU-002: Rechaza una solicitud de entrenador (PENDING → REJECTED).
   *
   * State machine: solo PENDING puede rechazarse.
   * APPROVED o REJECTED lanzan INVALID_STATE_TRANSITION (409).
   * Persiste el motivo de rechazo.
   * Emite coach.request.rejected con motivo.
   */
  async reject(
    id: string,
    dto: RejectCoachRequestDto,
    adminId: string,
  ): Promise<CoachRequestResponseDto> {
    const request = await this.findOneOrFail(id);

    if (request.status !== CoachRequestStatus.PENDING) {
      throw new BusinessException(
        BusinessError.INVALID_STATE_TRANSITION,
        `No se puede rechazar una solicitud en estado '${request.status}'. Solo las solicitudes PENDING pueden ser rechazadas.`,
        {
          entity: 'CoachRequest',
          currentState: request.status,
          targetState: CoachRequestStatus.REJECTED,
        },
      );
    }

    let updated: { id: string; status: CoachRequestStatus; createdAt: Date };

    try {
      updated = await this.prisma.coachRequest.update({
        where: { id },
        data: {
          status: CoachRequestStatus.REJECTED,
          rejectionReason: dto.rejectionReason,
          reviewedAt: new Date(),
          reviewedBy: adminId,
        },
        select: { id: true, status: true, createdAt: true },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al rechazar la solicitud de entrenador',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('coach.request.rejected', {
      coachRequestId: updated.id,
      coachUserId: request.userId,
      adminId,
      reason: dto.rejectionReason,
    });

    return {
      id: updated.id,
      status: updated.status,
      createdAt: updated.createdAt,
      message:
        'Solicitud rechazada. El entrenador sera notificado con el motivo.',
    };
  }

  /**
   * Busca una solicitud por id y lanza ENTITY_NOT_FOUND si no existe.
   * Metodo interno reutilizado por approve() y reject().
   */
  private async findOneOrFail(id: string): Promise<{
    id: string;
    userId: string;
    status: CoachRequestStatus;
    createdAt: Date;
  }> {
    const request = await this.prisma.coachRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, createdAt: true },
    });

    if (!request) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Solicitud de entrenador con id '${id}' no fue encontrada`,
        { entity: 'CoachRequest', identifier: id },
      );
    }

    return {
      ...request,
      status: request.status,
    };
  }
}
