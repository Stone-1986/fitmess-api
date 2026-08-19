import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './test',
    include: ['**/*.e2e-spec.ts'],
    // Los archivos e2e corren de a uno, NO en paralelo.
    //
    // Cada spec levanta su propia instancia de AppModule con su propio pool de
    // Prisma. En paralelo, tres specs abren tres pools contra el mismo pooler de
    // Supabase, que en modo sesion admite 15 clientes:
    //   DriverAdapterError: (EMAXCONNSESSION) max clients reached in session mode
    // El sintoma es enganoso — llega como 500 en un endpoint cualquiera, como si
    // el codigo estuviera roto, cuando lo que se agoto son las conexiones.
    //
    // Ademas comparten el estado de las tablas: correr en paralelo hace que una
    // suite vea filas creadas por otra.
    fileParallelism: false,
  },
  plugins: [swc.vite()],
});
