import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO de entrada para HU-005: Creacion de ejercicio en la biblioteca global.
 *
 * Los tres campos son exactamente los definidos por decision del humano del
 * 2026-08-05 (sin equipo, dificultad ni multimedia — ver epica_input.yaml).
 *
 * name vive en Exercise (no versionado) — es la identidad del catalogo.
 * description y muscleGroup viven en ExerciseVersion (versionado) y forman
 * la primera version (versionNumber = 1) creada junto con el Exercise en la
 * misma $transaction (CA-005-1).
 *
 * La normalizacion (trim) y la verificacion de unicidad case-insensitive
 * contra ejercicios ACTIVOS (CA-005-2/CA-005-6) son logica de negocio del
 * service, no de este DTO — el DTO solo valida estructura.
 */
export class CreateExerciseDto {
  @ApiProperty({
    description:
      'Nombre del ejercicio. Identidad del catalogo — no se versiona. ' +
      'La unicidad es case-insensitive, con trim, y aplica solo entre ejercicios activos (CA-005-2/CA-005-6).',
    example: 'Sentadilla con barra',
    minLength: 2,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del ejercicio es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;

  @ApiProperty({
    description:
      'Descripcion del ejercicio (instrucciones de ejecucion). Contenido de entrenamiento — ' +
      'vive en la primera ExerciseVersion (versionNumber = 1).',
    example:
      'Parado con los pies al ancho de los hombros, descender flexionando cadera y rodillas ' +
      'manteniendo la espalda neutra, hasta que los muslos queden paralelos al piso.',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripcion del ejercicio es obligatoria' })
  @MaxLength(1000, {
    message: 'La descripcion no puede superar 1000 caracteres',
  })
  description: string;

  @ApiProperty({
    description:
      'Grupo muscular principal trabajado por el ejercicio. Texto libre en esta epica — ' +
      'no existe catalogo/enum de grupos musculares (ninguna HU lo requiere).',
    example: 'Cuadriceps',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'El grupo muscular es obligatorio' })
  @MaxLength(50, {
    message: 'El grupo muscular no puede superar 50 caracteres',
  })
  muscleGroup: string;
}
