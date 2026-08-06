import { ApiProperty } from '@nestjs/swagger';
import { ExerciseVersionHistoryResponseDto } from './exercise-version-history-response.dto.js';

/**
 * DTO de respuesta detallada para HU-006 (CA-006-2) + HU-007 (CA-007-3): GET /exercises/:id.
 *
 * A diferencia del listado, este endpoint NO filtra por isActive: un ejercicio
 * inhabilitado se lee igual, con isActive=false visible, para que un plan
 * historico pueda mostrarlo indicando que ya no esta activo en la biblioteca
 * (CA-007-3).
 *
 * description, muscleGroup y versionNumber (a nivel raiz) corresponden a la
 * ExerciseVersion vigente (mayor versionNumber). El arreglo `versions` trae
 * el historial COMPLETO (todas las versiones, incluida la vigente) con
 * numero y fecha de creacion — CA-006-2.
 *
 * NUNCA expone: exerciseId de cada entrada del historial (ver
 * ExerciseVersionHistoryResponseDto), archivedAt (esta entidad usa isActive).
 */
export class ExerciseDetailResponseDto {
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
    description:
      'Indica si el ejercicio esta activo en el catalogo. Este endpoint retorna el ' +
      'ejercicio aunque isActive=false — a diferencia del listado, la consulta directa ' +
      'por id nunca filtra por estado (CA-007-3).',
    example: true,
  })
  isActive: boolean;

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
      'Historial completo de versiones del ejercicio, ordenado por versionNumber ' +
      'ascendente (incluye la version vigente). CA-006-2.',
    type: [ExerciseVersionHistoryResponseDto],
  })
  versions: ExerciseVersionHistoryResponseDto[];

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
