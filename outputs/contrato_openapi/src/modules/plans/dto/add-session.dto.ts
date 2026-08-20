import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO de entrada para HU-008: Agregar una sesion a una semana.
 *
 * Solo recibe `name` — `order` se calcula server-side como el maximo order
 * existente en la semana + 1 (decision D-5), mismo criterio que AddPhaseDto.
 *
 * Rechazada por PlanPublishedGuard (409) si el plan no esta en Borrador.
 */
export class AddSessionDto {
  @ApiProperty({
    description: 'Nombre de la sesion dentro de la semana',
    example: 'Dia 1 — Tren inferior (fuerza)',
    minLength: 2,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la sesion es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;
}
