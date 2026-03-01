import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse } from '../common/swagger/error-responses';
import { RegisterCoachDto } from './dto/register-coach.dto';
import { RegisterAthleteDto } from './dto/register-athlete.dto';
import { LoginDto } from './dto/login.dto';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto';
import { AthleteRegistrationResponseDto } from './dto/athlete-registration-response.dto';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';

// Guards — importados desde common (implementacion pendiente del Desarrollador)
// import { LocalAuthGuard } from '../common/guards/local-auth.guard';
// import { AuthService } from './auth.service';

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
  // constructor(private readonly authService: AuthService) {}

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
  @ApiSecurity([])
  @ApiOperation({
    summary: 'Registrar nuevo atleta en la plataforma',
    description:
      'Crea un nuevo usuario con rol ATHLETE. Registra HABEAS_DATA y TERMS_OF_SERVICE ' +
      'en legal_acceptances de forma atomica (Ley 1581/2012, Ley 527/1999). ' +
      'HEALTH_DATA_CONSENT se difiere a la inscripcion al plan (EPICA-04). ' +
      'Endpoint publico — ThrottlerGuard aplica automaticamente (100 req/min).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Atleta registrado exitosamente. Aceptaciones legales registradas.',
    type: AthleteRegistrationResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos del registro')
  @ApiProblemResponse(409, 'El correo electronico o numero de identificacion ya esta registrado en la plataforma')
  async registerAthlete(
    @Body() dto: RegisterAthleteDto,
  ): Promise<AthleteRegistrationResponseDto> {
    // stub — implementacion pendiente del Desarrollador
    // return this.authService.registerAthlete(dto);
    throw new Error('Not implemented');
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
  @ApiSecurity([])
  @ApiOperation({
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
    description: 'Solicitud de registro recibida. Pendiente de revision por el administrador.',
    type: CoachRequestResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos de la solicitud')
  @ApiProblemResponse(409, 'El correo electronico o numero de identificacion ya esta registrado en la plataforma')
  async registerCoach(
    @Body() dto: RegisterCoachDto,
  ): Promise<CoachRequestResponseDto> {
    // stub — implementacion pendiente del Desarrollador
    // return this.authService.registerCoach(dto);
    throw new Error('Not implemented');
  }

  // ── HU-004: Inicio de sesion ─────────────────────────────────────────────

  /**
   * POST /auth/login
   *
   * Endpoint publico. Usa LocalAuthGuard (Passport LocalStrategy).
   * LocalStrategy valida email+password y popula request.user.
   * AuthService.login() verifica estado del coach (COACH_NOT_APPROVED) despues
   * de validar credenciales — nunca antes (anti-enumeracion).
   *
   * ThrottlerGuard (100 req/min) es la medida contra fuerza bruta (Ley 1273/2009).
   * Los mensajes de error para credenciales incorrectas son identicos independientemente
   * de si el email no existe o si el password es incorrecto (anti-enumeracion).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(LocalAuthGuard)  // Descomentar en implementacion
  @ApiSecurity([])
  @ApiOperation({
    summary: 'Iniciar sesion en la plataforma',
    description:
      'Autentica al usuario con email y password via Passport LocalStrategy. ' +
      'Retorna accessToken JWT y refreshToken. ' +
      'El mensaje de error es identico para email inexistente y password incorrecto (anti-enumeracion, Ley 1273/2009). ' +
      'ThrottlerGuard aplica automaticamente como medida contra fuerza bruta (100 req/min). ' +
      'El entrenador con solicitud PENDING o REJECTED no puede iniciar sesion.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autenticacion exitosa. Retorna tokens de acceso.',
    type: AuthTokenResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos de inicio de sesion')
  @ApiProblemResponse(401, 'Credenciales invalidas')
  @ApiProblemResponse(403, 'El entrenador aun no ha sido aprobado por el administrador')
  async login(
    @Body() dto: LoginDto,
  ): Promise<AuthTokenResponseDto> {
    // stub — implementacion pendiente del Desarrollador
    // return this.authService.login(dto);
    throw new Error('Not implemented');
  }
}
