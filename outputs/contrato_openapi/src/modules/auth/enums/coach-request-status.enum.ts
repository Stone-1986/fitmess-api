/**
 * Estados posibles de una solicitud de registro como entrenador.
 * State machine: PENDING → APPROVED | PENDING → REJECTED
 */
export enum CoachRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
