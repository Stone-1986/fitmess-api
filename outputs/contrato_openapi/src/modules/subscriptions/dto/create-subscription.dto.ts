import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO de entrada para HU-012: Solicitud de inscripcion de un atleta a un plan.
 *
 * El atleta solicitante se toma del usuario autenticado (@CurrentUser), NUNCA
 * del body — el unico dato que el cliente envia es el plan al que se inscribe.
 */
export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'UUID del plan al que el atleta autenticado solicita inscribirse',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'planId debe ser un UUID valido' })
  @IsNotEmpty({ message: 'planId es obligatorio' })
  planId: string;
}
