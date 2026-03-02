/**
 * Estado de una solicitud de registro como entrenador.
 * Máquina de estados: PENDING → APPROVED | REJECTED
 */
export enum CoachRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
