import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  User,
  UserRole,
  DocumentType,
  CoachRequestStatus,
} from '../../../generated/prisma/index.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { TechnicalError } from '../common/exceptions/technical-error.enum.js';
import { RegisterAthleteDto } from './dto/register-athlete.dto.js';
import { RegisterCoachDto } from './dto/register-coach.dto.js';
import { AthleteRegistrationResponseDto } from './dto/athlete-registration-response.dto.js';
import { CoachRequestResponseDto } from './dto/coach-request-response.dto.js';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

// Constantes de bloqueo por cuenta (HU-004 / Ley 1273/2009 / OWASP 2025)
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN_SECONDS = 3600; // 1 hora
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * HU-003: Registro de atleta.
   *
   * Crea User (ATHLETE) + LegalAcceptance(HABEAS_DATA) + LegalAcceptance(TERMS_OF_SERVICE)
   * en una $transaction atomica (Ley 527/1999).
   * HEALTH_DATA_CONSENT NO se registra en Fase 1 — diferido a EPICA-04.
   * Emite user.registered.
   */
  async registerAthlete(
    dto: RegisterAthleteDto,
    ip: string,
    userAgent: string,
  ): Promise<AthleteRegistrationResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: User;

    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
            role: UserRole.ATHLETE,
            name: dto.name,
            phone: dto.phone,
            phoneCountryCode: dto.phoneCountryCode,
            identificationType: dto.identificationType,
            identificationNumber: dto.identificationNumber,
            avatarUrl: dto.avatarUrl,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          },
        });

        // HABEAS_DATA — Ley 1581/2012, Decreto 1377/2013 (checkbox independiente)
        await tx.legalAcceptance.create({
          data: {
            userId: created.id,
            documentType: DocumentType.HABEAS_DATA,
            documentVersion: dto.personalDataDocumentVersion,
            ip,
            userAgent,
          },
        });

        // TERMS_OF_SERVICE — Ley 527/1999 (checkbox independiente)
        await tx.legalAcceptance.create({
          data: {
            userId: created.id,
            documentType: DocumentType.TERMS_OF_SERVICE,
            documentVersion: dto.termsDocumentVersion,
            ip,
            userAgent,
          },
        });

        return created;
      });
    } catch (error) {
      // Constraint unique en email o identificationNumber (anti-enumeracion: mensaje neutro)
      if (this.isPrismaUniqueConstraintError(error)) {
        throw new BusinessException(
          BusinessError.DUPLICATE_ENTITY,
          'Estos datos ya estan registrados en la plataforma.',
        );
      }
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al registrar el atleta en la base de datos',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('user.registered', {
      userId: user.id,
      role: user.role,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      identificationType: user.identificationType,
      identificationNumber: user.identificationNumber,
      dateOfBirth: user.dateOfBirth
        ? user.dateOfBirth.toISOString().split('T')[0]
        : undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt,
    };
  }

  /**
   * HU-001: Registro de entrenador.
   *
   * Crea User (COACH) + CoachRequest (PENDING) + LegalAcceptance(TERMS_OF_SERVICE) +
   * LegalAcceptance(HABEAS_DATA) en una $transaction atomica (Ley 527/1999).
   * Emite coach.request.created.
   */
  async registerCoach(
    dto: RegisterCoachDto,
    ip: string,
    userAgent: string,
  ): Promise<CoachRequestResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let coachRequest: {
      id: string;
      status: CoachRequestStatus;
      createdAt: Date;
    };

    try {
      coachRequest = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
            role: UserRole.COACH,
            name: dto.name,
            phone: dto.phone,
            phoneCountryCode: dto.phoneCountryCode,
            identificationType: dto.identificationType,
            identificationNumber: dto.identificationNumber,
            avatarUrl: dto.avatarUrl,
          },
        });

        const request = await tx.coachRequest.create({
          data: {
            userId: user.id,
            planDescription: dto.planDescription,
            bannerUrl: dto.bannerUrl,
            status: CoachRequestStatus.PENDING,
          },
        });

        // TERMS_OF_SERVICE — Ley 527/1999
        await tx.legalAcceptance.create({
          data: {
            userId: user.id,
            documentType: DocumentType.TERMS_OF_SERVICE,
            documentVersion: dto.termsDocumentVersion,
            ip,
            userAgent,
          },
        });

        // HABEAS_DATA — Ley 1581/2012, Decreto 1377/2013 (checkbox independiente)
        await tx.legalAcceptance.create({
          data: {
            userId: user.id,
            documentType: DocumentType.HABEAS_DATA,
            documentVersion: dto.personalDataDocumentVersion,
            ip,
            userAgent,
          },
        });

        return request;
      });
    } catch (error) {
      // Constraint unique en email o identificationNumber (anti-enumeracion: mensaje neutro)
      if (this.isPrismaUniqueConstraintError(error)) {
        throw new BusinessException(
          BusinessError.DUPLICATE_ENTITY,
          'Estos datos ya estan registrados en la plataforma.',
        );
      }
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al registrar la solicitud del entrenador en la base de datos',
        {},
        error as Error,
      );
    }

    this.eventEmitter.emit('coach.request.created', {
      coachRequestId: coachRequest.id,
    });

    return {
      id: coachRequest.id,
      status: coachRequest.status,
      createdAt: coachRequest.createdAt,
      message: 'Solicitud recibida. El administrador revisara tu perfil.',
    };
  }

  /**
   * HU-004: Valida credenciales (email + password) con bloqueo por cuenta.
   *
   * Usado por LocalStrategy. Implementa:
   * 1. Verificacion de bloqueo activo (ACCOUNT_TEMPORARILY_LOCKED, 429)
   * 2. Busqueda del usuario por email
   * 3. Comparacion de password con bcrypt
   * 4. Incremento de intentos fallidos o reset en exito
   *
   * NUNCA loggea password ni distingue entre "email no existe" y "password incorrecto"
   * en el mensaje de error (anti-enumeracion, Ley 1273/2009).
   */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Verificar bloqueo de cuenta (aplica incluso si el usuario no existe para no revelar existencia)
    if (user) {
      const now = new Date();
      if (user.lockedUntil && user.lockedUntil > now) {
        const remainingMs = user.lockedUntil.getTime() - now.getTime();
        const remainingMin = Math.ceil(remainingMs / 60_000);
        throw new BusinessException(
          BusinessError.ACCOUNT_TEMPORARILY_LOCKED,
          `La cuenta esta bloqueada temporalmente. Intenta de nuevo en ${remainingMin} minuto${remainingMin !== 1 ? 's' : ''}.`,
          { lockedUntil: user.lockedUntil.toISOString() },
        );
      }

      // Si el bloqueo expiro, resetear el contador
      if (user.lockedUntil && user.lockedUntil <= now) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
      }
    }

    // Validar credenciales (mensaje identico para usuario inexistente y password incorrecto)
    const isValidPassword = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !isValidPassword) {
      // Incrementar contador de intentos fallidos si el usuario existe
      if (user) {
        const newAttempts = user.failedLoginAttempts + 1;
        const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil: shouldLock
              ? new Date(Date.now() + LOCK_DURATION_MS)
              : null,
          },
        });
      }

      throw new BusinessException(
        BusinessError.INVALID_CREDENTIALS,
        'Credenciales invalidas. Verifica tu correo electronico y contrasena.',
      );
    }

    // Login exitoso: resetear contador de intentos fallidos
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return user;
  }

  /**
   * HU-004: Genera tokens JWT y refreshToken para el usuario autenticado.
   *
   * Verifica que el coach tenga solicitud APPROVED antes de generar tokens.
   * NUNCA loggea accessToken ni refreshToken (Ley 1273/2009).
   */
  async login(user: User): Promise<AuthTokenResponseDto> {
    // Verificar estado del coach (PENDING o REJECTED → COACH_NOT_APPROVED)
    if (user.role === UserRole.COACH) {
      const coachRequest = await this.prisma.coachRequest.findUnique({
        where: { userId: user.id },
        select: { status: true },
      });

      if (
        !coachRequest ||
        coachRequest.status === CoachRequestStatus.PENDING ||
        coachRequest.status === CoachRequestStatus.REJECTED
      ) {
        throw new BusinessException(
          BusinessError.COACH_NOT_APPROVED,
          'Tu solicitud de entrenador aun no ha sido aprobada por el administrador.',
          { requestStatus: coachRequest?.status ?? 'NO_REQUEST' },
        );
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generar refresh token opaco y almacenarlo hasheado
    const rawRefreshToken = `rt_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      await this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al persistir el token de sesion',
        {},
        error as Error,
      );
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: JWT_EXPIRES_IN_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Detecta errores de constraint unique de Prisma (P2002).
   */
  private isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
