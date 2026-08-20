import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse } from '../common/swagger/error-responses.js';
import { PaginationMeta } from '../common/interceptors/response.interceptor.js';
import { PlansService } from './plans.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PlanCatalogSummaryResponseDto } from './dto/plan-catalog-summary-response.dto.js';
import { PlanCatalogDetailResponseDto } from './dto/plan-catalog-detail-response.dto.js';

/**
 * PlansCatalogController — exploracion del catalogo publico de planes
 * publicados por cualquier usuario autenticado (HU-011, EPICA-03).
 *
 * Ruta base: /catalog/plans
 * Requiere solo autenticacion JWT — sin restriccion de rol (cualquier
 * usuario autenticado puede explorar, incluido un entrenador viendo como
 * luce el catalogo; ninguna CA de HU-011 pide restringirlo por rol).
 *
 * Controller separado de PlansController a proposito (decision D-10): evita
 * la ambiguedad de ruteo de NestJS entre el segmento literal "catalog" y el
 * parametro ":id" si convivieran bajo el mismo prefijo /plans, y separa
 * limpiamente las dos audiencias (COACH que construye, cualquier usuario
 * que explora) con guards distintos por controller.
 *
 * El servicio asociado es PlansService (src/modules/plans/plans.service.ts) —
 * mismo service que PlansController, sin duplicar logica de negocio.
 */
@ApiTags('plans-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog/plans')
export class PlansCatalogController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * GET /catalog/plans
   *
   * Lista planes en estado Publicado y NO vencidos (CA-011-1, CA-011-3).
   * Filtro a nivel de query: status=PUBLISHED AND endDate >= now() — un
   * plan Publicado ya vencido queda excluido sin depender de que la
   * columna persistida se haya actualizado a FINALIZED (decision D-1).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar el catalogo de planes publicados',
    description:
      'Lista los planes en estado Publicado y no vencidos (CA-011-1, CA-011-3). El ' +
      'filtro se aplica a nivel de query (status=PUBLISHED AND endDate>=now()), no sobre ' +
      'el campo computado — un plan Publicado ya vencido queda excluido de inmediato sin ' +
      'depender de que la columna persistida se haya actualizado a FINALIZED (D-1). Cada ' +
      'item incluye name, startDate, endDate y el perfil publico reducido del entrenador ' +
      '(id, name, avatarUrl). Accesible para cualquier usuario autenticado.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numero de pagina (base 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de resultados por pagina (max 100)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de planes publicados y vigentes',
    type: PlanCatalogSummaryResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: PlanCatalogSummaryResponseDto[]; meta: PaginationMeta }> {
    return this.plansService.findPublished(page, limit);
  }

  /**
   * GET /catalog/plans/:id
   *
   * Detalle de un plan Publicado y no vencido (CA-011-2): name,
   * description, fechas, estructura de fases/semanas/sesiones con solo la
   * cantidad de ejercicios por sesion, mas el perfil publico completo del
   * entrenador. Un plan que no esta Publicado-y-vigente responde
   * ENTITY_NOT_FOUND (404), igual que si no existiera.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener el detalle de un plan publicado del catalogo',
    description:
      'Devuelve el detalle de un plan en estado Publicado y no vencido (CA-011-2): name, ' +
      'description, startDate, endDate, la estructura de fases/semanas/sesiones con SOLO la ' +
      'cantidad de ejercicios por sesion (no el detalle de cada uno), mas el perfil publico ' +
      'COMPLETO del entrenador (id, name, avatarUrl, description, bannerUrl — los dos ' +
      'ultimos con fallback null si el entrenador no tiene una CoachRequest aprobada, D-2b). ' +
      'Un plan que no esta Publicado-y-vigente responde ENTITY_NOT_FOUND (404), igual que si ' +
      'no existiera — el atleta no debe poder distinguir "no existe" de "no esta publicado". ' +
      'Accesible para cualquier usuario autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Detalle del plan publicado, con el perfil publico completo del entrenador',
    type: PlanCatalogDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    404,
    'Plan no encontrado, o no esta en estado Publicado y vigente (mismo mensaje en ambos casos)',
  )
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanCatalogDetailResponseDto> {
    return this.plansService.findPublishedOne(id);
  }
}
