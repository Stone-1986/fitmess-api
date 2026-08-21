import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO de entrada para HU-014: Aceptacion del consentimiento informado
 * deportivo (Aprobada -> Activa).
 *
 * El CONTENIDO del documento (texto, disclaimer de IA de CA-014-5) es
 * responsabilidad del frontend, con versionado estatico — mismo alcance ya
 * establecido para HABEAS_DATA/TERMS_OF_SERVICE en HU-003 (decision D-8). El
 * backend solo persiste QUE version acepto el atleta y CUANDO, nunca el
 * texto en si: este DTO no recibe ningun campo de contenido.
 */
export class AcceptConsentDto {
  @ApiProperty({
    description:
      'Version del documento de consentimiento informado deportivo que el atleta ' +
      'esta aceptando en este momento. El contenido de esa version lo posee y ' +
      'versiona el frontend (D-8) — este campo solo identifica CUAL version se acepto.',
    example: '1.0.0',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'documentVersion es obligatorio' })
  @MaxLength(50, { message: 'documentVersion no puede superar 50 caracteres' })
  documentVersion: string;
}
