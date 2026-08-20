import { ApiProperty } from '@nestjs/swagger';
import { SessionExerciseResponseDto } from './session-exercise-response.dto.js';

/**
 * DTO de una sesion embebida en el arbol completo de GET /plans/:id (D-8).
 *
 * A diferencia de SessionResponseDto (respuesta de la creacion incremental),
 * este SI incluye `exercises` — el arbol completo se lee en una sola
 * respuesta agregada (decision D-8: lectura agregada, escritura granular).
 */
export class SessionDetailResponseDto {
  @ApiProperty({
    description: 'UUID de la sesion',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la sesion',
    example: 'Dia 1 — Tren inferior (fuerza)',
  })
  name: string;

  @ApiProperty({
    description: 'Posicion de esta sesion dentro de la semana',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description:
      'Ejercicios de esta sesion, en el orden en que fueron agregados',
    type: [SessionExerciseResponseDto],
  })
  exercises: SessionExerciseResponseDto[];
}
