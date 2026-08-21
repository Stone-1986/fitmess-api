import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta resumida para el listado de instancias propias del
 * atleta (HU-023, CA-023-4, CA-023-5).
 *
 * Usado en: GET /instances (200) — un elemento del array.
 *
 * Resumen liviano, sin el arbol completo — mismo criterio D-8 de EPICA-03
 * (GET /plans no trae el arbol, GET /plans/:id si). `planName` resuelto via
 * join de solo lectura contra Plan, mismo patron ya usado por
 * SubscriptionPendingSummaryResponseDto en EPICA-04.
 *
 * `id` es el id interno de PlanInstance, expuesto como identidad propia del
 * recurso — nunca requerido para navegar la API: el detalle se pide con
 * GET /instances/:planId usando `planId`, no este `id` (D-7b).
 */
export class InstanceSummaryResponseDto {
  @ApiProperty({
    description:
      'UUID interno de la instancia (PlanInstance). No se usa como parametro de ruta ' +
      '— el detalle se consulta con GET /instances/:planId (D-7b).',
    example: 'a7b8c9d0-e1f2-4345-fabc-678901234567',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'UUID del plan (plantilla) del que esta instancia es una copia — usado como ' +
      ':planId en GET /instances/:planId',
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
      'Fecha de creacion de la instancia (momento de la copia profunda desde la ' +
      'plantilla — CA-023-1)',
    example: '2026-08-22T09:00:00.000Z',
  })
  createdAt: Date;
}
