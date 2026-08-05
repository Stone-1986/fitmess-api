import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse } from '../../src/modules/common/swagger/error-responses';

// DTOs de entrada
import { LoginDto } from './dto/login.dto';
import { RegisterAthleteDto } from './dto/register-athlete.dto';
import { RegisterCoachDto } from './dto/register-coach.dto';

// DTOs de respuesta
import { AthleteRegistrationResponseDto } from './dto/athlete-registration-response.dto';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto';

/**
 * Controller de autenticación — endpoints públicos de EPICA-01.
 *
 * Todos los endpoints son públicos (no requieren JWT).
 * Se declara security: [] por endpoint para que Spectral no aplique
 * la regla fitmess-auth-401-operation en endpoints sin @ApiBearerAuth().
 *
 * Guards específicos por endpoint:
 * - POST /auth/login: LocalAuthGuard (Passport LocalStrategy)
 * - POST /auth/register y POST /auth/coaches/register: sin guard (público)
 *
 * El servicio asociado es AuthService (src/modules/auth/auth.service.ts).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: any) {}

  // ── HU-001: Registro de entrenador ────────────────────────────────────────

  /**
   * POST /auth/coaches/register
   *
   * Endpoint público — sin autenticación requerida.
   *
   * Crea User (role=COACH) + CoachRequest + LegalAcceptance(TERMS_OF_SERVICE)
   * + LegalAcceptance(HABEAS_DATA) en una $transaction atómica de Prisma.
   *
   * Anti-enumeración: ante email o identificationNumber duplicado retorna 409
   * con mensaje genérico (Ley 1273/2009).
   *
   * Emite: coach.request.created
   */
  @Post('coaches/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity([])
  @ApiOperation({
    summary: 'Registrar solicitud de nuevo entrenador',
    description:
      'Crea un usuario con rol COACH y una solicitud de entrenador en estado PENDING. ' +
      'Registra las aceptaciones legales de Términos y Habeas Data como documentos ' +
      'independientes (Ley 1581/2012). La cuenta queda inactiva hasta que el administrador apruebe la solicitud.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de registro creada exitosamente. El administrador recibirá una notificación.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validación en los datos del registro')
  @ApiProblemResponse(409, 'El email o número de identificación ya están registrados en la plataforma')
  async registerCoach(
    @Body() dto: RegisterCoachDto,
  ): Promise<CoachRequestResponseDto> {
    throw new NotImplementedException(
      'AuthService.registerCoach() pendiente de implementación',
    );
  }

  // ── HU-003: Registro de atleta ────────────────────────────────────────────

  /**
   * POST /auth/register
   *
   * Endpoint público — sin autenticación requerida.
   *
   * Crea User (role=ATHLETE) + LegalAcceptance(HABEAS_DATA)
   * + LegalAcceptance(TERMS_OF_SERVICE) en una $transaction atómica de Prisma.
   *
   * HEALTH_DATA_CONSENT no se registra en Fase 1. Se difiere a EPICA-04
   * (principio de minimalidad, Ley 1581/2012 art. 6, Decreto 1377/2013).
   *
   * Anti-enumeración: ante email o identificationNumber duplicado retorna 409
   * con mensaje genérico (Ley 1273/2009).
   *
   * Emite: user.registered
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity([])
  @ApiOperation({
    summary: 'Registrar nuevo atleta en la plataforma',
    description:
      'Crea un usuario con rol ATHLETE en Fase 1 (exploración). ' +
      'Registra las aceptaciones legales de Términos y Habeas Data como documentos ' +
      'independientes (Ley 1581/2012). No se solicita consentimiento de datos de salud ' +
      'en esta fase — se difiere a la inscripción al plan (EPICA-04).',
  })
  @ApiResponse({
    status: 201,
    description: 'Atleta registrado exitosamente.',
    type: AthleteRegistrationResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validación en los datos del registro')
  @ApiProblemResponse(409, 'El email o número de identificación ya están registrados en la plataforma')
  async registerAthlete(
    @Body() dto: RegisterAthleteDto,
  ): Promise<AthleteRegistrationResponseDto> {
    throw new NotImplementedException(
      'AuthService.registerAthlete() pendiente de implementación',
    );
  }

  // ── HU-004: Inicio de sesión ──────────────────────────────────────────────

  /**
   * POST /auth/login
   *
   * Endpoint público procesado por LocalAuthGuard (Passport LocalStrategy).
   * LocalStrategy valida email+password y popula request.user antes del controller.
   *
   * Seguridad (Ley 1273/2009, OWASP 2025):
   * - Mensaje idéntico para email inexistente y contraseña incorrecta (INVALID_CREDENTIALS 401)
   * - Bloqueo por cuenta: 5 intentos fallidos → ACCOUNT_TEMPORARILY_LOCKED (429) por 15 min
   * - El contador se resetea tras login exitoso o al expirar el período de bloqueo
   * - ThrottlerGuard global actúa como capa adicional por IP
   *
   * Coach con REJECTED → COACH_NOT_APPROVED (403)
   * Coach con PENDING → COACH_NOT_APPROVED (403)
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity([])
  @UseGuards(/* LocalAuthGuard */)
  @ApiOperation({
    summary: 'Iniciar sesión en la plataforma',
    description:
      'Autentica un usuario (atleta, entrenador o administrador) por email y contraseña. ' +
      'Retorna accessToken JWT y refreshToken. Los entrenadores en estado PENDING o REJECTED ' +
      'no pueden iniciar sesión. Implementa bloqueo temporal por cuenta tras 5 intentos fallidos ' +
      'consecutivos (Ley 1273/2009, OWASP 2025).',
  })
  @ApiResponse({
    status: 200,
    description: 'Autenticación exitosa. Retorna accessToken y refreshToken.',
    type: AuthTokenResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validación en los datos de inicio de sesión')
  @ApiProblemResponse(401, 'Credenciales incorrectas')
  @ApiProblemResponse(403, 'El entrenador aún no ha sido aprobado por el administrador')
  @ApiProblemResponse(429, 'Cuenta bloqueada temporalmente por exceso de intentos fallidos')
  async login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    throw new NotImplementedException(
      'AuthService.login() pendiente de implementación',
    );
  }
}
