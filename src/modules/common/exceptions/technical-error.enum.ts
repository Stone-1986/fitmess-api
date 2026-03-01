import { HttpStatus } from '@nestjs/common';
import { ErrorCatalogEntry } from './error-catalog.interface.js';

export const TechnicalError = {
  // ── Base de datos ─────────────────────────────────────────────────
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    title: 'Error de base de datos',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR, // 500
  },

  DATABASE_CONSTRAINT_VIOLATION: {
    code: 'DATABASE_CONSTRAINT_VIOLATION',
    title: 'Violación de constraint en base de datos',
    httpStatus: HttpStatus.CONFLICT, // 409
  },

  DATABASE_CONNECTION_ERROR: {
    code: 'DATABASE_CONNECTION_ERROR',
    title: 'Error de conexión a base de datos',
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE, // 503
  },

  // Errores de Prisma mapeados — usados por PrismaExceptionFilter
  DATABASE_INVALID_DATA: {
    code: 'DATABASE_INVALID_DATA',
    title: 'Datos inválidos para la operación',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422 (datos válidos en sintaxis pero inválidos para la columna)
  },

  DATABASE_FK_VIOLATION: {
    code: 'DATABASE_FK_VIOLATION',
    title: 'Referencia a recurso inexistente',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY, // 422 (recurso referenciado no existe)
  },

  // ── Servicios externos ────────────────────────────────────────────
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    title: 'Error en servicio externo',
    httpStatus: HttpStatus.BAD_GATEWAY, // 502
  },

  EXTERNAL_SERVICE_TIMEOUT: {
    code: 'EXTERNAL_SERVICE_TIMEOUT',
    title: 'Timeout en servicio externo',
    httpStatus: HttpStatus.GATEWAY_TIMEOUT, // 504
  },

  AI_SERVICE_ERROR: {
    code: 'AI_SERVICE_ERROR',
    title: 'Error en servicio de inteligencia artificial',
    httpStatus: HttpStatus.BAD_GATEWAY, // 502
  },

  AI_SERVICE_TIMEOUT: {
    code: 'AI_SERVICE_TIMEOUT',
    title: 'Timeout en servicio de inteligencia artificial',
    httpStatus: HttpStatus.GATEWAY_TIMEOUT, // 504
  },

  AI_RESPONSE_MALFORMED: {
    code: 'AI_RESPONSE_MALFORMED',
    title: 'Respuesta malformada del servicio de IA',
    httpStatus: HttpStatus.BAD_GATEWAY, // 502
  },

  // ── Autenticación / Tokens ────────────────────────────────────────
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    title: 'Token de autenticación expirado',
    httpStatus: HttpStatus.UNAUTHORIZED, // 401
  },

  TOKEN_INVALID: {
    code: 'TOKEN_INVALID',
    title: 'Token de autenticación inválido',
    httpStatus: HttpStatus.UNAUTHORIZED, // 401
  },

  TOKEN_REFRESH_FAILED: {
    code: 'TOKEN_REFRESH_FAILED',
    title: 'Error al refrescar el token',
    httpStatus: HttpStatus.UNAUTHORIZED, // 401
  },

  // ── HTTP / Infraestructura ─────────────────────────────────────────
  // Usados por los exception filters para errores que no provienen
  // de BusinessException/TechnicalException. Están aquí para mantener
  // una única fuente de verdad de todos los códigos del sistema.
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    title: 'Error de validación',
    httpStatus: HttpStatus.BAD_REQUEST, // 400
  },

  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    title: 'Solicitud incorrecta',
    httpStatus: HttpStatus.BAD_REQUEST, // 400
  },

  HTTP_ERROR: {
    code: 'HTTP_ERROR',
    title: 'Error HTTP',
    httpStatus: HttpStatus.BAD_REQUEST, // varía — el filter usa el status real de la excepción
  },

  // ── Genérico ──────────────────────────────────────────────────────
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    title: 'Error interno del servidor',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR, // 500
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type TechnicalError =
  (typeof TechnicalError)[keyof typeof TechnicalError];
