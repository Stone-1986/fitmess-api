/**
 * Estructura RFC 9457 Problem Details.
 * Usada como shape del response body para TODOS los errores.
 */
export interface ProblemDetail {
  type: string; // URI del tipo de error
  title: string; // Resumen estable (del enum)
  status: number; // HTTP status code
  detail: string; // Descripción específica de esta ocurrencia
  instance?: string; // Path del request
  errorCode: string; // Código máquina (del enum)
  correlationId?: string; // UUID del request
  timestamp: string; // ISO 8601
  context?: Record<string, unknown>; // Datos adicionales
  errors?: ValidationError[]; // Solo para validación
}

export interface ValidationError {
  field: string;
  message: string;
}
