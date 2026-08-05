import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse } from '../../src/modules/common/swagger/error-responses';

// DTOs de entrada
import { RejectCoachRequestDto } from './dto/reject-coach-request.dto';
import { SearchCoachRequestsDto } from './dto/search-coach-requests.dto';

// DTOs de respuesta
import { CoachRequestDetailResponseDto } from './dto/coach-request-detail-response.dto';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto';
import { CoachRequestSummaryResponseDto } from './dto/coach-request-summary-response.dto';
import { PaginationMetaResponseDto } from './dto/pagination-meta-response.dto';

/**
 * Controller de gestión de solicitudes de entrenadores — endpoints privados de EPICA-01 (HU-002).
 *
 * ACCESO: Exclusivo para el rol ADMIN.
 * JwtAuthGuard y RolesGuard(ADMIN) aplicados a nivel de controller.
 *
 * Nota sobre @UseGuards: Los guards referenciados aquí son los que el Desarrollador
 * debe implementar en src/modules/auth/coach-requests.controller.ts.
 * - JwtAuthGuard: en src/modules/common/guards/jwt-auth.guard.ts
 * - RolesGuard: en src/modules/common/guards/roles.guard.ts
 *
 * El servicio asociado es CoachRequestsService (src/modules/auth/coach-requests.service.ts).
 */
@ApiTags('coach-requests')
@ApiBearerAuth()
@UseGuards(/* JwtAuthGuard, RolesGuard */)
@Controller('coach-requests')
export class CoachRequestsController {
  constructor(private readonly coachRequestsService: any) {}

  // ── HU-002: Buscar solicitudes ────────────────────────────────────────────

  /**
   * POST /coach-requests/search
   *
   * Busca solicitudes de entrenadores con filtros opcionales combinables (AND lógico).
   * Body vacío retorna todas las solicitudes con paginación por defecto (página 1, 20 por página).
   * Búsqueda por nombre es parcial (ILIKE %valor%).
   *
   * Acceso: exclusivo ADMIN (RolesGuard).
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar solicitudes de entrenadores con filtros',
    description:
      'Listado paginado de solicitudes de registro como entrenador. Todos los filtros son ' +
      'opcionales y combinables (AND lógico). Body vacío retorna todas las solicitudes. ' +
      'La búsqueda por nombre es parcial. Acceso exclusivo para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de solicitudes que coinciden con los filtros.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/CoachRequestSummaryResponseDto' },
        },
        meta: { $ref: '#/components/schemas/PaginationMetaResponseDto' },
      },
    },
  })
  @ApiProblemResponse(400, 'Error de validación en los filtros de búsqueda')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT válido')
  @ApiProblemResponse(403, 'Acceso denegado — rol insuficiente (se requiere ADMIN)')
  async search(
    @Body() dto: SearchCoachRequestsDto,
  ): Promise<{ data: CoachRequestSummaryResponseDto[]; meta: PaginationMetaResponseDto }> {
    throw new NotImplementedException(
      'CoachRequestsService.search() pendiente de implementación',
    );
  }

  // ── HU-002: Detalle de solicitud ──────────────────────────────────────────

  /**
   * GET /coach-requests/:id
   *
   * Retorna el detalle completo de una solicitud incluyendo todos los datos del
   * coach solicitante para revisión administrativa.
   *
   * ParseUUIDPipe valida que :id sea un UUID v4 válido.
   * Acceso: exclusivo ADMIN (RolesGuard).
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle completo de una solicitud de entrenador',
    description:
      'Retorna todos los datos del coach solicitante necesarios para que el administrador ' +
      'tome la decisión de aprobar o rechazar la solicitud. Incluye nombre, email, ' +
      'identificación, planDescription, bannerUrl y estado actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la solicitud encontrada.',
    type: CoachRequestDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT válido')
  @ApiProblemResponse(403, 'Acceso denegado — rol insuficiente (se requiere ADMIN)')
  @ApiProblemResponse(404, 'Solicitud de entrenador no encontrada')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CoachRequestDetailResponseDto> {
    throw new NotImplementedException(
      'CoachRequestsService.findOne() pendiente de implementación',
    );
  }

  // ── HU-002: Aprobar solicitud ─────────────────────────────────────────────

  /**
   * POST /coach-requests/:id/approve
   *
   * Transiciona CoachRequest de PENDING → APPROVED.
   * Máquina de estados: solo PENDING puede aprobarse.
   * APPROVED o REJECTED → INVALID_STATE_TRANSITION (409).
   *
   * Registra reviewedAt y reviewedBy (id del admin autenticado).
   * Habilita al coach para operar en la plataforma.
   *
   * ParseUUIDPipe valida que :id sea un UUID v4 válido.
   * Acceso: exclusivo ADMIN (RolesGuard).
   * Emite: coach.request.approved
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar solicitud de entrenador (PENDING → APPROVED)',
    description:
      'Transiciona la solicitud al estado APPROVED. Solo es posible desde PENDING. ' +
      'Registra el timestamp de revisión y el ID del administrador que aprobó. ' +
      'Notifica al coach via evento coach.request.approved.',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitud aprobada exitosamente. El coach puede iniciar sesión.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT válido')
  @ApiProblemResponse(403, 'Acceso denegado — rol insuficiente (se requiere ADMIN)')
  @ApiProblemResponse(404, 'Solicitud de entrenador no encontrada')
  @ApiProblemResponse(409, 'Transición de estado inválida — la solicitud ya fue aprobada o rechazada')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CoachRequestResponseDto> {
    throw new NotImplementedException(
      'CoachRequestsService.approve() pendiente de implementación',
    );
  }

  // ── HU-002: Rechazar solicitud ────────────────────────────────────────────

  /**
   * POST /coach-requests/:id/reject
   *
   * Transiciona CoachRequest de PENDING → REJECTED con motivo obligatorio.
   * Máquina de estados: solo PENDING puede rechazarse.
   * APPROVED o REJECTED → INVALID_STATE_TRANSITION (409).
   *
   * El motivo de rechazo se persiste y se envía al coach via evento.
   * El motivo NO debe contener información técnica interna (Ley 1273/2009).
   *
   * ParseUUIDPipe valida que :id sea un UUID v4 válido.
   * Acceso: exclusivo ADMIN (RolesGuard).
   * Emite: coach.request.rejected
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar solicitud de entrenador (PENDING → REJECTED)',
    description:
      'Transiciona la solicitud al estado REJECTED con un motivo obligatorio. ' +
      'Solo es posible desde PENDING. El motivo es texto libre orientado al coach — ' +
      'no debe incluir información técnica interna del sistema (Ley 1273/2009). ' +
      'Notifica al coach via evento coach.request.rejected con el motivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitud rechazada exitosamente. Se notificará al coach.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validación — el motivo de rechazo es obligatorio')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT válido')
  @ApiProblemResponse(403, 'Acceso denegado — rol insuficiente (se requiere ADMIN)')
  @ApiProblemResponse(404, 'Solicitud de entrenador no encontrada')
  @ApiProblemResponse(409, 'Transición de estado inválida — la solicitud ya fue aprobada o rechazada')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCoachRequestDto,
  ): Promise<CoachRequestResponseDto> {
    throw new NotImplementedException(
      'CoachRequestsService.reject() pendiente de implementación',
    );
  }
}
