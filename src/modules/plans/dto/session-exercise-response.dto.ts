import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta para un ejercicio dentro de una sesion del plan.
 *
 * Usado en:
 * - POST /plans/:id/sessions/:sessionId/exercises (201) — respuesta directa
 * - GET /plans/:id (200) — embebido en SessionDetailResponseDto.exercises
 *
 * name, description, muscleGroup y versionNumber corresponden a la
 * ExerciseVersion que el service resolvio y persistio como
 * SessionExercise.exerciseVersionId en el momento de agregar el ejercicio
 * (CA-008-3) — NUNCA la version vigente actual del ejercicio en la
 * biblioteca (RN-07). Si el ejercicio se modifica o se inhabilita despues,
 * esta respuesta sigue mostrando la version original que la sesion conserva.
 *
 * exerciseId identifica el Exercise de la biblioteca global (util para que
 * el cliente enlace al detalle del ejercicio) — el exerciseVersionId interno
 * (FK real persistida) no se expone, igual que ExerciseResponseDto no expone
 * un puntero crudo a version en vez de versionNumber.
 *
 * NUNCA expone: exerciseVersionId (dato interno de relacion), sessionId
 * (redundante — el cliente ya lo conoce por el contexto en el que pidio o
 * recibio este DTO), archivedAt.
 */
export class SessionExerciseResponseDto {
  @ApiProperty({
    description: 'UUID del ejercicio de sesion (SessionExercise)',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Posicion de este ejercicio dentro de la sesion (calculada server-side, D-5)',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description:
      'UUID del ejercicio de la biblioteca global (Exercise) referenciado',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  exerciseId: string;

  @ApiProperty({
    description: 'Nombre del ejercicio (identidad del catalogo, no versionado)',
    example: 'Sentadilla con barra',
  })
  name: string;

  @ApiProperty({
    description:
      'Descripcion de la version del ejercicio que esta sesion conserva (RN-07)',
    example:
      'Parado con los pies al ancho de los hombros, descender flexionando cadera y rodillas ' +
      'manteniendo la espalda neutra, hasta que los muslos queden paralelos al piso.',
  })
  description: string;

  @ApiProperty({
    description:
      'Grupo muscular principal de la version del ejercicio que esta sesion conserva (RN-07)',
    example: 'Cuadriceps',
  })
  muscleGroup: string;

  @ApiProperty({
    description:
      'Numero de la version del ejercicio que esta sesion conserva — la vigente al ' +
      'momento de agregarlo (RN-07), no necesariamente la vigente hoy en la biblioteca.',
    example: 1,
  })
  versionNumber: number;

  @ApiProperty({
    description: 'Fecha en la que este ejercicio fue agregado a la sesion',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;
}
