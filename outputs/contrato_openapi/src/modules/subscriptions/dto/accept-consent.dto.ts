import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO de entrada para HU-014: Aceptacion del consentimiento informado
 * deportivo (Aprobada -> Activa).
 *
 * CAMBIO DE RUPTURA (D-14, EPICA-04 REABIERTA por EPICA-05, rama (a)): el
 * campo `documentVersion` original se RENOMBRA a `sportConsentDocumentVersion`,
 * y se agrega `healthDataConsentDocumentVersion` — AMBOS obligatorios. El
 * atleta acepta AMBOS documentos en el MISMO acto: no existe la opcion de
 * aceptar el consentimiento deportivo y declinar el de datos sensibles de
 * salud (accept-consent es binario desde su diseño original en EPICA-04;
 * D-14 solo suma un segundo campo al mismo acto, no un segundo paso).
 *
 * MOTIVO del segundo campo: el Analista de Producto dictamino (Art. 6 Ley
 * 1581/2012 + Circular SIC 002/2024, CA-016-8) que la autorizacion unica de
 * RN-19/HABEAS_DATA del registro inicial NO es juridicamente suficiente
 * para la captura recurrente de dolor muscular y motivacion que introduce
 * HU-016 (EPICA-05) — se exige una finalidad especifica declarada. El
 * service crea un segundo LegalAcceptance (documentType=HEALTH_DATA_CONSENT)
 * DENTRO de la MISMA transaccion que ya crea SPORT_CONSENT y activa la
 * suscripcion.
 *
 * El CONTENIDO de cada documento (texto, disclaimer de IA de CA-014-5) es
 * responsabilidad del frontend, con versionado estatico — mismo alcance ya
 * establecido para HABEAS_DATA/TERMS_OF_SERVICE en HU-003 (decision D-8).
 * El backend solo persiste QUE version acepto el atleta de cada documento y
 * CUANDO, nunca el texto en si.
 */
export class AcceptConsentDto {
  @ApiProperty({
    description:
      'Version del documento de consentimiento informado DEPORTIVO que el atleta esta ' +
      'aceptando en este momento (renombrado de `documentVersion`, D-14). El contenido de ' +
      'esa version lo posee y versiona el frontend (D-8) — este campo solo identifica ' +
      'CUAL version se acepto.',
    example: '1.0.0',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'sportConsentDocumentVersion es obligatorio' })
  @MaxLength(50, {
    message: 'sportConsentDocumentVersion no puede superar 50 caracteres',
  })
  sportConsentDocumentVersion: string;

  @ApiProperty({
    description:
      'Version del documento de tratamiento de DATOS SENSIBLES DE SALUD (dolor muscular, ' +
      'motivacion — HU-016) que el atleta esta aceptando en este mismo acto (D-14, ' +
      'CA-016-8). Distinto del consentimiento deportivo y del HABEAS_DATA general del ' +
      'registro inicial (RN-19) — exige finalidad especifica declarada (Art. 6 Ley ' +
      '1581/2012 + Circular SIC 002/2024). Sin esta aceptacion la suscripcion no puede ' +
      'activarse: no existe la opcion de aceptar el deportivo y declinar este.',
    example: '1.0.0',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'healthDataConsentDocumentVersion es obligatorio' })
  @MaxLength(50, {
    message: 'healthDataConsentDocumentVersion no puede superar 50 caracteres',
  })
  healthDataConsentDocumentVersion: string;
}
