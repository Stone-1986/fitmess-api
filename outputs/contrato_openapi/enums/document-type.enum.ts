/**
 * Tipos de documentos legales cuya aceptación se registra en LegalAcceptance.
 *
 * - HABEAS_DATA: Política de tratamiento de datos personales (Ley 1581/2012)
 * - TERMS_OF_SERVICE: Términos y condiciones de uso de la plataforma
 * - HEALTH_DATA_CONSENT: Consentimiento para datos sensibles de salud (diferido a EPICA-04)
 * - SPORT_CONSENT: Consentimiento de riesgo deportivo
 */
export enum DocumentType {
  HABEAS_DATA = 'HABEAS_DATA',
  TERMS_OF_SERVICE = 'TERMS_OF_SERVICE',
  HEALTH_DATA_CONSENT = 'HEALTH_DATA_CONSENT',
  SPORT_CONSENT = 'SPORT_CONSENT',
}
