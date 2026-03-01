---
name: testing-patterns
description: Patrones de testing para fitmess-api. Cargar al escribir o revisar tests unitarios, tests e2e, mocks de Prisma o validar cobertura. Cubre Vitest, @nestjs/testing, estructura de specs, targets de cobertura 80%/70% y mocks de PrismaService.
---

# Testing Patterns — fitmess-api

**Framework:** Vitest · **Integracion NestJS:** `@nestjs/testing` · **E2E:** supertest

> Los targets de cobertura son un gate duro definido en `.claude/rules/rulesArquitectura.md`. Este skill explica como alcanzarlos.

---

## 1. Targets de cobertura (gate duro)

| Capa | Target | Que cubre |
|---|---|---|
| Dominio / logica de negocio | **80%** | Services, state machine, reglas de negocio |
| Adaptadores | **70%** | Controllers, guards, listeners, filters |

Si la cobertura no se alcanza el flujo de implementacion se bloquea y regresa al QA.

---

## 2. Configuracion Vitest

Ambas configs usan `globals: true` — `vi`, `describe`, `it`, `expect`, `beforeEach`, `afterEach` estan disponibles sin import.

```
vitest.config.ts      → root: './src',  include: ['**/*.spec.ts']      ← Unit tests
vitest.config.e2e.ts  → root: './test', include: ['**/*.e2e-spec.ts']  ← E2e tests
```

Ambas usan `unplugin-swc` para compilacion rapida de TypeScript.

---

## 3. Estructura de archivos

```
src/modules/[module-name]/
  [module-name].service.spec.ts     <- Tests unitarios del service (dominio)
  [module-name].controller.spec.ts  <- Tests unitarios del controller (adaptador)

test/
  [module-name].e2e-spec.ts         <- Tests e2e con supertest
```

---

## 4. Convenciones

### Nombrado — patron AAA (Arrange / Act / Assert)

```typescript
it('[metodo] [condicion] → [resultado esperado]', async () => {
  // Arrange — preparar datos y mocks
  // Act — ejecutar el metodo bajo prueba
  // Assert — verificar el resultado
});
```

### Agrupacion con describe anidado

```typescript
describe('PlansService', () => {
  describe('publish()', () => {
    it('publica correctamente desde DRAFT', ...);
    it('lanza BusinessException INVALID_STATE_TRANSITION si no esta en DRAFT', ...);
    it('lanza BusinessException ENTITY_NOT_FOUND si el plan no existe', ...);
  });
});
```

### Que testear en cada capa

| Capa | Que testear |
|---|---|
| Service | Cada rama de logica, cada validacion de estado, cada excepcion lanzada, que los eventos se emiten |
| Controller | Que delega al service con los parametros correctos, que retorna el resultado sin modificarlo |
| Filter | Que `Content-Type` es `application/problem+json`, que `errorCode` y `status` son correctos |
| Guard | Que permite acceso cuando la condicion se cumple, que lanza la excepcion correcta cuando no |
| Listener | Que llama al servicio correcto, que loggea el error y NO relanza si el service falla |

### Mocks

- Usar `vi.fn()` de Vitest, nunca `jest.fn()`
- Limpiar con `vi.clearAllMocks()` en `afterEach`
- Nunca mockear el modulo completo de Prisma — mockear solo los metodos que usa el service bajo prueba
- Para datos de prueba: usar UUIDs literales (`'plan-uuid'`, `'coach-uuid'`) no generados dinamicamente

---

## 5. Ejemplos de test por capa

Implementaciones completas para service, controller, filter, guard, listener y e2e en [references/test-examples.md](references/test-examples.md).

---

## 6. Tests e2e — consideraciones

- El e2e usa `AppModule` real con DB de test — requiere seeding previo y cleanup posterior
- Replicar la configuracion exacta de `main.ts` (ValidationPipe, filters) en el setup del test
- Obtener auth token via endpoint `/auth/login` con credenciales de seed
- Verificar tanto el happy path (201, 200) como los error paths (400, 401, 404, 409)
- Verificar que las respuestas de error usan `application/problem+json`
