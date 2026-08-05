import { registerDecorator, ValidationArguments } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

/**
 * Edad minima para registrarse en la plataforma.
 *
 * Un menor de edad no tiene capacidad legal para obligarse por si mismo
 * (Codigo Civil art. 1502-1504), asi que su aceptacion de los Terminos y
 * Condiciones seria ineficaz. El tratamiento de datos de menores ademas exige
 * autorizacion del representante legal y un tratamiento diferenciado
 * (Ley 1581/2012 art. 7, Decreto 1377/2013 art. 12) que la plataforma no
 * implementa hoy — por eso se bloquea el registro en vez de permitirlo a medias.
 */
const MIN_AGE_YEARS = 18;

/**
 * Tope superior de edad. No es una regla de negocio sino un filtro de datos
 * absurdos: una fecha de 1800 es un error de digitacion o un intento de abuso,
 * no una persona.
 */
const MAX_AGE_YEARS = 120;

/**
 * Colombia (UTC-5) no observa horario de verano, asi que el offset es fijo.
 *
 * La edad se calcula contra el dia calendario colombiano, no contra el dia UTC:
 * entre las 19:00 y las 23:59 hora local, UTC ya esta en el dia siguiente y
 * alguien que cumple 18 manana seria aceptado hoy. Mismo criterio que el filtro
 * de fechas de coach-requests.
 */
const COLOMBIA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Parsea YYYY-MM-DD y descarta fechas que cumplen el formato pero no existen
 * (2026-02-31, 2026-13-01). El round-trip por Date.UTC es lo que las detecta:
 * el constructor normaliza 02-31 a 03-03, asi que los componentes ya no coinciden.
 *
 * El formato se restringe a fecha sin hora a proposito: el service persiste el
 * valor con `new Date(...)` y una cadena con hora y offset se guardaria como un
 * instante distinto segun la zona del cliente.
 */
function parseCalendarDate(value: string): CalendarDate | null {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));

  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/** Dia calendario actual en Colombia. */
function todayInColombia(): CalendarDate {
  const colombiaNow = new Date(Date.now() - COLOMBIA_UTC_OFFSET_MS);

  return {
    year: colombiaNow.getUTCFullYear(),
    month: colombiaNow.getUTCMonth() + 1,
    day: colombiaNow.getUTCDate(),
  };
}

/** Negativo si `a` es anterior a `b`, positivo si es posterior, 0 si son el mismo dia. */
function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Anos cumplidos, no anos transcurridos: quien cumple manana todavia no los tiene.
 *
 * Nacidos un 29 de febrero cumplen el 1 de marzo en los anos no bisiestos, que es
 * la lectura habitual en derecho civil (el ultimo dia del mes cuando el dia no existe
 * se interpreta como el dia siguiente al mes completo).
 */
function completedYears(birth: CalendarDate, today: CalendarDate): number {
  const years = today.year - birth.year;
  const birthdayHasPassed =
    today.month > birth.month ||
    (today.month === birth.month && today.day >= birth.day);

  return birthdayHasPassed ? years : years - 1;
}

interface EvaluationResult {
  ok: boolean;
  message: string;
}

/**
 * Evalua la fecha y devuelve el motivo exacto del rechazo.
 *
 * Se separa del decorador para que `defaultMessage` pueda reportar por que fallo
 * en vez de un mensaje generico: "no puede estar en el futuro" y "debes ser mayor
 * de edad" son errores distintos para quien consume la API.
 */
export function evaluateBirthDate(value: unknown): EvaluationResult {
  if (typeof value !== 'string' || value.length === 0) {
    return {
      ok: false,
      message:
        'La fecha de nacimiento es obligatoria y debe estar en formato YYYY-MM-DD',
    };
  }

  const birth = parseCalendarDate(value);

  if (birth === null) {
    return {
      ok: false,
      message:
        'La fecha de nacimiento debe ser una fecha real en formato YYYY-MM-DD',
    };
  }

  const today = todayInColombia();

  if (compareCalendarDates(birth, today) > 0) {
    return {
      ok: false,
      message: 'La fecha de nacimiento no puede estar en el futuro',
    };
  }

  const age = completedYears(birth, today);

  if (age > MAX_AGE_YEARS) {
    return {
      ok: false,
      message: `La fecha de nacimiento no es valida: supera los ${MAX_AGE_YEARS} anos`,
    };
  }

  if (age < MIN_AGE_YEARS) {
    return {
      ok: false,
      message: `Debes tener al menos ${MIN_AGE_YEARS} anos cumplidos para registrarte en la plataforma`,
    };
  }

  return { ok: true, message: '' };
}

/**
 * Valida que el campo sea una fecha de nacimiento de una persona mayor de edad.
 *
 * Cubre en un solo decorador el formato, la existencia real de la fecha, que no
 * sea futura, el tope de 120 anos y la mayoria de edad. Van juntos porque son la
 * misma pregunta ("¿esta fecha corresponde a una persona que puede registrarse?")
 * y separarlos produciria varios errores simultaneos sobre el mismo campo.
 *
 * Aplica igual a atletas, entrenadores y administradores.
 */
export function IsLegalAgeBirthDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isLegalAgeBirthDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return evaluateBirthDate(value).ok;
        },
        defaultMessage(args: ValidationArguments): string {
          return evaluateBirthDate(args.value).message;
        },
      },
    });
  };
}
