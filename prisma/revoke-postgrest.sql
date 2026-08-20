-- ============================================================================
-- Acceso PostgREST a las tablas de dominio — estado verificado y salvaguardas
-- ============================================================================
--
-- Lo ejecuta el DESARROLLADOR HUMANO en el SQL Editor de Supabase.
-- No es una migracion: es configuracion de permisos del proyecto.
--
-- POR QUE EXISTE ESTE ARCHIVO
-- `rulesArquitectura.md § Acceso a Supabase` establece que el frontend y el
-- mobile NUNCA llaman a la API de PostgREST: toda interaccion con datos ocurre
-- a traves de la API de NestJS (/api/...). Supabase expone por PostgREST
-- cualquier tabla del esquema `public` a la que los roles `anon` y
-- `authenticated` tengan permisos. Sin proteccion, un cliente con la anon key
-- lee y escribe las tablas directamente, saltandose guards, validacion de DTOs,
-- reglas de negocio y rastro de auditoria.
--
-- ============================================================================
-- ESTADO REAL VERIFICADO (2026-08-20, despues de la migracion de EPICA-03)
-- ============================================================================
--
-- Las tablas NO estan expuestas, y nunca lo estuvieron. Comprobado contra la
-- base de datos, no deducido de la regla:
--
--   SELECT ... FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND grantee IN ('anon','authenticated')
--   -> 0 filas, sobre las 14 tablas del esquema.
--
-- La causa esta en los default privileges (`pg_default_acl`):
--
--   supabase_admin: {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}
--   postgres:       {postgres=arwdDxtm, service_role=arwdDxtm}
--
-- Prisma migra con el rol `postgres` (ver el usuario de DATABASE_URL), y su ACL
-- por defecto NO incluye `anon` ni `authenticated`. Por eso toda tabla que crea
-- una migracion nace ya protegida, y el REVOKE post-migracion que la regla pide
-- es, en la practica, un no-op.
--
-- CONSECUENCIA: las secciones 1 y 2 de abajo son SALVAGUARDAS, no correcciones
-- de un problema activo. Documentan la intencion de forma explicita en vez de
-- depender de que el default de Supabase para el rol `postgres` no cambie.
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Riesgo residual REAL — tablas creadas desde el dashboard
-- ----------------------------------------------------------------------------
--
-- Esta es la unica parte de este archivo que cierra un hueco que existe hoy.
--
-- El ACL por defecto de `supabase_admin` SI concede a `anon` y `authenticated`.
-- Prisma no usa ese rol, pero el SQL Editor del dashboard de Supabase puede.
-- Una tabla o vista creada desde ahi —una tabla auxiliar, una vista de apoyo—
-- naceria expuesta a PostgREST aunque las de Prisma no lo esten.
--
-- Requiere permisos de `supabase_admin`; probablemente falle desde la conexion
-- de Prisma y haya que ejecutarlo desde el SQL Editor del dashboard.

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. Salvaguarda — hacer explicito el default del rol de migraciones
-- ----------------------------------------------------------------------------
--
-- Hoy es un no-op: el rol `postgres` ya no concede a anon/authenticated. Se
-- deja escrito para que la proteccion sea una decision declarada del proyecto
-- y no una herencia del default de Supabase, que podria cambiar en el futuro.
--
-- Si Prisma llegara a migrar con un rol distinto de `postgres`, cambiar aqui
-- el nombre del rol (o usar la forma sin FOR ROLE conectandose con ese rol).

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. Barrido sobre lo existente — red de seguridad
-- ----------------------------------------------------------------------------
--
-- Tambien un no-op hoy (0 grants). Util si alguna vez se detecta una tabla
-- expuesta, o tras crear tablas desde el dashboard antes de aplicar la
-- seccion 1.
--
-- ADVERTENCIA: alcanza TODO el esquema `public`. Hoy es seguro porque ahi solo
-- viven las 13 tablas de dominio de Prisma mas `_prisma_migrations`. Si algun
-- dia Supabase coloca en `public` una tabla que sus propios servicios necesiten
-- leer por PostgREST, este barrido la bloquearia — revisa la lista antes.
--
-- No se revocan secuencias: todos los modelos usan @default(uuid()), no hay
-- columnas `serial` ni secuencias asociadas.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. Verificacion
-- ----------------------------------------------------------------------------
--
-- 4a. Grants efectivos — debe devolver CERO filas.
--     Si devuelve alguna, esa tabla esta expuesta por PostgREST.

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 4b. Default privileges — ningun `acl` debe mencionar anon ni authenticated.
--     Es lo que determina como nacen las tablas FUTURAS; 4a solo mira las que
--     ya existen. Revisar ambas: una puede estar limpia y la otra no.

SELECT pg_get_userbyid(defaclrole) AS owner_role, defaclacl::text AS acl
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public' AND defaclobjtype = 'r';
