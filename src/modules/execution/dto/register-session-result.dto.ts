import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionExerciseResultItemDto } from './session-exercise-result-item.dto.js';

/**
 * DTO de entrada para HU-015: registrar o editar los resultados de una
 * sesion de la instancia propia del atleta (upsert — D-6b, un solo endpoint
 * para alta y edicion).
 *
 * `exercises` debe traer EXACTAMENTE los ejercicios programados de la
 * sesion referenciada por :sessionId, ni de mas ni de menos (CA-015-10) —
 * esa verificacion es de negocio, se hace en el service (RESULT_FIELDS_INVALID,
 * 422), no en este DTO: la validacion estructural aqui solo exige que el
 * array no este vacio y que cada item tenga forma valida (sessionExerciseId
 * + campos numericos opcionales, CA-015-11).
 */
export class RegisterSessionResultDto {
  @ApiProperty({
    description:
      'Resultados por ejercicio de la sesion. Debe incluir EXACTAMENTE los ejercicios ' +
      'programados de la sesion referenciada por :sessionId (ni de mas ni de menos) — ' +
      'un payload que omita alguno, o incluya uno que no pertenece a la sesion, se ' +
      'rechaza con RESULT_FIELDS_INVALID (422, CA-015-10) sin escribir nada.',
    type: [SessionExerciseResultItemDto],
  })
  @IsArray({ message: 'exercises debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'exercises debe incluir al menos un ejercicio' })
  @ValidateNested({ each: true })
  @Type(() => SessionExerciseResultItemDto)
  exercises: SessionExerciseResultItemDto[];
}
