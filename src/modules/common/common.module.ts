import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

/**
 * CommonModule — infraestructura transversal disponible para todo modulo.
 *
 * Provee los guards de autenticacion y autorizacion. Es `@Global` por el mismo
 * motivo que PrismaModule: los necesita cualquier modulo de dominio y obligarlos
 * a importarlo uno por uno solo agrega ruido.
 *
 * Por que los guards viven aqui y no en `auth`:
 * hasta EPICA-02 estaban en `auth/shared/guards/`, asi que un modulo de dominio
 * que quisiera proteger sus endpoints tenia que hacer `imports: [AuthModule]`.
 * Eso arrastraba dos problemas. El primero es que `AuthModule` exportaba tambien
 * `AuthService`, con lo cual quedaba inyectable dentro de cualquier modulo que
 * importara los guards — exactamente el acoplamiento entre modulos de dominio
 * que prohibe `rulesCodigo § Comunicacion entre modulos`, entrando por la puerta
 * de atras. El segundo es de escala: las epicas 03 a 08 iban a repetir el patron
 * y `auth` habria terminado siendo infraestructura compartida de facto, sin estar
 * declarada como tal.
 *
 * Los guards no necesitaban vivir en `auth`: RolesGuard solo usa Reflector y
 * metadatos, y JwtAuthGuard extiende AuthGuard('jwt') de Passport, cuya estrategia
 * se registra globalmente cuando AuthModule instancia JwtStrategy — sin importar
 * quien consuma el guard.
 *
 * LocalAuthGuard NO esta aqui: solo lo usa el endpoint de login y no tiene
 * sentido fuera de `auth`.
 */
@Global()
@Module({
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class CommonModule {}
