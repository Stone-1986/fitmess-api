import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de una entrada del historial de versiones de un ejercicio (HU-006 CA-006-2).
 *
 * Embebido en ExerciseDetailResponseDto.versions — no tiene endpoint propio
 * (ver decision arquitectonica: el volumen de versiones por ejercicio es
 * acotado por diseno, no justifica paginacion ni ruta de sub-recurso).
 *
 * Solo expone lo que CA-006-2 pide literalmente: numero de version y fecha
 * de creacion. NUNCA expone exerciseId (dato interno de relacion, redundante
 * con el id del ejercicio contenedor) ni el id propio de la ExerciseVersion
 * (no hay ninguna HU de esta epica que requiera referenciar una version por
 * su id desde el cliente).
 */
export class ExerciseVersionHistoryResponseDto {
  @ApiProperty({
    description: 'Numero de la version dentro del historial del ejercicio',
    example: 2,
  })
  versionNumber: number;

  @ApiProperty({
    description: 'Fecha de creacion de esta version',
    example: '2026-08-10T09:15:00.000Z',
  })
  createdAt: Date;
}
