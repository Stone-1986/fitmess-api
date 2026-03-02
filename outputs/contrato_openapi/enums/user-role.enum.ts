/**
 * Roles de usuario en la plataforma Fitmess.
 *
 * - ATHLETE: Atleta — consumidor de planes de entrenamiento
 * - COACH: Entrenador — creador de planes; requiere aprobación de ADMIN
 * - ADMIN: Administrador — gestiona solicitudes de entrenadores y tiene acceso total
 */
export enum UserRole {
  ATHLETE = 'ATHLETE',
  COACH = 'COACH',
  ADMIN = 'ADMIN',
}
