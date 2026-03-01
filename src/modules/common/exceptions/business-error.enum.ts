import { HttpStatus } from '@nestjs/common';
import { ErrorCatalogEntry } from './error-catalog.interface.js';

/**
 * Catálogo de errores de negocio de Fitmess.
 *
 * Convenciones:
 * - code: UPPER_SNAKE_CASE, prefijo del dominio (PLAN_, EXERCISE_, SUBSCRIPTION_, etc.)
 * - title: Estable, no cambia entre ocurrencias del mismo error
 * - httpStatus: El código HTTP por defecto para este tipo de error
 *
 * El "detail" NO va aquí — es específico de cada ocurrencia y se pasa en el constructor.
 *
 * Criterio de status:
 * - 403 SOLO para AUTORIZACIÓN (el usuario no tiene permiso sobre el recurso)
 * - 409 para CONFLICTOS DE ESTADO del recurso (ya existe, transición inválida, inmutable)
 * - 422 para datos que violan REGLAS DE NEGOCIO (la operación no puede procesarse)
 */
export const BusinessError = {
  // ── Entidades ──────────────────────────────────────────────────────
  ENTITY_NOT_FOUND: {
    code: 'ENTITY_NOT_FOUND',
    title: 'Recurso no encontrado',
    httpStatus: HttpStatus.NOT_FOUND, // 404
  },

  DUPLICATE_ENTITY: {
    code: 'DUPLICATE_ENTITY',
    title: 'El recurso ya existe',
    httpStatus: HttpStatus.CONFLICT, // 409
  },

  // ── State Machine ─────────────────────────────────────────────────
  INVALID_STATE_TRANSITION: {
    code: 'INVALID_STATE_TRANSITION',
    title: 'Transición de estado no permitida',
    httpStatus: HttpStatus.CONFLICT, // 409
  },

  // ── Planes ────────────────────────────────────────────────────────
  PLAN_INCOMPLETE: {
    code: 'PLAN_INCOMPLETE',
    title: 'Plan incompleto',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  },

  PLAN_HAS_SUBSCRIBERS: {
    code: 'PLAN_HAS_SUBSCRIBERS',
    title: 'El plan tiene suscriptores activos',
    httpStatus: HttpStatus.CONFLICT, // 409
  },

  PLAN_IMMUTABLE: {
    code: 'PLAN_IMMUTABLE',
    title: 'El plan no permite modificaciones',
    httpStatus: HttpStatus.CONFLICT, // 409 — conflicto de estado, no de permisos
  },

  // ── Ejercicios ────────────────────────────────────────────────────
  EXERCISE_IN_USE: {
    code: 'EXERCISE_IN_USE',
    title: 'El ejercicio está en uso',
    httpStatus: HttpStatus.CONFLICT, // 409
  },

  EXERCISE_INACTIVE: {
    code: 'EXERCISE_INACTIVE',
    title: 'El ejercicio está inhabilitado',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  },

  // ── Suscripciones ─────────────────────────────────────────────────
  SUBSCRIPTION_ALREADY_EXISTS: {
    code: 'SUBSCRIPTION_ALREADY_EXISTS',
    title: 'Ya existe una suscripción para este atleta y plan',
    httpStatus: HttpStatus.CONFLICT, // 409
  },

  CONSENT_REQUIRED: {
    code: 'CONSENT_REQUIRED',
    title: 'Consentimiento informado requerido',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  },

  // ── Ejecución / Resultados ────────────────────────────────────────
  WEEK_FROZEN: {
    code: 'WEEK_FROZEN',
    title: 'La semana está cerrada',
    httpStatus: HttpStatus.CONFLICT, // 409 — conflicto de estado de la semana
  },

  WEEK_STARTED: {
    code: 'WEEK_STARTED',
    title: 'La semana ya fue iniciada por el atleta',
    httpStatus: HttpStatus.CONFLICT, // 409 — conflicto de estado de la semana
  },

  EDIT_WINDOW_EXPIRED: {
    code: 'EDIT_WINDOW_EXPIRED',
    title: 'Ventana de edición expirada',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422 — la regla de negocio no permite editar
  },

  RESULT_FIELDS_INVALID: {
    code: 'RESULT_FIELDS_INVALID',
    title: 'Campos de resultado no válidos para el tipo de sesión',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  },

  // ── Autorización de recurso ───────────────────────────────────────
  RESOURCE_OWNERSHIP_DENIED: {
    code: 'RESOURCE_OWNERSHIP_DENIED',
    title: 'No tiene acceso a este recurso',
    httpStatus: HttpStatus.FORBIDDEN, // 403 — autorización (el usuario no es dueño)
  },

  // ── IA ────────────────────────────────────────────────────────────
  AI_ANALYSIS_NOT_AVAILABLE: {
    code: 'AI_ANALYSIS_NOT_AVAILABLE',
    title: 'Análisis de IA no disponible',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  },

  AI_WEEK_NOT_CLOSED: {
    code: 'AI_WEEK_NOT_CLOSED',
    title: 'La semana debe estar cerrada para solicitar análisis',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  },

  // ── Legal ─────────────────────────────────────────────────────────
  LEGAL_ACCEPTANCE_IMMUTABLE: {
    code: 'LEGAL_ACCEPTANCE_IMMUTABLE',
    title: 'Las aceptaciones legales no pueden modificarse',
    httpStatus: HttpStatus.CONFLICT, // 409 — conflicto de estado inmutable
  },

  // ── Auth ──────────────────────────────────────────────────────────
  COACH_NOT_APPROVED: {
    code: 'COACH_NOT_APPROVED',
    title: 'El entrenador aún no ha sido aprobado',
    httpStatus: HttpStatus.FORBIDDEN, // 403 — autorización (estado de cuenta)
  },

  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    title: 'Credenciales inválidas',
    httpStatus: HttpStatus.UNAUTHORIZED, // 401
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

// Tipo derivado para autocompletado
export type BusinessError = (typeof BusinessError)[keyof typeof BusinessError];
