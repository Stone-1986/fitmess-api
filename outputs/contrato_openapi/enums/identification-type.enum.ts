/**
 * Tipos de documento de identificación aceptados en Colombia.
 *
 * - CC: Cédula de Ciudadanía
 * - CE: Cédula de Extranjería
 * - NIT: Número de Identificación Tributaria
 * - PASAPORTE: Pasaporte internacional
 * - PPT: Permiso de Protección Temporal (venezolanos bajo ETPV)
 * - PEP: Permiso Especial de Permanencia
 */
export enum IdentificationType {
  CC = 'CC',
  CE = 'CE',
  NIT = 'NIT',
  PASAPORTE = 'PASAPORTE',
  PPT = 'PPT',
  PEP = 'PEP',
}
