import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * Item de un ejercicio dentro del payload de
 * POST /instances/:planId/sessions/:sessionId/results (HU-015).
 *
 * `sessionExerciseId` identifica CUAL ejercicio de la instancia recibe este
 * resultado — el mismo id que el cliente ya vio en
 * InstanceSessionResponseDto.exercises[].id al consultar GET /instances/:planId.
 *
 * Los 5 campos numericos son TODOS opcionales (CA-015-11): el atleta llena
 * unicamente los que aplican al tipo de ejercicio que realizo (fuerza:
 * sets/reps/loadKg; resistencia: durationSeconds/distanceMeters). El
 * service NO exige que un item traiga los 5 — solo verifica que el
 * CONJUNTO de items del payload coincida exactamente con los ejercicios
 * programados de la sesion (RESULT_FIELDS_INVALID, 422, si no coincide —
 * CA-015-10). `notes` es la unica diferencia respecto a la prescripcion de
 * la plantilla: solo el resultado la tiene.
 */
export class SessionExerciseResultItemDto {
  @ApiProperty({
    description:
      'UUID del ejercicio de sesion de la instancia (InstanceSessionExercise) al que ' +
      'corresponde este resultado — obtenido de InstanceSessionResponseDto.exercises[].id ' +
      'en GET /instances/:planId.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'sessionExerciseId debe ser un UUID valido' })
  @IsString()
  @IsNotEmpty({ message: 'sessionExerciseId es obligatorio' })
  sessionExerciseId: string;

  @ApiPropertyOptional({
    description: 'Series realizadas. Solo aplica a ejercicios de regimen de fuerza (CA-015-11).',
    example: 4,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'sets debe ser un numero entero' })
  @Min(1, { message: 'sets debe ser al menos 1' })
  sets?: number;

  @ApiPropertyOptional({
    description: 'Repeticiones realizadas por serie. Solo aplica a ejercicios de regimen de fuerza.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'reps debe ser un numero entero' })
  @Min(1, { message: 'reps debe ser al menos 1' })
  reps?: number;

  @ApiPropertyOptional({
    description: 'Carga utilizada, en kilogramos (convencion, D-6).',
    example: 80,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'loadKg debe ser un numero' })
  @Min(0, { message: 'loadKg no puede ser negativo' })
  loadKg?: number;

  @ApiPropertyOptional({
    description: 'Duracion realizada, en segundos. Solo aplica a ejercicios de regimen de resistencia.',
    example: 1200,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'durationSeconds debe ser un numero entero' })
  @Min(1, { message: 'durationSeconds debe ser al menos 1' })
  durationSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Distancia recorrida, en metros (convencion, D-6). Solo aplica a ejercicios de ' +
      'regimen de resistencia.',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'distanceMeters debe ser un numero' })
  @Min(0, { message: 'distanceMeters no puede ser negativo' })
  distanceMeters?: number;

  @ApiPropertyOptional({
    description: 'Nota libre opcional sobre este ejercicio',
    example: 'Sentí molestia leve en la rodilla derecha en la última serie',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'notes debe ser una cadena de texto' })
  @MaxLength(500, { message: 'notes no puede superar 500 caracteres' })
  notes?: string;
}
