import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateSync } from 'class-validator';
import { IsLegalAgeBirthDate } from './is-legal-age-birth-date.validator.js';

/**
 * Clase minima de prueba: ejercita el decorador por la misma via que lo ejercita
 * el ValidationPipe, no la funcion interna. Si el registro del decorador se rompe,
 * estos tests fallan.
 */
class Fixture {
  @IsLegalAgeBirthDate()
  dateOfBirth: unknown;

  constructor(dateOfBirth: unknown) {
    this.dateOfBirth = dateOfBirth;
  }
}

function validate(value: unknown): { ok: boolean; message: string } {
  const errors = validateSync(new Fixture(value));

  if (errors.length === 0) {
    return { ok: true, message: '' };
  }

  return {
    ok: false,
    message: Object.values(errors[0].constraints ?? {})[0] ?? '',
  };
}

describe('IsLegalAgeBirthDate', () => {
  // El reloj se congela porque toda la logica se compara contra "hoy": sin esto
  // los tests de limite (cumple hoy / cumple manana) dejarian de valer con el tiempo.
  // 2026-08-05 a las 15:00 UTC = 10:00 en Colombia, mismo dia calendario.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formato', () => {
    it('rechaza un valor ausente', () => {
      const result = validate(undefined);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('obligatoria');
    });

    it('rechaza una cadena vacia', () => {
      expect(validate('').ok).toBe(false);
    });

    it('rechaza un valor que no es cadena', () => {
      expect(validate(19980101).ok).toBe(false);
    });

    it('rechaza formato distinto de YYYY-MM-DD', () => {
      const result = validate('22/11/1998');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('YYYY-MM-DD');
    });

    it('rechaza ISO 8601 con hora — el service persiste el valor tal cual y el instante variaria por zona', () => {
      expect(validate('1998-11-22T00:00:00.000Z').ok).toBe(false);
    });

    it('rechaza una fecha que cumple el formato pero no existe', () => {
      const result = validate('2000-02-31');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('fecha real');
    });

    it('rechaza un mes fuera de rango', () => {
      expect(validate('2000-13-01').ok).toBe(false);
    });

    it('acepta el 29 de febrero de un ano bisiesto', () => {
      expect(validate('2000-02-29').ok).toBe(true);
    });
  });

  describe('fecha futura', () => {
    it('rechaza el caso reportado: fecha posterior a hoy', () => {
      const result = validate('2026-11-22');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('futuro');
    });

    it('rechaza el dia de manana', () => {
      expect(validate('2026-08-06').ok).toBe(false);
    });

    it('rechaza hoy mismo — un recien nacido no se registra', () => {
      const result = validate('2026-08-05');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('18');
    });
  });

  describe('mayoria de edad', () => {
    it('acepta a quien cumple 18 exactamente hoy', () => {
      expect(validate('2008-08-05').ok).toBe(true);
    });

    it('rechaza a quien cumple 18 manana', () => {
      const result = validate('2008-08-06');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('18 anos cumplidos');
    });

    it('acepta a quien cumplio 18 ayer', () => {
      expect(validate('2008-08-04').ok).toBe(true);
    });

    it('rechaza a un menor de 11 anos', () => {
      expect(validate('2015-01-01').ok).toBe(false);
    });

    it('acepta a un adulto sin ambiguedad', () => {
      expect(validate('1990-01-01').ok).toBe(true);
    });

    it('cuenta anos cumplidos, no anos transcurridos, cuando el cumpleanos cae despues en el ano', () => {
      // Nacido en diciembre de 2008: en agosto de 2026 todavia tiene 17.
      expect(validate('2008-12-31').ok).toBe(false);
    });
  });

  describe('tope de 120 anos', () => {
    it('acepta exactamente 120 anos cumplidos', () => {
      expect(validate('1906-08-05').ok).toBe(true);
    });

    it('rechaza 121 anos', () => {
      const result = validate('1905-08-04');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('120');
    });

    it('rechaza una fecha absurda del siglo XIX', () => {
      expect(validate('1800-01-01').ok).toBe(false);
    });
  });

  describe('dia calendario colombiano', () => {
    it('usa el dia en Colombia, no el dia UTC, cerca de la medianoche', () => {
      // 2026-08-06 00:30 UTC = 2026-08-05 19:30 en Colombia.
      // Quien cumple 18 el 6 de agosto todavia no los tiene en hora local.
      vi.setSystemTime(new Date('2026-08-06T00:30:00.000Z'));

      expect(validate('2008-08-06').ok).toBe(false);
      expect(validate('2008-08-05').ok).toBe(true);
    });
  });
});
