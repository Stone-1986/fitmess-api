import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiProblemResponse } from '../common/swagger/error-responses.js';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { RegisterCoachDto } from './dto/register-coach.dto.js';
import { RegisterAthleteDto } from './dto/register-athlete.dto.js';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto.js';
import { AthleteRegistrationResponseDto } from './dto/athlete-registration-response.dto.js';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto.js';
import { User } from '../../../generated/prisma/index.js';

/**
 * AuthController — endpoints publicos de autenticacion (EPICA-01)
 *
 * Ruta base: /auth
 * Endpoints publicos — sin JwtAuthGuard. Spectral: security: [].
 * ThrottlerGuard (rate limiter global 100 req/min) aplica automaticamente.
 *
 * HU-001: POST /auth/coaches/register
 * HU-003: POST /auth/register
 * HU-004: POST /auth/login
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── HU-003: Registro de atleta ────────────────────────────────────────────

  /**
   * POST /auth/register
   *
   * Endpoint publico. Crea User (ATHLETE) + LegalAcceptance(HABEAS_DATA) +
   * LegalAcceptance(TERMS_OF_SERVICE) en una $transaction atomica.
   * Emite user.registered.
   *
   * HEALTH_DATA_CONSENT NO se registra aqui — se difiere a EPICA-04.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    security: [],
    summary: 'Registrar nuevo atleta en la plataforma',
    description:
      'Crea un nuevo usuario con rol ATHLETE. Registra HABEAS_DATA y TERMS_OF_SERVICE ' +
      'en legal_acceptances de forma atomica (Ley 1581/2012, Ley 527/1999). ' +
      'HEALTH_DATA_CONSENT se difiere a la inscripcion al plan (EPICA-04). ' +
      'Endpoint publico — ThrottlerGuard aplica automaticamente (100 req/min).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Atleta registrado exitosamente. Aceptaciones legales registradas.',
    type: AthleteRegistrationResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos del registro')
  @ApiProblemResponse(
    409,
    'El correo electronico o numero de identificacion ya esta registrado en la plataforma',
  )
  async registerAthlete(
    @Body() dto: RegisterAthleteDto,
    @Req() req: Request,
  ): Promise<AthleteRegistrationResponseDto> {
    const ip = req.ip ?? '0.0.0.0';
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    return this.authService.registerAthlete(dto, ip, userAgent);
  }

  // ── HU-001: Registro de entrenador ───────────────────────────────────────

  /**
   * POST /auth/coaches/register
   *
   * Endpoint publico. Crea User (COACH, bloqueado hasta aprobacion) +
   * CoachRequest (PENDING) + LegalAcceptance(TERMS_OF_SERVICE) +
   * LegalAcceptance(HABEAS_DATA) en una $transaction atomica.
   * Emite coach.request.created.
   */
  @Post('coaches/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    security: [],
    summary: 'Enviar solicitud de registro como entrenador',
    description:
      'Crea una solicitud de registro para entrenador en estado PENDING. ' +
      'Los datos personales se almacenan en User; los datos de solicitud en CoachRequest. ' +
      'Registra TERMS_OF_SERVICE y HABEAS_DATA en legal_acceptances de forma atomica ' +
      '(Ley 1581/2012, Decreto 1377/2013, Ley 527/1999). ' +
      'El administrador revisara la solicitud antes de habilitar al entrenador. ' +
      'Endpoint publico — ThrottlerGuard aplica automaticamente (100 req/min).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Solicitud de registro recibida. Pendiente de revision por el administrador.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos de la solicitud')
  @ApiProblemResponse(
    409,
    'El correo electronico o numero de identificacion ya esta registrado en la plataforma',
  )
  async registerCoach(
    @Body() dto: RegisterCoachDto,
    @Req() req: Request,
  ): Promise<CoachRequestResponseDto> {
    const ip = req.ip ?? '0.0.0.0';
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    return this.authService.registerCoach(dto, ip, userAgent);
  }

  // ── HU-004: Inicio de sesion ─────────────────────────────────────────────

  /**
   * POST /auth/login
   *
   * Endpoint publico. Usa LocalAuthGuard (Passport LocalStrategy).
   * LocalStrategy llama a AuthService.validateCredentials() que:
   * 1. Verifica bloqueo por cuenta (ACCOUNT_TEMPORARILY_LOCKED, 429)
   * 2. Verifica credenciales email+password (INVALID_CREDENTIALS, 401)
   * 3. Resetea contador en login exitoso
   *
   * AuthService.login() verifica estado del coach (COACH_NOT_APPROVED) despues
   * de validar credenciales — nunca antes (anti-enumeracion).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    security: [],
    summary: 'Iniciar sesion en la plataforma',
    description:
      'Autentica al usuario con email y password via Passport LocalStrategy. ' +
      'Retorna accessToken JWT y refreshToken. ' +
      'El mensaje de error es identico para email inexistente y password incorrecto (anti-enumeracion, Ley 1273/2009). ' +
      'Bloqueo por cuenta tras 5 intentos fallidos consecutivos durante 15 minutos (Ley 1273/2009, OWASP 2025). ' +
      'ThrottlerGuard aplica automaticamente como medida adicional contra fuerza bruta (100 req/min). ' +
      'El entrenador con solicitud PENDING o REJECTED no puede iniciar sesion.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autenticacion exitosa. Retorna tokens de acceso.',
    type: AuthTokenResponseDto,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion en los datos de inicio de sesion',
  )
  @ApiProblemResponse(401, 'Credenciales invalidas')
  @ApiProblemResponse(
    403,
    'El entrenador aun no ha sido aprobado por el administrador',
  )
  @ApiProblemResponse(
    429,
    'Cuenta bloqueada temporalmente tras multiples intentos fallidos',
  )
  async login(
    @Req() req: Request & { user: User },
  ): Promise<AuthTokenResponseDto> {
    return this.authService.login(req.user);
  }
}
