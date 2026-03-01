# Error Catalogs — Implementacion completa

Referencia de implementacion para las clases de excepcion y los catalogos de errores de negocio y tecnicos.

---

## Clases de excepcion

```typescript
// src/modules/common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  public readonly errorEntry: BusinessError;
  public readonly detail: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    error: BusinessError,
    detail: string,
    context?: Record<string, unknown>,
  ) {
    super({ errorCode: error.code, title: error.title, detail, context }, error.httpStatus);
    this.errorEntry = error;
    this.detail = detail;
    this.context = context;
  }
}

// src/modules/common/exceptions/technical.exception.ts
export class TechnicalException extends HttpException {
  public readonly errorEntry: TechnicalError;
  public readonly detail: string;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    error: TechnicalError,
    detail: string,
    context?: Record<string, unknown>,
    originalError?: Error, // Se loggea internamente, NUNCA se expone al cliente
  ) {
    super({ errorCode: error.code, title: error.title, detail, context }, error.httpStatus);
    this.errorEntry = error;
    this.detail = detail;
    this.context = context;
    this.originalError = originalError;
  }
}
```

---

## Catalogo de errores de negocio (BusinessError)

```typescript
// src/modules/common/exceptions/business-error.enum.ts
export const BusinessError = {

  // -- Entidades
  ENTITY_NOT_FOUND:              { code: 'ENTITY_NOT_FOUND',              title: 'Recurso no encontrado',                              httpStatus: 404 },
  DUPLICATE_ENTITY:              { code: 'DUPLICATE_ENTITY',              title: 'El recurso ya existe',                               httpStatus: 409 },

  // -- State Machine
  INVALID_STATE_TRANSITION:      { code: 'INVALID_STATE_TRANSITION',      title: 'Transicion de estado no permitida',                  httpStatus: 409 },

  // -- Planes
  PLAN_INCOMPLETE:               { code: 'PLAN_INCOMPLETE',               title: 'Plan incompleto',                                    httpStatus: 422 },
  PLAN_HAS_SUBSCRIBERS:          { code: 'PLAN_HAS_SUBSCRIBERS',          title: 'El plan tiene suscriptores activos',                 httpStatus: 409 },
  PLAN_IMMUTABLE:                { code: 'PLAN_IMMUTABLE',                title: 'El plan no permite modificaciones',                  httpStatus: 403 },

  // -- Ejercicios
  EXERCISE_IN_USE:               { code: 'EXERCISE_IN_USE',               title: 'El ejercicio esta en uso',                          httpStatus: 409 },
  EXERCISE_INACTIVE:             { code: 'EXERCISE_INACTIVE',             title: 'El ejercicio esta inhabilitado',                    httpStatus: 422 },

  // -- Suscripciones
  SUBSCRIPTION_ALREADY_EXISTS:   { code: 'SUBSCRIPTION_ALREADY_EXISTS',   title: 'Ya existe una suscripcion para este atleta y plan', httpStatus: 409 },
  CONSENT_REQUIRED:              { code: 'CONSENT_REQUIRED',              title: 'Consentimiento informado requerido',                httpStatus: 422 },

  // -- Ejecucion / Resultados
  WEEK_FROZEN:                   { code: 'WEEK_FROZEN',                   title: 'La semana esta cerrada',                            httpStatus: 403 },
  WEEK_STARTED:                  { code: 'WEEK_STARTED',                  title: 'La semana ya fue iniciada por el atleta',           httpStatus: 403 },
  EDIT_WINDOW_EXPIRED:           { code: 'EDIT_WINDOW_EXPIRED',           title: 'Ventana de edicion expirada',                       httpStatus: 403 },
  RESULT_FIELDS_INVALID:         { code: 'RESULT_FIELDS_INVALID',         title: 'Campos de resultado no validos para el tipo de sesion', httpStatus: 422 },

  // -- Autorizacion
  RESOURCE_OWNERSHIP_DENIED:     { code: 'RESOURCE_OWNERSHIP_DENIED',     title: 'No tiene acceso a este recurso',                    httpStatus: 403 },

  // -- IA
  AI_ANALYSIS_NOT_AVAILABLE:     { code: 'AI_ANALYSIS_NOT_AVAILABLE',     title: 'Analisis de IA no disponible',                      httpStatus: 422 },
  AI_WEEK_NOT_CLOSED:            { code: 'AI_WEEK_NOT_CLOSED',            title: 'La semana debe estar cerrada para solicitar analisis', httpStatus: 422 },

  // -- Legal
  LEGAL_ACCEPTANCE_IMMUTABLE:    { code: 'LEGAL_ACCEPTANCE_IMMUTABLE',    title: 'Las aceptaciones legales no pueden modificarse',    httpStatus: 403 },

  // -- Auth
  COACH_NOT_APPROVED:            { code: 'COACH_NOT_APPROVED',            title: 'El entrenador aun no ha sido aprobado',             httpStatus: 403 },
  INVALID_CREDENTIALS:           { code: 'INVALID_CREDENTIALS',           title: 'Credenciales invalidas',                            httpStatus: 401 },
  TOKEN_EXPIRED:                 { code: 'TOKEN_EXPIRED',                 title: 'Token de autenticacion expirado',                   httpStatus: 401 },
  TOKEN_INVALID:                 { code: 'TOKEN_INVALID',                 title: 'Token de autenticacion invalido',                   httpStatus: 401 },
  TOKEN_REFRESH_FAILED:          { code: 'TOKEN_REFRESH_FAILED',          title: 'Error al refrescar el token',                       httpStatus: 401 },

  // -- Generico
  INTERNAL_ERROR:                { code: 'INTERNAL_ERROR',                title: 'Error interno del servidor',                        httpStatus: 500 },

} as const satisfies Record<string, ErrorCatalogEntry>;

export type BusinessError = (typeof BusinessError)[keyof typeof BusinessError];
```

---

## Catalogo de errores tecnicos (TechnicalError)

```typescript
// src/modules/common/exceptions/technical-error.enum.ts
export const TechnicalError = {

  // -- Base de datos
  DATABASE_ERROR:                 { code: 'DATABASE_ERROR',                title: 'Error de base de datos',                           httpStatus: 500 },
  DATABASE_CONSTRAINT_VIOLATION:  { code: 'DATABASE_CONSTRAINT_VIOLATION', title: 'Violacion de constraint en base de datos',         httpStatus: 409 },
  DATABASE_CONNECTION_ERROR:      { code: 'DATABASE_CONNECTION_ERROR',     title: 'Error de conexion a base de datos',                httpStatus: 503 },
  DATABASE_INVALID_DATA:          { code: 'DATABASE_INVALID_DATA',         title: 'Datos invalidos para la base de datos',            httpStatus: 422 },
  DATABASE_FK_VIOLATION:          { code: 'DATABASE_FK_VIOLATION',         title: 'Violacion de llave foranea',                       httpStatus: 422 },

  // -- Servicios externos
  EXTERNAL_SERVICE_ERROR:         { code: 'EXTERNAL_SERVICE_ERROR',        title: 'Error en servicio externo',                        httpStatus: 502 },
  EXTERNAL_SERVICE_TIMEOUT:       { code: 'EXTERNAL_SERVICE_TIMEOUT',      title: 'Timeout en servicio externo',                      httpStatus: 504 },
  AI_SERVICE_ERROR:               { code: 'AI_SERVICE_ERROR',              title: 'Error en servicio de inteligencia artificial',     httpStatus: 502 },
  AI_SERVICE_TIMEOUT:             { code: 'AI_SERVICE_TIMEOUT',            title: 'Timeout en servicio de inteligencia artificial',   httpStatus: 504 },
  AI_RESPONSE_MALFORMED:          { code: 'AI_RESPONSE_MALFORMED',         title: 'Respuesta malformada del servicio de IA',          httpStatus: 502 },

} as const satisfies Record<string, ErrorCatalogEntry>;

export type TechnicalError = (typeof TechnicalError)[keyof typeof TechnicalError];
```
