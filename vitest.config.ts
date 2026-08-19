import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        // perFile: cada archivo debe alcanzar el umbral por si solo, no el
        // promedio del proyecto. `rulesArquitectura § Testing` siempre se
        // redacto asi ("cobertura minima de dominio 80%, adaptadores 70%"),
        // pero la herramienta medía el agregado — regla y gate decian cosas
        // distintas (hallazgo abierto #2b).
        //
        // Con el agregado, un archivo nuevo sin un solo test pasaba el gate
        // escondido detras del promedio. Asi fue como `response.interceptor.ts`
        // sobrevivio dos epicas en 0% con un bug adentro: envolvia TODAS las
        // respuestas de la API y nadie lo noto hasta que EPICA-02 estreno el
        // patron `{ data: null, message }`.
        perFile: true,
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      // IMPORTANTE: estos patrones se resuelven relativos a `root` (./src), NO a la
      // raiz del proyecto. Prefijarlos con `src/` produce `src/src/**` — un patron
      // que no coincide con nada, dejando la cobertura medida solo sobre los archivos
      // que algun test carga por casualidad. Ese bug reportaba 94% sobre 19 archivos
      // cuando el real era 71% sobre 36.
      include: ['**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.dto.ts', // declarativos: decoradores de validacion, sin logica propia
        '**/*.module.ts', // wiring de DI
        '**/index.ts', // barriles: solo re-exports
        '**/*.interface.ts', // solo tipos, no compilan a codigo ejecutable
        'main.ts',
        'coverage/**',
      ],
    },
  },
  plugins: [swc.vite()],
});
