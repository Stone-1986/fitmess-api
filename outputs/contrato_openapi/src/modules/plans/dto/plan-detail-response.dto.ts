import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanStatus } from '../../../../generated/prisma/index.js';
import { PhaseDetailResponseDto } from './phase-detail-response.dto.js';

/**
 * DTO de respuesta para HU-008: GET /plans/:id (200).
 *
 * Devuelve el arbol completo embebido en una sola respuesta agregada
 * (decision D-8): fases -> semanas -> sesiones -> ejercicios de sesion, con
 * name/description/muscleGroup/versionNumber ya resueltos desde la
 * ExerciseVersion que cada SessionExercise referencia.
 *
 * `status` refleja el valor EFECTIVO (D-1), igual que PlanResponseDto.
 *
 * NUNCA expone: archivedAt (D-7b).
 */
export class PlanDetailResponseDto {
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
      'Estado efectivo del plan (D-1: valor computado en el momento de la lectura, ' +
      'no necesariamente el valor persistido)',
    enum: PlanStatus,
    example: PlanStatus.DRAFT,
  })
  status: PlanStatus;

  @ApiProperty({
    description: 'UUID del entrenador propietario del plan',
    example: 'a9b8c7d6-e5f4-3210-a9b8-c7d6e5f43210',
    format: 'uuid',
  })
  coachId: string;

  @ApiProperty({
    description:
      'Arbol completo de fases del plan, en el orden en que fueron agregadas, ' +
      'cada una con sus semanas, sesiones y ejercicios embebidos (D-8).',
    type: [PhaseDetailResponseDto],
  })
  phases: PhaseDetailResponseDto[];

  @ApiProperty({
    description: 'Fecha de creacion del plan',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de ultima actualizacion del plan',
    example: '2026-08-20T10:00:00.000Z',
  })
  updatedAt: Date;
}
