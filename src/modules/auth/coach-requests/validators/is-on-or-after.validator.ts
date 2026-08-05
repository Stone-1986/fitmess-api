import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Valida que la fecha del campo decorado no sea anterior a la del campo indicado.
 *
 * Se usa en rangos de fechas (createdAtFrom / createdAtTo). Un rango invertido es
 * un error del cliente, no una busqueda legitima sin resultados — por eso responde
 * 400 en vez de retornar una lista vacia que el usuario interpretaria como
 * "no hay solicitudes en esas fechas".
 *
 * Si alguno de los dos campos esta ausente no valida nada: ambos extremos del
 * rango son opcionales de forma independiente.
 *
 * La comparacion es lexicografica y solo es correcta porque ambos campos estan
 * restringidos al formato YYYY-MM-DD (ancho fijo, componentes de mayor a menor
 * significancia). No usar este validador sobre fechas de formato libre.
 */
export function IsOnOrAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isOnOrAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];

          // Sin ambos extremos no hay rango que validar
          if (typeof value !== 'string' || typeof relatedValue !== 'string') {
            return true;
          }

          return value >= relatedValue;
        },
      },
    });
  };
}
