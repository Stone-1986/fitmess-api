import { ApiProperty } from '@nestjs/swagger';
import { InstancePhaseResponseDto } from './instance-phase-response.dto.js';

/**
 * DTO de respuesta para el detalle completo de la instancia personalizada de
 * un atleta (HU-023, D-2).
 *
 * Usado en:
 * - GET /instances/:planId (ATHLETE) — detalle propio, auto-reparable (D-3)
 * - GET /instances/:planId/athletes/:athleteId (COACH) — panel del atleta
 *   (HU-017, lectura de sensaciones de HU-016). MISMO DTO para ambos
 *   endpoints — el contenido es identico, solo cambia quien pregunta (D-8).
 *
 * Devuelve el arbol completo embebido en una sola respuesta agregada (mismo
 * criterio D-8 de EPICA-03 aplicado a la instancia): fases -> semanas (con
 * cierre y sensaciones) -> sesiones (con resultado) -> ejercicios (con
 * version congelada y prescripcion copiada).
 *
 * `id` es el id interno de PlanInstance — se expone como identidad propia
 * del recurso (igual que PlanResponseDto.id o SubscriptionResponseDto.id),
 * pero NUNCA es necesario para navegar la API: todas las rutas de esta
 * epica usan `:planId` (el id de la PLANTILLA), nunca este id (D-7, D-7b).
 *
 * NUNCA expone: `subscriptionId` (dato interno de relacion, sin uso para el
 * cliente), `archivedAt` (PlanInstance no tiene estado de archivo propio).
 */
export class InstanceDetailResponseDto {
  @ApiProperty({
    description:
      'UUID interno de la instancia (PlanInstance). Nunca se usa como parametro de ' +
      'ruta — todos los endpoints de la instancia identifican por :planId (D-7b).',
    example: 'a7b8c9d0-e1f2-4345-fabc-678901234567',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'UUID del plan (plantilla) del que esta instancia es una copia personalizada',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  planId: string;

  @ApiProperty({
    description: 'Nombre del plan (plantilla), resuelto via join de solo lectura',
    example: 'Fuerza e hipertrofia — bloque 1',
  })
  planName: string;

  @ApiProperty({
    description:
      'UUID del atleta titular de esta instancia. Para el atleta consultando su propia ' +
      'instancia es redundante con su propia identidad; para el entrenador ' +
      '(GET .../athletes/:athleteId) confirma de que atleta es este panel.',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    format: 'uuid',
  })
  athleteId: string;

  @ApiProperty({
    description:
      'Arbol completo de fases de la instancia, en el orden en que fueron copiadas de ' +
      'la plantilla (D-2), cada una con sus semanas, sesiones, ejercicios, resultados y ' +
      'sensaciones embebidos.',
    type: [InstancePhaseResponseDto],
  })
  phases: InstancePhaseResponseDto[];

  @ApiProperty({
    description:
      'Fecha de creacion de la instancia (momento de la copia profunda desde la ' +
      'plantilla — CA-023-1)',
    example: '2026-08-22T09:00:00.000Z',
  })
  createdAt: Date;
}
