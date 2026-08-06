import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO de entrada para HU-006: Modificacion de un ejercicio existente.
 *
 * Los tres campos son opcionales (semantica PATCH) pero, si se envian, NO pueden
 * ser una cadena vacia (@IsNotEmpty se evalua solo cuando el campo esta presente,
 * por @IsOptional).
 *
 * name es identidad del catalogo (Exercise, no versionado): si se envia, el
 * service lo actualiza directamente sobre Exercise con el mismo chequeo de
 * unicidad case-insensitive + trim contra ejercicios ACTIVOS que usa create()
 * (excluyendo el propio id).
 *
 * description y muscleGroup son contenido de entrenamiento (ExerciseVersion):
 * el service decide entre editar la version vigente in-place (CA-006-3) o
 * crear una version nueva (CA-006-1) segun isUsedInPlan(exerciseId) — logica
 * de negocio, no de este DTO.
 *
 * El rechazo por ejercicio inhabilitado (CA-006-6, EXERCISE_INACTIVE) y por
 * ejercicio inexistente (CA-006-4, ENTITY_NOT_FOUND) tambien son validaciones
 * de negocio resueltas en el service, no en este DTO.
 */
export class UpdateExerciseDto {
  @ApiPropertyOptional({
    description:
      'Nuevo nombre del ejercicio. Si se envia, se valida unicidad case-insensitive ' +
      'con trim contra otros ejercicios ACTIVOS (excluyendo el propio).',
    example: 'Sentadilla trasera con barra',
    minLength: 2,
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del ejercicio no puede estar vacio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description:
      'Nueva descripcion del ejercicio. Contenido de entrenamiento versionado ' +
      '(ExerciseVersion) — edicion in-place o nueva version segun uso en planes.',
    example:
      'Parado con los pies al ancho de los hombros, descender flexionando cadera y rodillas ' +
      'manteniendo el torso mas vertical, con la barra apoyada sobre los trapecios.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La descripcion del ejercicio no puede estar vacia' })
  @MaxLength(1000, {
    message: 'La descripcion no puede superar 1000 caracteres',
  })
  description?: string;

  @ApiPropertyOptional({
    description:
      'Nuevo grupo muscular principal. Contenido de entrenamiento versionado ' +
      '(ExerciseVersion) — edicion in-place o nueva version segun uso en planes.',
    example: 'Gluteos',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El grupo muscular no puede estar vacio' })
  @MaxLength(50, {
    message: 'El grupo muscular no puede superar 50 caracteres',
  })
  muscleGroup?: string;
}
