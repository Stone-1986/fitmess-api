/**
 * EPICA-09: Adicion al AuthController existente
 *
 * Este archivo muestra el metodo que debe agregarse al AuthController
 * existente en src/modules/auth/auth.controller.ts
 *
 * El controller existente ya tiene: registerAthlete, registerCoach, login.
 * EPICA-09 agrega: registerAdmin (POST /auth/admin/register)
 *
 * INSTRUCCION PARA EL DESARROLLADOR:
 * 1. Copiar el metodo registerAdmin al AuthController existente
 *    (src/modules/auth/auth.controller.ts)
 * 2. Agregar los imports al auth.controller.ts:
 *    import { RegisterAdminDto } from './dto/register-admin.dto.js';
 *    import { AdminRegistrationResponseDto } from './dto/admin-registration-response.dto.js';
 * 3. El stub delega a this.authService.registerAdmin(dto, ip, userAgent)
 *    — implementar ese metodo en AuthService
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiProblemResponse } from '../common/swagger/error-responses.js';
import { AuthService } from './auth.service.js';
import { RegisterAdminDto } from './dto/register-admin.dto.js';
import { AdminRegistrationResponseDto } from './dto/admin-registration-response.dto.js';

/**
 * Fragmento — solo el metodo registerAdmin para agregar al AuthController.
 * El controller completo ya existe en src/modules/auth/auth.controller.ts.
 */

@ApiTags('auth')
@Controller('auth')
export class AuthControllerEpica09Addition {
  constructor(private readonly authService: AuthService) {}

  // ── HU-003 (EPICA-09): Registro de administrador via token de invitacion ──

  /**
   * POST /auth/admin/register
   *
   * Endpoint publico (sin JWT). Crea User con role ADMIN usando un token de
   * invitacion valido y vigente. En una $transaction atomica:
   * 1. Valida el token (hash + expiracion + uso) — AdminInvitationsService
   * 2. Crea User (ADMIN)
   * 3. Registra LegalAcceptance(HABEAS_DATA)
   * 4. Registra LegalAcceptance(TERMS_OF_SERVICE)
   * 5. Marca AdminInvitation como utilizada (tokenUsedAt = now())
   *
   * Emite user.registered despues del commit.
   * El admin inicia sesion con POST /auth/login despues del registro.
   *
   * Ley 1273/2009:
   * - El invitationToken nunca se loggea (via body, no path — anti-access-log)
   * - La password nunca se loggea
   * - El 422 cubre tanto token expirado como ya utilizado en el contexto del registro
   *
   * Ley 1581/2012: acceptsTermsOfService y acceptsHabeasData son OBLIGATORIOS.
   * El consentimiento es expreso via la accion afirmativa de completar el formulario.
   */
  @Post('admin/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    security: [],
    summary: 'Registrar nuevo administrador via token de invitacion',
    description:
      'Crea un nuevo usuario con rol ADMIN usando un token de invitacion valido. ' +
      'En una transaccion atomica ($transaction): valida el token, crea User (ADMIN), ' +
      'registra HABEAS_DATA y TERMS_OF_SERVICE en legal_acceptances, ' +
      'y marca la invitacion como utilizada (tokenUsedAt = now()). ' +
      'La invalidacion atomica del token en la misma transaccion previene race conditions. ' +
      'Registra aceptaciones legales de forma inmutable (Ley 1581/2012, Ley 527/1999). ' +
      'El token de invitacion se recibe en el body para evitar que aparezca en access logs ' +
      'del servidor (nginx, load balancers) — Ley 1273/2009. ' +
      'Emite user.registered despues del commit. ' +
      'Endpoint publico — ThrottlerGuard aplica automaticamente (100 req/min). ' +
      'El administrador inicia sesion con POST /auth/login despues del registro.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Administrador registrado exitosamente. Aceptaciones legales registradas. ' +
      'Iniciar sesion con POST /auth/login.',
    type: AdminRegistrationResponseDto,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion en los datos del registro o en los campos legales obligatorios',
  )
  @ApiProblemResponse(
    404,
    'Token de invitacion no encontrado',
  )
  @ApiProblemResponse(
    409,
    'El correo electronico o numero de identificacion ya esta registrado en la plataforma (mensaje neutro, anti-enumeracion)',
  )
  @ApiProblemResponse(
    422,
    'Token de invitacion expirado o ya utilizado',
  )
  async registerAdmin(
    @Body() dto: RegisterAdminDto,
    @Req() req: Request,
  ): Promise<AdminRegistrationResponseDto> {
    const ip = req.ip ?? '0.0.0.0';
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    return this.authService.registerAdmin(dto, ip, userAgent);
  }
}
