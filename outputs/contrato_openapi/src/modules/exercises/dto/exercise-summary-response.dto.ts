import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta resumida para el listado del catalogo (HU-005 CA-005-3, HU-007 CA-007-2).
 *
 * Usado en: GET /exercises (200) — un elemento del array de resultados.
 *
 * description, muscleGroup y versionNumber corresponden a la ExerciseVersion
 * vigente (mayor versionNumber), igual que ExerciseResponseDto.
 *
 * isActive viaja en este DTO para que, cuando includeInactive=true trae dos
 * filas con el mismo name (una activa, una inhabilitada — consecuencia
 * aceptada de CA-005-6), el cliente pueda distinguirlas sin ambiguedad.
 *
 * Para el historial completo de versiones → GET /exercises/:id (ExerciseDetailResponseDto).
 */
export class ExerciseSummaryResponseDto {
  @ApiProperty({
    description: 'UUID del ejercicio',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del ejercicio. Identidad del catalogo — no versionado.',
    example: 'Sentadilla con barra',
  })
  name: string;

  @ApiProperty({
    description: 'Descripcion de la version vigente del ejercicio',
    example:
      'Parado con los pies al ancho de los hombros, descender flexionando cadera y rodillas ' +
      'manteniendo la espalda neutra, hasta que los muslos queden paralelos al piso.',
  })
  description: string;

  @ApiProperty({
    description: 'Grupo muscular principal de la version vigente del ejercicio',
    example: 'Cuadriceps',
  })
  muscleGroup: string;

  @ApiProperty({
    description: 'Numero de la version vigente (mayor versionNumber existente)',
    example: 1,
  })
  versionNumber: number;

  @ApiProperty({
    description:
      'Indica si el ejercicio esta activo en el catalogo. Por defecto el listado ' +
      'solo retorna ejercicios activos (CA-007-2) — este campo solo puede ser false ' +
      'cuando la peticion incluyo includeInactive=true.',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Fecha de creacion del ejercicio',
    example: '2026-08-05T10:00:00.000Z',
  })
  createdAt: Date;
}
