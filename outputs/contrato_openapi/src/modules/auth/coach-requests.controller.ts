import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { ApiProblemResponse } from '../common/swagger/error-responses';
import { SearchCoachRequestsDto } from './dto/search-coach-requests.dto';
import { RejectCoachRequestDto } from './dto/reject-coach-request.dto';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto';
import { CoachRequestDetailResponseDto } from './dto/coach-request-detail-response.dto';

// Guards y decoradores — importados desde common (implementacion pendiente del Desarrollador)
// import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../common/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';
// import { CurrentUser } from '../common/decorators/current-user.decorator';
// import { UserRole } from 'generated/prisma';
// import { CoachRequestsService } from './coach-requests.service';

/**
 * CoachRequestsController — endpoints administrativos de solicitudes de entrenadores (EPICA-01)
 *
 * Ruta base: /coach-requests
 * Todos los endpoints requieren autenticacion JWT y rol ADMIN.
 * Acceso restringido al rol Administrador — los datos personales de los solicitantes
 * son accedidos con finalidad declarada y legitimada (Ley 1581/2012, HU-002 condicion 1).
 *
 * HU-002:
 *   POST   /coach-requests/search        — busqueda avanzada con filtros
 *   GET    /coach-requests/:id           — detalle de una solicitud
 *   POST   /coach-requests/:id/approve   — aprobar solicitud (PENDING → APPROVED)
 *   POST   /coach-requests/:id/reject    — rechazar solicitud (PENDING → REJECTED)
 */
@ApiTags('coach-requests')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)  // Descomentar en implementacion
// @Roles(UserRole.ADMIN)                 // Descomentar en implementacion
@Controller('coach-requests')
export class CoachRequestsController {
  // constructor(private readonly coachRequestsService: CoachRequestsService) {}

  // ── HU-002: Busqueda avanzada de solicitudes ─────────────────────────────

  /**
   * POST /coach-requests/search
   *
   * Body vacio {} retorna todas las solicitudes con paginacion por defecto.
   * Filtros combinables con logica AND.
   * Arrays uuid y status soportan multiples valores (OR dentro del array).
   * nombre: busqueda parcial ILIKE %valor%.
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar solicitudes de entrenadores con filtros opcionales',
    description:
      'Busca solicitudes de registro de entrenadores. Todos los filtros son opcionales — ' +
      'body vacio {} retorna todas las solicitudes con paginacion por defecto (page=1, limit=10). ' +
      'Los filtros se combinan con logica AND. ' +
      'Los campos uuid y status aceptan arrays. El campo nombre usa busqueda parcial. ' +
      'Solo accesible para usuarios con rol Administrador (Ley 1581/2012).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de solicitudes que coinciden con los filtros',
    type: CoachRequestResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(400, 'Error de validacion en los filtros de busqueda')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Administrador')
  async search(
    @Body() dto: SearchCoachRequestsDto,
  ): Promise<{ data: CoachRequestResponseDto[]; meta: object }> {
    // stub — implementacion pendiente del Desarrollador
    // return this.coachRequestsService.search(dto);
    throw new Error('Not implemented');
  }

  // ── HU-002: Detalle de solicitud ─────────────────────────────────────────

  /**
   * GET /coach-requests/:id
   *
   * Incluye todos los campos del formulario para revision del administrador:
   * datos personales del solicitante (de User) y datos de la solicitud (de CoachRequest).
   * ParseUUIDPipe valida que :id sea un UUID v4.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener detalle completo de una solicitud de entrenador',
    description:
      'Retorna todos los campos de la solicitud para revision administrativa: ' +
      'datos personales del solicitante, descripcion del plan, URLs de imagenes y estado actual. ' +
      'Solo accesible para usuarios con rol Administrador (Ley 1581/2012).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle completo de la solicitud encontrada',
    type: CoachRequestDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Administrador')
  @ApiProblemResponse(404, 'Solicitud de entrenador no encontrada')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CoachRequestDetailResponseDto> {
    // stub — implementacion pendiente del Desarrollador
    // return this.coachRequestsService.findOne(id);
    throw new Error('Not implemented');
  }

  // ── HU-002: Aprobar solicitud ────────────────────────────────────────────

  /**
   * POST /coach-requests/:id/approve
   *
   * State machine: PENDING → APPROVED
   * Solo una solicitud en estado PENDING puede ser aprobada.
   * Emite coach.request.approved para notificacion al coach.
   * ParseUUIDPipe valida que :id sea un UUID v4.
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar solicitud de entrenador (PENDING → APPROVED)',
    description:
      'Transiciona la solicitud del estado PENDING al estado APPROVED, ' +
      'habilitando al entrenador para operar en la plataforma. ' +
      'State machine: solo solicitudes en estado PENDING pueden ser aprobadas. ' +
      'Emite el evento coach.request.approved para notificar al entrenador.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud aprobada exitosamente. El entrenador ha sido habilitado.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Administrador')
  @ApiProblemResponse(404, 'Solicitud de entrenador no encontrada')
  @ApiProblemResponse(409, 'Transicion de estado invalida — la solicitud no esta en estado PENDING')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CoachRequestResponseDto> {
    // stub — implementacion pendiente del Desarrollador
    // return this.coachRequestsService.approve(id, user.id);
    throw new Error('Not implemented');
  }

  // ── HU-002: Rechazar solicitud ───────────────────────────────────────────

  /**
   * POST /coach-requests/:id/reject
   *
   * State machine: PENDING → REJECTED
   * Solo una solicitud en estado PENDING puede ser rechazada.
   * El motivo de rechazo es obligatorio y texto libre del administrador.
   * El motivo no debe incluir informacion tecnica ni datos de otros solicitantes.
   * Emite coach.request.rejected con motivo para notificacion al coach.
   * ParseUUIDPipe valida que :id sea un UUID v4.
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar solicitud de entrenador (PENDING → REJECTED)',
    description:
      'Transiciona la solicitud del estado PENDING al estado REJECTED. ' +
      'El motivo de rechazo es obligatorio y debe ser texto libre informativo para el entrenador. ' +
      'El motivo no debe incluir informacion tecnica interna ni datos de otros solicitantes (HU-002 condicion 2). ' +
      'State machine: solo solicitudes en estado PENDING pueden ser rechazadas. ' +
      'Emite el evento coach.request.rejected para notificar al entrenador con el motivo.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud rechazada exitosamente. El entrenador sera notificado con el motivo.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion — el motivo de rechazo es obligatorio y debe tener al menos 10 caracteres')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Administrador')
  @ApiProblemResponse(404, 'Solicitud de entrenador no encontrada')
  @ApiProblemResponse(409, 'Transicion de estado invalida — la solicitud no esta en estado PENDING')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCoachRequestDto,
  ): Promise<CoachRequestResponseDto> {
    // stub — implementacion pendiente del Desarrollador
    // return this.coachRequestsService.reject(id, dto, user.id);
    throw new Error('Not implemented');
  }
}
