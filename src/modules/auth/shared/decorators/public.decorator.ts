import { SetMetadata } from '@nestjs/common';

/**
 * IS_PUBLIC_KEY — clave de metadata para marcar endpoints publicos.
 *
 * Usado por JwtAuthGuard para saltarse la validacion JWT en endpoints
 * que tienen @Public() aplicado. Permite tener guards a nivel de clase
 * pero endpoints publicos a nivel de metodo.
 *
 * Patron estandar NestJS para guards mixtos.
 *
 * Uso:
 * @UseGuards(JwtAuthGuard)  // a nivel de clase
 * @Public()                 // a nivel de metodo — salta JwtAuthGuard
 * @Post('verify')
 * async verify() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
