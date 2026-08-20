import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoachProfileResponseDto } from './coach-profile-response.dto.js';
import { PlanCatalogPhaseResponseDto } from './plan-catalog-phase-response.dto.js';

/**
 * DTO de respuesta para HU-011 (CA-011-2): GET /catalog/plans/:id (200).
 *
 * name, description, fechas y estructura completa de fases/semanas/sesiones
 * (con SOLO la cantidad de ejercicios por sesion, no el detalle de cada uno —
 * ninguna CA de esta epica lo pide), mas el perfil publico COMPLETO del
 * entrenador (ver CoachProfileResponseDto y su advertencia legal).
 *
 * Este endpoint solo retorna un plan Publicado y no vencido — un plan que no
 * cumple esa condicion responde ENTITY_NOT_FOUND (404), igual que si no
 * existiera (el atleta no debe poder distinguir "no existe" de "no esta
 * publicado").
 */
export class PlanCatalogDetailResponseDto {
  @ApiProperty({
    description: 'UUID del plan',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del plan',
    example: 'Fuerza e hipertrofia — bloque 1',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Descripcion del plan',
    example:
      'Bloque de 8 semanas enfocado en fuerza maxima y volumen de hipertrofia para tren inferior.',
    type: String,
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del plan',
    example: '2026-09-01',
    format: 'date',
    type: String,
    nullable: true,
  })
  startDate: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de fin del plan',
    example: '2026-10-27',
    format: 'date',
    type: String,
    nullable: true,
  })
  endDate: string | null;

  @ApiProperty({
    description:
      'Estructura del plan: fases con sus semanas y sesiones, cada sesion con la ' +
      'cantidad de ejercicios que la componen (no el detalle de cada ejercicio).',
    type: [PlanCatalogPhaseResponseDto],
  })
  phases: PlanCatalogPhaseResponseDto[];

  @ApiProperty({
    description: 'Perfil publico completo del entrenador que publico el plan',
    type: CoachProfileResponseDto,
  })
  coach: CoachProfileResponseDto;
}
