import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta para operaciones sobre Exercise.
 *
 * Usado en:
 * - HU-005: POST /exercises (201)
 * - HU-006: PATCH /exercises/:id (200)
 *
 * description, muscleGroup y versionNumber corresponden a la ExerciseVersion
 * vigente (la de mayor versionNumber) — obtenida con
 * include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }.
 * No existe un puntero denormalizado currentVersionId en Exercise.
 *
 * NUNCA expone: exerciseId de la version embebida (dato interno de relacion,
 * redundante con el id de este mismo DTO), archivedAt (esta entidad usa
 * isActive, no archivedAt — ver design-patterns skill seccion 5).
 */
export class ExerciseResponseDto {
  @ApiProperty({
    description: 'UUID del ejercicio',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Nombre del ejercicio. Identidad del catalogo — no versionado.',
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
      'Indica si el ejercicio esta activo en el catalogo. false = inhabilitado ' +
      '(soft-delete propio de ejercicios, ver CA-007-1).',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Fecha de creacion del ejercicio',
    example: '2026-08-05T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de ultima actualizacion del ejercicio',
    example: '2026-08-05T10:00:00.000Z',
  })
  updatedAt: Date;
}
