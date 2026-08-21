import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de respuesta para un ejercicio dentro de una sesion de la instancia
 * personalizada del atleta (HU-023).
 *
 * Usado embebido en InstanceSessionResponseDto.exercises, dentro del arbol
 * completo de GET /instances/:planId(/athletes/:athleteId).
 *
 * MISMA forma que SessionExerciseResponseDto de la plantilla (modulo
 * `plans`) — name/description/muscleGroup/versionNumber corresponden a la
 * ExerciseVersion que la instancia copio TAL CUAL desde la plantilla en el
 * momento de su creacion (CA-023-2, D-13): el service de esta epica nunca
 * vuelve a resolver la version vigente. Si el ejercicio se modifica despues
 * en la biblioteca global, esta respuesta sigue mostrando la version
 * congelada al crear la instancia.
 *
 * `sets`/`reps`/`loadKg`/`durationSeconds`/`distanceMeters` son la
 * PRESCRIPCION — lo que el entrenador definio que el atleta debe hacer,
 * copiada tal cual desde SessionExercise de la plantilla en el momento de la
 * creacion de la instancia (CA-023-9, D-15 punto 8). Nullable porque,
 * aunque `publish()` ya exige "prescripcion significativa" por ejercicio
 * (D-15 punto 2), esa regla acepta combinaciones parciales por regimen
 * (fuerza: sets+reps sin loadKg; resistencia: solo uno de
 * durationSeconds/distanceMeters) — nunca los 5 campos llenos a la vez.
 * NO son dato sensible de salud (confirmado por el Analista, HU-023 CA-023-9).
 *
 * NUNCA expone: `exerciseVersionId` (dato interno de relacion, mismo
 * criterio que SessionExerciseResponseDto), `sessionId`/`instanceSessionId`
 * (redundante — el cliente ya lo conoce por el contexto).
 */
export class InstanceSessionExerciseResponseDto {
  @ApiProperty({
    description: 'UUID del ejercicio de sesion de la instancia (InstanceSessionExercise)',
    example: 'a2b3c4d5-e6f7-4890-b123-c4d5e6f78901',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Posicion de este ejercicio dentro de la sesion, copiada de la plantilla',
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
      'Descripcion de la version del ejercicio que esta instancia congelo al crearse (RN-07, CA-023-2)',
    example:
      'Parado con los pies al ancho de los hombros, descender flexionando cadera y rodillas ' +
      'manteniendo la espalda neutra, hasta que los muslos queden paralelos al piso.',
  })
  description: string;

  @ApiProperty({
    description:
      'Grupo muscular principal de la version del ejercicio que esta instancia congelo al crearse',
    example: 'Cuadriceps',
  })
  muscleGroup: string;

  @ApiProperty({
    description:
      'Numero de la version del ejercicio congelada por la instancia — la vigente en la ' +
      'plantilla al momento en que esta se copio (RN-07, D-13), no necesariamente la ' +
      'vigente hoy en la biblioteca.',
    example: 1,
  })
  versionNumber: number;

  @ApiPropertyOptional({
    description:
      'Series prescritas por el entrenador, copiadas de la plantilla (CA-023-9). ' +
      'Tipico de ejercicios de regimen de fuerza.',
    example: 4,
    type: Number,
    nullable: true,
  })
  sets: number | null;

  @ApiPropertyOptional({
    description: 'Repeticiones prescritas por serie, copiadas de la plantilla.',
    example: 10,
    type: Number,
    nullable: true,
  })
  reps: number | null;

  @ApiPropertyOptional({
    description:
      'Carga prescrita, en kilogramos (convencion, D-6). Ausente para ejercicios de peso ' +
      'corporal dentro del regimen de fuerza (D-15 punto 2a).',
    example: 80,
    type: Number,
    nullable: true,
  })
  loadKg: number | null;

  @ApiPropertyOptional({
    description:
      'Duracion prescrita, en segundos. Tipico de ejercicios de regimen de resistencia.',
    example: 1200,
    type: Number,
    nullable: true,
  })
  durationSeconds: number | null;

  @ApiPropertyOptional({
    description:
      'Distancia prescrita, en metros (convencion, D-6). Tipico de ejercicios de regimen ' +
      'de resistencia — no se exige junto con durationSeconds (D-15 punto 2b).',
    example: 5000,
    type: Number,
    nullable: true,
  })
  distanceMeters: number | null;

  @ApiProperty({
    description: 'Fecha en la que este ejercicio fue copiado a la instancia',
    example: '2026-08-22T09:00:00.000Z',
  })
  createdAt: Date;
}
