import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * DTO de entrada para HU-016: registrar o editar las sensaciones semanales
 * de una semana de la instancia propia del atleta (upsert — D-6b).
 *
 * Escala RESUELTA por decision del humano (D-6, ya NO placeholder): enteros
 * de 1 a 10, ambos inclusive. Un valor fuera de rango se rechaza con 400 —
 * validacion ESTRUCTURAL atrapada por el ValidationPipe GLOBAL antes de que
 * el controller o el service se ejecuten (CA-016-9), no un 422 de regla de
 * negocio. Por eso el rechazo es ATOMICO: si cualquiera de los dos campos
 * esta fuera de rango, el ValidationPipe rechaza el body COMPLETO antes de
 * que exista ninguna escritura — no se guarda ningun registro de
 * sensaciones de esa semana, ni siquiera el indicador que si estaba en rango.
 *
 * SUP-05 cerrado: exactamente estos dos indicadores, sin esquema extensible.
 *
 * DATO SENSIBLE DE SALUD (Ley 1581/2012) — nunca se loggea el valor de
 * ninguno de estos dos campos, ni siquiera en nivel debug.
 */
export class RegisterWeeklyFeelingDto {
  @ApiProperty({
    description:
      'Nivel de dolor muscular percibido, entero de 1 (ninguno) a 10 (severo), ambos ' +
      'inclusive (RN-21, CA-016-9). Fuera de rango: 400, y no se guarda ningun registro ' +
      'de sensaciones de esa semana.',
    example: 4,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({ message: 'muscleSoreness debe ser un numero entero' })
  @Min(1, { message: 'muscleSoreness debe estar entre 1 y 10' })
  @Max(10, { message: 'muscleSoreness debe estar entre 1 y 10' })
  muscleSoreness: number;

  @ApiProperty({
    description:
      'Nivel de motivacion percibido, entero de 1 (muy baja) a 10 (muy alta), ambos ' +
      'inclusive (RN-21, CA-016-9). Fuera de rango: 400, y no se guarda ningun registro ' +
      'de sensaciones de esa semana.',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({ message: 'motivation debe ser un numero entero' })
  @Min(1, { message: 'motivation debe estar entre 1 y 10' })
  @Max(10, { message: 'motivation debe estar entre 1 y 10' })
  motivation: number;
}
