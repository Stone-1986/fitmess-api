import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchCoachRequestsDto } from './search-coach-requests.dto.js';

/**
 * Valida los filtros de rango de fechas de HU-002.
 *
 * El resto de filtros se cubre indirectamente en coach-requests.service.spec.ts;
 * aqui se prueba solo lo que vive en el DTO: formato de fecha y coherencia del rango.
 */
describe('SearchCoachRequestsDto — rango de fechas', () => {
  /** Valida el DTO y retorna las propiedades que fallaron. */
  async function propiedadesInvalidas(
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    const dto = plainToInstance(SearchCoachRequestsDto, payload);
    const errores = await validate(dto);
    return errores.map((e) => e.property);
  }

  it('acepta un body vacio — ambos extremos son opcionales', async () => {
    expect(await propiedadesInvalidas({})).toEqual([]);
  });

  it('acepta solo createdAtFrom', async () => {
    expect(await propiedadesInvalidas({ createdAtFrom: '2026-03-01' })).toEqual(
      [],
    );
  });

  it('acepta solo createdAtTo', async () => {
    expect(await propiedadesInvalidas({ createdAtTo: '2026-03-31' })).toEqual(
      [],
    );
  });

  it('acepta un rango valido', async () => {
    expect(
      await propiedadesInvalidas({
        createdAtFrom: '2026-03-01',
        createdAtTo: '2026-03-31',
      }),
    ).toEqual([]);
  });

  it('acepta el mismo valor en ambos extremos — busqueda de un solo dia', async () => {
    expect(
      await propiedadesInvalidas({
        createdAtFrom: '2026-03-02',
        createdAtTo: '2026-03-02',
      }),
    ).toEqual([]);
  });

  it('rechaza un rango invertido en vez de retornar lista vacia', async () => {
    expect(
      await propiedadesInvalidas({
        createdAtFrom: '2026-03-31',
        createdAtTo: '2026-03-01',
      }),
    ).toContain('createdAtTo');
  });

  it('rechaza un datetime completo — el service compone la hora sobre el valor', async () => {
    expect(
      await propiedadesInvalidas({ createdAtFrom: '2026-03-01T10:00:00Z' }),
    ).toContain('createdAtFrom');
  });

  it('rechaza una fecha inexistente en el calendario', async () => {
    expect(await propiedadesInvalidas({ createdAtTo: '2026-02-30' })).toContain(
      'createdAtTo',
    );
  });

  it('rechaza un formato de fecha distinto a YYYY-MM-DD', async () => {
    expect(
      await propiedadesInvalidas({ createdAtFrom: '01/03/2026' }),
    ).toContain('createdAtFrom');
  });
});
