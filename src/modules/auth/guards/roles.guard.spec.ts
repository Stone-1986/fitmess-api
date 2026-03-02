import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from '../../../../generated/prisma/index.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const createContext = (
  user: unknown,
  handler = vi.fn(),
  klass = vi.fn(),
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

// ── Suite principal ────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    vi.clearAllMocks();
  });

  it('permite el acceso cuando no hay roles requeridos (ruta sin restriccion de rol)', () => {
    // Arrange
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createContext({ id: 'user-id', role: UserRole.ATHLETE });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('permite el acceso cuando el array de roles requeridos esta vacio', () => {
    // Arrange
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = createContext({ id: 'user-id', role: UserRole.ATHLETE });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('permite el acceso cuando el usuario tiene el rol ADMIN requerido', () => {
    // Arrange
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createContext({ id: 'admin-id', role: UserRole.ADMIN });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('permite el acceso cuando el usuario tiene uno de los roles multiples requeridos', () => {
    // Arrange
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.ADMIN,
      UserRole.COACH,
    ]);
    const context = createContext({ id: 'coach-id', role: UserRole.COACH });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('lanza BusinessException RESOURCE_OWNERSHIP_DENIED cuando el rol no coincide', () => {
    // Arrange
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createContext({ id: 'athlete-id', role: UserRole.ATHLETE });

    // Act & Assert
    expect(() => guard.canActivate(context)).toThrow(BusinessException);
    expect(() => guard.canActivate(context)).toThrowError(
      expect.objectContaining({
        errorEntry: BusinessError.RESOURCE_OWNERSHIP_DENIED,
      }),
    );
  });

  it('lanza BusinessException INVALID_CREDENTIALS cuando no hay usuario en el request', () => {
    // Arrange
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createContext(undefined);

    // Act & Assert
    expect(() => guard.canActivate(context)).toThrow(BusinessException);
    expect(() => guard.canActivate(context)).toThrowError(
      expect.objectContaining({
        errorEntry: BusinessError.INVALID_CREDENTIALS,
      }),
    );
  });

  it('usa la clave ROLES_KEY para obtener los roles del metadata', () => {
    // Arrange
    const getAllAndOverrideSpy = vi
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    const handler = vi.fn();
    const klass = vi.fn();
    const context = createContext(
      { id: 'admin-id', role: UserRole.ADMIN },
      handler,
      klass,
    );

    // Act
    guard.canActivate(context);

    // Assert
    expect(getAllAndOverrideSpy).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      klass,
    ]);
  });
});
