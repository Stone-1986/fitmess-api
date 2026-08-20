import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO de entrada para HU-008: Agregar una fase a un plan.
 *
 * Solo recibe `name` — `order` se calcula server-side como el maximo order
 * existente en el plan + 1 (decision D-5): ninguna CA pide reordenar fases,
 * asi que forzar al cliente a calcularlo y enviarlo es superficie de error
 * sin beneficio funcional en esta epica.
 *
 * Rechazada por PlanPublishedGuard (409) si el plan no esta en Borrador —
 * una fase nueva es estructura, inmutable tras publicar (RN-31).
 */
export class AddPhaseDto {
  @ApiProperty({
    description: 'Nombre de la fase dentro del plan',
    example: 'Fase 1 — Adaptacion anatomica',
    minLength: 2,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la fase es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;
}
