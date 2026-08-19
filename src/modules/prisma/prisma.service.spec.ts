import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaService } from './prisma.service.js';

/**
 * Estaba en 0% (hallazgo abierto #2b). Lo que se verifica aquí es el contrato
 * de ciclo de vida con NestJS: que la conexión se abra al arrancar el módulo y
 * se cierre al destruirlo. Si `onModuleDestroy` dejara de cerrar, el síntoma no
 * sería un test rojo sino conexiones filtradas contra el pooler — que es
 * exactamente el error que tumbó la suite e2e al agregar la auditoría
 * (EMAXCONNSESSION, pool_size 15).
 *
 * No se abre una conexión real: se espían los métodos heredados de PrismaClient.
 */
describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    // El constructor arma el PrismaPg adapter con DATABASE_URL, sin conectar.
    process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
    service = new PrismaService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('es un PrismaClient — expone los modelos del schema', () => {
    expect(service.user).toBeDefined();
    expect(service.exercise).toBeDefined();
    expect(service.auditLog).toBeDefined();
  });

  it('abre la conexión en onModuleInit', async () => {
    const connect = vi
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as never);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('cierra la conexión en onModuleDestroy', async () => {
    const disconnect = vi
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined as never);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('propaga el fallo si la conexión inicial no se puede establecer', async () => {
    vi.spyOn(service, '$connect').mockRejectedValue(
      new Error("Can't reach database server") as never,
    );

    // Debe propagarse: si el arranque no puede hablar con la base, la app no
    // debe quedar en pie fingiendo que está sana.
    await expect(service.onModuleInit()).rejects.toThrow(
      "Can't reach database server",
    );
  });
});
