# Analisis de Requerimientos — App Fitmess
**Fecha de analisis:** 2026-02-18
**Version del documento fuente:** proyecto-app.txt
**Estado:** Completo — Listo para revision del equipo

---

## Resumen Ejecutivo

| Atributo | Valor |
|----------|-------|
| Dominio | Plataforma de entrenamiento deportivo personalizado |
| Total de Epicas | 8 |
| Total de Features | 19 |
| Total de Historias de Usuario | 22 |
| Actores | Atleta, Entrenador, Administrador |
| Marco regulatorio | Ley 1581 de 2012 (Colombia) — Proteccion de datos personales |

### Actores del sistema

- **Atleta:** Persona que se registra en la plataforma, explora planes, se inscribe a ellos, ejecuta sesiones y registra sus resultados y sensaciones.
- **Entrenador:** Persona o centro de entrenamiento que crea y publica planes, gestiona la inscripcion de atletas, personaliza las instancias individuales de cada atleta y solicita analisis de IA.
- **Administrador:** Rol interno que aprueba el registro de nuevos entrenadores y gestiona la biblioteca global de ejercicios.

---

## Mapa de Descomposicion

```
  : Gestion de Acceso y Cumplimiento Legal
  ├── FEAT-01: Registro y aprobacion de entrenadores
  │   ├── HU-001: Solicitud de registro como entrenador
  │   └── HU-002: Aprobacion o rechazo de solicitud de entrenador por el Administrador
  ├── FEAT-02: Registro de atletas y aceptacion de documentos legales
  │   └── HU-003: Registro inicial del atleta en la plataforma
  └── FEAT-03: Autenticacion y sesion de usuario
      └── HU-004: Inicio de sesion en la plataforma

EPICA-02: Catalogo Global de Ejercicios
  ├── FEAT-04: Creacion y gestion de ejercicios en la biblioteca
  │   └── HU-005: Creacion de ejercicio en la biblioteca global
  └── FEAT-05: Versionado e inhabilitacion de ejercicios
      ├── HU-006: Modificacion de un ejercicio existente genera nueva version
      └── HU-007: Inhabilitacion de un ejercicio en la biblioteca

EPICA-03: Creacion y Publicacion de Planes de Entrenamiento
  ├── FEAT-06: Construccion del plan (plantilla base)
  │   └── HU-008: Creacion de la plantilla base de un plan de entrenamiento
  ├── FEAT-07: Publicacion y ciclo de vida del plan
  │   ├── HU-009: Publicacion de un plan de entrenamiento
  │   └── HU-010: Finalizacion y archivo de un plan de entrenamiento
  └── FEAT-08: Exploracion de planes por el atleta
      └── HU-011: Exploracion del catalogo de entrenadores y planes publicados

EPICA-04: Inscripcion de Atletas a Planes
  ├── FEAT-09: Solicitud de inscripcion por el atleta
  │   └── HU-012: Solicitud de inscripcion a un plan de entrenamiento
  ├── FEAT-10: Aprobacion de inscripcion por el entrenador
  │   └── HU-013: Aprobacion o rechazo de inscripcion de atleta a un plan
  └── FEAT-11: Consentimiento informado en la inscripcion
      └── HU-014: Aceptacion del consentimiento informado deportivo al inscribirse a un plan

EPICA-05: Ejecucion del Plan — Instancia Personalizada
  ├── FEAT-12: Registro de resultados de sesion por el atleta
  │   └── HU-015: Registro de resultados al completar una sesion de entrenamiento
  ├── FEAT-13: Registro de sensaciones semanales por el atleta
  │   └── HU-016: Registro de sensaciones semanales del atleta
  └── FEAT-14: Cierre de semana automatico
      └── HU-017: Cierre automatico de la semana al completar las sesiones programadas

EPICA-06: Personalizacion de la Instancia del Atleta por el Entrenador
  └── FEAT-15: Modificacion de la instancia semanal del atleta
      └── HU-018: Modificacion del plan del atleta antes del inicio de la semana

EPICA-07: Seguimiento y Metricas
  ├── FEAT-16: Consulta del historico propio por el atleta
  │   └── HU-019: Consulta del historial personal de entrenamiento por el atleta
  └── FEAT-17: Consulta de metricas por atleta para el entrenador
      └── HU-020: Consulta del progreso de un atleta por el entrenador

EPICA-08: Asesoria con Inteligencia Artificial
  ├── FEAT-18: Generacion de recomendaciones de la IA
  │   └── HU-021: Solicitud de analisis y recomendaciones de la IA para un atleta
  └── FEAT-19: Aprobacion o rechazo de propuestas de la IA
      └── HU-022: Aprobacion o rechazo de propuestas de ajuste generadas por la IA
```

---

## Registro Completo de Reglas de Negocio

### Reglas Explicitas (confirmadas por el documento y el usuario)

| ID | Regla |
|----|-------|
| RN-01 | Plan valido = nombre + fecha inicio/fin + al menos una sesion + cada sesion al menos un ejercicio |
| RN-02 | No existen planes open-ended (sin fecha de fin) |
| RN-03 | No es obligatorio tener atletas suscritos para crear un plan |
| RN-04 | La biblioteca de ejercicios es global y unica, visible para todos |
| RN-05 | Ejercicios inmutables una vez usados; los cambios generan nueva version |
| RN-06 | Los ejercicios no se eliminan, solo se inhabilitan |
| RN-07 | Los planes activos conservan la version original del ejercicio aunque este sea modificado o inhabilitado |
| RN-08 | El atleta puede editar resultados dentro de una ventana maxima de 7 dias |
| RN-09 | Al cerrar la semana, los datos se congelan para la IA |
| RN-10 | El atleta solo ve su propio historico |
| RN-11 | El entrenador ve metricas por atleta, NO comparaciones entre atletas |
| RN-12 | Sin rankings ni comparativas entre atletas (backlog futuro) |
| RN-13 | Planes y resultados NO se eliminan (inmutabilidad historica) |
| RN-14 | La IA se ejecuta manualmente, solicitada por el entrenador |
| RN-15 | La IA NO modifica planes, solo asesora con propuestas concretas |
| RN-16 | Se guarda historial semanal del feedback de la IA |
| RN-17 | Relacion N:N entre atletas y entrenadores via suscripcion a planes |
| RN-18 | El entrenador publica planes; el atleta se suscribe; el entrenador aprueba la inscripcion |
| RN-19 | Habeas Data (autorizacion de datos personales y datos sensibles) se diligencia en el registro inicial del atleta |
| RN-20 | El consentimiento informado deportivo se solicita en cada inscripcion a un plan, de forma independiente |
| RN-21 | El atleta registra resultados por sesion y sensaciones semanales (dolor muscular, motivacion) |
| RN-22 | El Administrador puede crear y gestionar ejercicios en la biblioteca global |
| RN-23 | Los entrenadores se registran por auto-registro y quedan pendientes de aprobacion del Administrador |
| RN-24 | Datos obligatorios del entrenador: nombre/centro, email, telefono, numero de identificacion, descripcion del plan. Avatar e imagen de banner son opcionales |
| RN-25 | El atleta pasa por dos fases: Fase 1 (registro y exploracion) y Fase 2 (inscripcion a un plan con aprobacion del entrenador) |
| RN-26 | El atleta en Fase 1 puede explorar entrenadores y planes publicados sin estar suscrito |
| RN-27 | Estados del plan: Borrador, Publicado, Finalizado, Archivado |
| RN-28 | Un plan en estado Finalizado sigue permitiendo que atletas registren resultados de sesiones pendientes |
| RN-29 | Un plan Archivado no es visible para los atletas y no acepta nuevos registros de resultados |
| RN-30 | El cierre de semana se dispara automaticamente cuando el atleta completa todas las sesiones programadas de esa semana |
| RN-31 | El plan base actua como plantilla. Cada atleta tiene su propia instancia personalizada. Los cambios en una instancia no afectan a otros atletas. Solo la duracion total y las fases son inmutables |
| RN-32 | El entrenador puede en la instancia del atleta: cambiar ejercicios, cambiar series/reps/carga, agregar/quitar ejercicios en una sesion, cambiar el orden de ejercicios. No puede agregar ni quitar sesiones dentro de una fase |
| RN-33 | Las modificaciones a la instancia del atleta solo son posibles antes de que el atleta inicie la semana. Una vez iniciada, esa semana es inmutable |
| RN-34 | La IA propone cambios concretos que el entrenador aprueba o rechaza; el entrenador no los edita manualmente |
| RN-35 | El entrenador conserva acceso permanente a los datos historicos del atleta aunque este haya abandonado el plan |

### Reglas Implicitas Confirmadas

| ID | Regla |
|----|-------|
| RI-03 | Los entrenadores solo ven datos de atletas suscritos o que hayan estado suscritos a SUS planes |

---

## Detalle de Epicas y Features

---

### EPICA-01: Gestion de Acceso y Cumplimiento Legal

**Objetivo de negocio:** Garantizar que todos los usuarios ingresen a la plataforma bajo condiciones legales validas (Ley 1581/2012 Colombia), con identidades verificadas y roles correctamente asignados.

**Actores involucrados:** Atleta, Entrenador, Administrador

**Alcance funcional:**
- Registro de entrenadores con flujo de aprobacion administrativa
- Registro de atletas con aceptacion de documentos legales (habeas data, datos sensibles)
- Autenticacion de usuarios por rol

**Criterio de exito:** Todo usuario que accede a la plataforma tiene una identidad verificada y ha aceptado los documentos legales requeridos segun su rol.

**Features incluidas:**
- FEAT-01: Registro y aprobacion de entrenadores
- FEAT-02: Registro de atletas y aceptacion de documentos legales
- FEAT-03: Autenticacion y sesion de usuario

---

### EPICA-02: Catalogo Global de Ejercicios

**Objetivo de negocio:** Centralizar la biblioteca de ejercicios disponibles en la plataforma, garantizando trazabilidad, inmutabilidad del historial y gestion controlada del contenido.

**Actores involucrados:** Administrador, Entrenador

**Alcance funcional:**
- Creacion de nuevos ejercicios en la biblioteca compartida
- Versionado automatico al modificar ejercicios ya utilizados
- Inhabilitacion (no eliminacion) de ejercicios obsoletos

**Criterio de exito:** La biblioteca mantiene un registro inmutable de todos los ejercicios y sus versiones. Ningun plan historico pierde acceso a los ejercicios que contenia.

**Features incluidas:**
- FEAT-04: Creacion y gestion de ejercicios en la biblioteca
- FEAT-05: Versionado e inhabilitacion de ejercicios

---

### EPICA-03: Creacion y Publicacion de Planes de Entrenamiento

**Objetivo de negocio:** Permitir que los entrenadores construyan planes de entrenamiento estructurados, los publiquen para que atletas se suscriban y gestionen su ciclo de vida completo.

**Actores involucrados:** Entrenador, Atleta

**Alcance funcional:**
- Construccion de la plantilla base del plan con fases, sesiones y ejercicios
- Publicacion del plan y gestion del ciclo de vida (Borrador, Publicado, Finalizado, Archivado)
- Exploracion del catalogo de planes por parte de los atletas

**Criterio de exito:** Los entrenadores pueden publicar planes validos que los atletas pueden descubrir y evaluar antes de inscribirse.

**Features incluidas:**
- FEAT-06: Construccion del plan (plantilla base)
- FEAT-07: Publicacion y ciclo de vida del plan
- FEAT-08: Exploracion de planes por el atleta

---

### EPICA-04: Inscripcion de Atletas a Planes

**Objetivo de negocio:** Gestionar el flujo completo de suscripcion de un atleta a un plan, incluyendo la solicitud, aprobacion del entrenador y aceptacion del consentimiento informado, cumpliendo los requisitos legales de cada inscripcion.

**Actores involucrados:** Atleta, Entrenador

**Alcance funcional:**
- Solicitud de inscripcion por parte del atleta
- Aprobacion o rechazo por el entrenador
- Aceptacion del consentimiento informado deportivo (independiente por cada plan)

**Criterio de exito:** Ningun atleta puede iniciar sesiones de un plan sin haber completado el flujo completo de inscripcion y consentimiento.

**Features incluidas:**
- FEAT-09: Solicitud de inscripcion por el atleta
- FEAT-10: Aprobacion de inscripcion por el entrenador
- FEAT-11: Consentimiento informado en la inscripcion

---

### EPICA-05: Ejecucion del Plan — Instancia Personalizada

**Objetivo de negocio:** Permitir que cada atleta ejecute su version personalizada del plan, registre resultados de sesiones y sensaciones semanales, con cierre automatico al completar la semana para alimentar el analisis de la IA.

**Actores involucrados:** Atleta, Entrenador

**Alcance funcional:**
- Registro de resultados por sesion con ventana de edicion de 7 dias
- Registro de sensaciones semanales (dolor muscular, motivacion)
- Cierre automatico de la semana al completar todas las sesiones programadas

**Criterio de exito:** Cada semana completada genera un conjunto de datos cerrado e inmutable que alimenta el analisis de la IA.

**Features incluidas:**
- FEAT-12: Registro de resultados de sesion por el atleta
- FEAT-13: Registro de sensaciones semanales por el atleta
- FEAT-14: Cierre de semana automatico

---

### EPICA-06: Personalizacion de la Instancia del Atleta por el Entrenador

**Objetivo de negocio:** Permitir que el entrenador ajuste la instancia del plan de cada atleta antes del inicio de cada semana, adaptando el entrenamiento en funcion de los resultados y las recomendaciones de la IA.

**Actores involucrados:** Entrenador

**Alcance funcional:**
- Modificacion de ejercicios, series, repeticiones, carga y orden dentro de las sesiones de la instancia del atleta
- Control de inmutabilidad: los cambios solo aplican antes de que el atleta inicie la semana

**Criterio de exito:** Al finalizar el plan, cada atleta tiene una instancia personalizada que refleja los ajustes acumulados semana a semana, diferente a la plantilla base y a las instancias de otros atletas.

**Features incluidas:**
- FEAT-15: Modificacion de la instancia semanal del atleta

---

### EPICA-07: Seguimiento y Metricas

**Objetivo de negocio:** Proporcionar visibilidad sobre el progreso individual de cada atleta, tanto para el propio atleta como para el entrenador, manteniendo la trazabilidad historica de forma permanente.

**Actores involucrados:** Atleta, Entrenador

**Alcance funcional:**
- Consulta del historial personal por el atleta (sus propios datos unicamente)
- Consulta del progreso individual por atleta para el entrenador (sin comparativas)
- Acceso permanente del entrenador a datos historicos aunque el atleta haya abandonado el plan

**Criterio de exito:** Tanto el atleta como el entrenador tienen acceso completo a los datos historicos sin restricciones de tiempo, pero sin acceder a datos de otros atletas.

**Features incluidas:**
- FEAT-16: Consulta del historico propio por el atleta
- FEAT-17: Consulta de metricas por atleta para el entrenador

---

### EPICA-08: Asesoria con Inteligencia Artificial

**Objetivo de negocio:** Apoyar al entrenador con recomendaciones concretas basadas en los datos del atleta, generando propuestas de ajuste que el entrenador aprueba o rechaza, con historial trazable de las decisiones.

**Actores involucrados:** Entrenador

**Alcance funcional:**
- Solicitud manual del analisis de IA por el entrenador
- Generacion de propuestas concretas de ajuste a la instancia del atleta
- Aprobacion o rechazo individual de cada propuesta
- Historial de analisis y decisiones

**Criterio de exito:** El entrenador puede delegar en la IA la generacion de propuestas sin perder el control de las decisiones finales sobre el plan del atleta.

**Features incluidas:**
- FEAT-18: Generacion de recomendaciones de la IA
- FEAT-19: Aprobacion o rechazo de propuestas de la IA

---

## Detalle de Historias de Usuario

---

## HU-001: Solicitud de registro como entrenador

**Feature padre:** FEAT-01

### Narrativa
Como entrenador o representante de un centro de entrenamiento
quiero completar un formulario de solicitud de registro en la plataforma
para que el administrador evalue mi perfil y me habilite para operar

### Criterios de Aceptacion

**CA-001-1: Registro exitoso con todos los datos obligatorios**
  Dado que un entrenador accede al formulario de solicitud de registro
  Cuando completa nombre, email, telefono, numero de identificacion y descripcion del plan, acepta los terminos y condiciones y envia la solicitud
  Entonces ve un mensaje confirmando que su solicitud fue recibida y que sera revisada por el administrador
    Y el administrador recibe una notificacion de nueva solicitud pendiente

**CA-001-2: Intento de envio con datos obligatorios incompletos**
  Dado que un entrenador esta completando el formulario de solicitud
  Cuando intenta enviar sin haber completado uno o mas campos obligatorios
  Entonces ve indicados los campos faltantes con mensaje de dato requerido
    Y el envio no se realiza

**CA-001-3: Registro con avatar e imagen de banner**
  Dado que un entrenador esta completando el formulario de registro
  Cuando adjunta una imagen de avatar y una imagen de banner antes de enviar
  Entonces esas imagenes quedan asociadas a su solicitud para ser revisadas por el administrador

**CA-001-4: Terminos y condiciones no aceptados**
  Dado que un entrenador completo todos los campos obligatorios del formulario
  Cuando intenta enviar la solicitud sin haber aceptado los terminos y condiciones
  Entonces ve un mensaje indicando que la aceptacion de terminos es obligatoria
    Y el envio no se realiza

### Reglas de Negocio
- RN-23: El entrenador se registra por auto-registro y queda pendiente de aprobacion del Admin.
- RN-24: Campos obligatorios: nombre/centro, email, telefono, numero de identificacion, descripcion del plan. Avatar e imagen de banner son opcionales.

### Dependencias
- Ninguna

### Notas y Supuestos
- [SUPUESTO] El email se usa como identificador unico del entrenador. Si ya existe un registro con el mismo email, el sistema debe informarlo.

### Validacion INVEST
- Independiente: ✅
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-002: Aprobacion o rechazo de solicitud de entrenador por el Administrador

**Feature padre:** FEAT-01

### Narrativa
Como administrador
quiero revisar las solicitudes de registro de entrenadores pendientes y aprobarlas o rechazarlas
para controlar quienes pueden operar en la plataforma

### Criterios de Aceptacion

**CA-002-1: Aprobacion de solicitud**
  Dado que existe una solicitud de entrenador en estado pendiente
  Cuando el administrador revisa el perfil y aprueba la solicitud
  Entonces el entrenador queda habilitado para operar en la plataforma
    Y el entrenador recibe una notificacion indicando que su solicitud fue aprobada

**CA-002-2: Rechazo de solicitud con motivo**
  Dado que existe una solicitud de entrenador en estado pendiente
  Cuando el administrador rechaza la solicitud indicando el motivo
  Entonces la solicitud queda en estado rechazado
    Y el entrenador recibe una notificacion con el motivo del rechazo

**CA-002-3: Listado de solicitudes pendientes**
  Dado que el administrador accede al panel de gestion de entrenadores
  Cuando consulta las solicitudes
  Entonces ve el listado de solicitudes con estado pendiente, incluyendo los datos del formulario de cada solicitante

### Reglas de Negocio
- RN-23: El entrenador no puede operar hasta que el Admin apruebe su solicitud.

### Dependencias
- HU-001

### Notas y Supuestos
- [SUPUESTO] El administrador puede ver los documentos opcionales (avatar, banner) como parte de la revision del perfil.

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-001 para que existan solicitudes; aceptable como dependencia de datos maestros)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-003: Registro inicial del atleta en la plataforma

**Feature padre:** FEAT-02

### Narrativa
Como persona interesada en entrenar
quiero registrarme como atleta en la plataforma
para poder explorar los planes y entrenadores disponibles

### Criterios de Aceptacion

**CA-003-1: Registro exitoso con datos validos**
  Dado que un visitante accede al formulario de registro de atleta
  Cuando completa los datos requeridos y confirma el registro
  Entonces queda registrado como atleta en Fase 1 con acceso de exploracion
    Y puede navegar el catalogo de entrenadores y planes publicados

**CA-003-2: Registro con datos incompletos**
  Dado que un visitante esta completando el formulario de registro
  Cuando intenta confirmar sin completar uno o mas campos obligatorios
  Entonces ve los campos faltantes indicados con mensaje de dato requerido
    Y el registro no se completa

**CA-003-3: Autorizacion de tratamiento de datos personales obligatoria**
  Dado que un visitante esta completando el formulario de registro de atleta
  Cuando intenta confirmar el registro sin haber aceptado la autorizacion de tratamiento de datos personales
  Entonces ve un mensaje indicando que la aceptacion es obligatoria para continuar
    Y el registro no se completa

**CA-003-4: Autorizacion de datos sensibles de salud obligatoria**
  Dado que un visitante esta completando el formulario de registro de atleta
  Cuando intenta confirmar el registro sin haber aceptado la autorizacion para el tratamiento de datos sensibles de salud mediante su checkbox independiente
  Entonces ve un mensaje indicando que esa autorizacion es obligatoria para continuar
    Y el registro no se completa

**CA-003-5: Registro de la aceptacion legal con trazabilidad**
  Dado que un atleta completo el registro exitosamente
  Cuando el sistema registra la aceptacion de los documentos legales
  Entonces queda almacenado el momento de la aceptacion, la version del documento aceptado y el identificador del usuario

### Reglas de Negocio
- RN-19: El habeas data (autorizacion de datos personales y datos sensibles de salud) se diligencia en el registro inicial del atleta.
- RN-25: El atleta en Fase 1 tiene acceso de exploracion unicamente.
- Ley 1581 de 2012: La autorizacion de datos sensibles requiere checkbox separado e independiente de la autorizacion general.
- Cada aceptacion legal debe registrarse con timestamp, IP y version del documento.

### Dependencias
- Ninguna

### Notas y Supuestos
- [SUPUESTO] Los datos obligatorios del atleta en el registro incluyen al menos nombre, email y contrasena. El documento fuente no los especifica en detalle; el equipo debe confirmarlos antes de estimar.

### Validacion INVEST
- Independiente: ✅
- Negociable: ✅
- Valiosa: ✅
- Estimable: ⚠️ (los campos exactos del formulario son un supuesto no confirmado; resolver antes de estimacion)
- Pequena: ✅
- Testeable: ✅

---

## HU-004: Inicio de sesion en la plataforma

**Feature padre:** FEAT-03

### Narrativa
Como usuario registrado (atleta, entrenador o administrador)
quiero iniciar sesion con mis credenciales
para acceder a las funcionalidades correspondientes a mi rol

### Criterios de Aceptacion

**CA-004-1: Inicio de sesion exitoso**
  Dado que un usuario registrado accede a la pantalla de inicio de sesion
  Cuando ingresa sus credenciales correctas y confirma
  Entonces accede al area de la plataforma correspondiente a su rol

**CA-004-2: Credenciales incorrectas**
  Dado que un usuario esta en la pantalla de inicio de sesion
  Cuando ingresa credenciales incorrectas
  Entonces ve un mensaje indicando que el usuario o la contrasena son incorrectos
    Y no se le concede acceso

**CA-004-3: Entrenador pendiente de aprobacion intenta ingresar**
  Dado que un entrenador cuya solicitud aun no ha sido aprobada intenta iniciar sesion
  Cuando ingresa sus credenciales
  Entonces ve un mensaje informando que su solicitud esta pendiente de revision por el administrador

### Reglas de Negocio
- RN-23: Un entrenador no aprobado no puede acceder a las funcionalidades de la plataforma.

### Dependencias
- HU-001 (para el flujo del entrenador)
- HU-003 (para el flujo del atleta)

### Notas y Supuestos
- [SUPUESTO] Existe un mecanismo de recuperacion de contrasena. No se describe en el documento fuente; se documenta como supuesto para que el equipo lo confirme y defina como HU adicional si aplica.

### Validacion INVEST
- Independiente: ⚠️ (transversal a todos los flujos; dependencia aceptable como funcionalidad de autenticacion base)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-005: Creacion de ejercicio en la biblioteca global

**Feature padre:** FEAT-04

### Narrativa
Como entrenador o administrador
quiero agregar un nuevo ejercicio a la biblioteca global de la plataforma
para que pueda usarse en la construccion de planes de entrenamiento

### Criterios de Aceptacion

**CA-005-1: Creacion exitosa de un ejercicio**
  Dado que un entrenador o administrador accede a la biblioteca de ejercicios
  Cuando completa la informacion del ejercicio y lo guarda
  Entonces el ejercicio queda disponible en la biblioteca para ser usado en planes

**CA-005-2: Ejercicio con nombre ya existente**
  Dado que el entrenador o administrador esta creando un ejercicio
  Cuando ingresa un nombre identico al de un ejercicio ya existente en la biblioteca
  Entonces ve un aviso indicando que ya existe un ejercicio con ese nombre
    Y puede revisar el existente o cambiar el nombre del nuevo

**CA-005-3: Visibilidad inmediata tras la creacion**
  Dado que un ejercicio fue guardado exitosamente en la biblioteca
  Cuando cualquier entrenador accede a la biblioteca
  Entonces puede ver y seleccionar el ejercicio recien creado para sus planes

### Reglas de Negocio
- RN-04: La biblioteca de ejercicios es global y unica, visible para todos los entrenadores.
- RN-22: El Administrador tambien puede crear ejercicios (correccion de tabla de permisos confirmada).

### Dependencias
- Ninguna

### Notas y Supuestos
- [SUPUESTO] Los campos del ejercicio incluyen al menos nombre, descripcion y grupo muscular. El documento no los especifica en detalle; el equipo debe definirlos.

### Validacion INVEST
- Independiente: ✅
- Negociable: ✅
- Valiosa: ✅
- Estimable: ⚠️ (campos del ejercicio no especificados; supuesto documentado)
- Pequena: ✅
- Testeable: ✅

---

## HU-006: Modificacion de un ejercicio existente genera nueva version

**Feature padre:** FEAT-05

### Narrativa
Como entrenador o administrador
quiero modificar la informacion de un ejercicio de la biblioteca
para mantener el contenido actualizado sin afectar los planes que ya usan la version anterior

### Criterios de Aceptacion

**CA-006-1: Modificacion genera nueva version cuando el ejercicio ya fue utilizado**
  Dado que un entrenador o administrador edita un ejercicio que ya fue incluido en al menos un plan
  Cuando guarda los cambios
  Entonces se crea una nueva version del ejercicio en la biblioteca
    Y los planes que usaban la version anterior conservan esa version sin cambios

**CA-006-2: Consulta de versiones de un ejercicio**
  Dado que un entrenador accede al detalle de un ejercicio en la biblioteca
  Cuando el ejercicio tiene mas de una version
  Entonces puede ver el historial de versiones con la fecha de cada cambio

**CA-006-3: Ejercicio nunca utilizado se edita directamente**
  Dado que un entrenador o administrador edita un ejercicio que aun no ha sido incluido en ningun plan
  Cuando guarda los cambios
  Entonces el ejercicio se actualiza directamente sin crear una nueva version

### Reglas de Negocio
- RN-05: Los ejercicios son inmutables una vez usados; los cambios generan nueva version.
- RN-07: Los planes activos conservan la version original del ejercicio.

### Dependencias
- HU-005

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-005; dependencia necesaria e inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-007: Inhabilitacion de un ejercicio en la biblioteca

**Feature padre:** FEAT-05

### Narrativa
Como entrenador o administrador
quiero inhabilitar un ejercicio de la biblioteca
para que no pueda ser seleccionado en nuevos planes, sin borrar el historial de planes donde ya se uso

### Criterios de Aceptacion

**CA-007-1: Inhabilitacion exitosa**
  Dado que un entrenador o administrador accede a un ejercicio activo en la biblioteca
  Cuando lo inhabilita
  Entonces el ejercicio deja de aparecer en el listado de ejercicios disponibles para nuevos planes
    Y los planes existentes que lo incluian conservan el ejercicio sin cambios

**CA-007-2: Ejercicio inhabilitado no seleccionable para nuevos planes**
  Dado que un entrenador esta construyendo un plan y busca ejercicios en la biblioteca
  Cuando el ejercicio esta inhabilitado
  Entonces no aparece en los resultados de busqueda ni puede ser seleccionado

**CA-007-3: Ejercicio inhabilitado visible en planes historicos**
  Dado que un plan existente incluye un ejercicio que fue inhabilitado posteriormente
  Cuando el entrenador o atleta consulta ese plan
  Entonces el ejercicio aparece visible en ese plan con una indicacion de que ya no esta activo en la biblioteca

### Reglas de Negocio
- RN-06: Los ejercicios no se eliminan, solo se inhabilitan.
- RN-07: Los planes activos conservan el ejercicio aunque este sea inhabilitado despues.

### Dependencias
- HU-005

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-005; dependencia necesaria)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-008: Creacion de la plantilla base de un plan de entrenamiento

**Feature padre:** FEAT-06

### Narrativa
Como entrenador
quiero crear la estructura de un plan de entrenamiento definiendo sus fases, sesiones y ejercicios
para tener una plantilla base que luego publicare y que se personalizara individualmente para cada atleta

### Criterios de Aceptacion

**CA-008-1: Creacion del plan con datos obligatorios**
  Dado que el entrenador accede al modulo de creacion de planes
  Cuando completa el nombre del plan, la fecha de inicio, la fecha de fin y agrega al menos una sesion con al menos un ejercicio
  Entonces el plan queda guardado en estado Borrador

**CA-008-2: Plan sin sesiones o sin ejercicios no puede guardarse como valido**
  Dado que el entrenador esta construyendo un plan
  Cuando intenta guardar un plan que no tiene ninguna sesion, o que tiene sesiones sin ejercicios
  Entonces ve un mensaje indicando que el plan requiere al menos una sesion y cada sesion al menos un ejercicio
    Y el plan puede guardarse unicamente como Borrador incompleto

**CA-008-3: Plan sin fechas no puede publicarse**
  Dado que el entrenador tiene un plan en estado Borrador sin fecha de inicio o fin
  Cuando intenta publicarlo
  Entonces ve un mensaje indicando que la fecha de inicio y de fin son obligatorias para publicar

**CA-008-4: Duracion del plan no puede modificarse despues de publicado**
  Dado que el entrenador tiene un plan en estado Publicado
  Cuando intenta cambiar la fecha de inicio o la fecha de fin
  Entonces ve un mensaje indicando que la duracion total del plan es inmutable una vez publicado

### Reglas de Negocio
- RN-01: Plan valido = nombre + fecha inicio/fin + al menos una sesion + cada sesion al menos un ejercicio.
- RN-02: No existen planes open-ended (sin fecha de fin).
- RN-31: El plan base actua como plantilla; cada atleta tendra su propia instancia personalizada.

### Dependencias
- HU-005 (para poder agregar ejercicios al plan)

### Notas y Supuestos
- [SUPUESTO] Las "fases" del plan son agrupaciones de sesiones definidas por el entrenador. Su estructura interna (nombre, duracion de la fase) no fue especificada en detalle por el documento fuente.

### Validacion INVEST
- Independiente: ⚠️ (requiere ejercicios existentes en la biblioteca; dependencia aceptable de datos maestros)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-009: Publicacion de un plan de entrenamiento

**Feature padre:** FEAT-07

### Narrativa
Como entrenador
quiero publicar un plan que ya esta completo
para que los atletas puedan verlo y solicitar su inscripcion

### Criterios de Aceptacion

**CA-009-1: Publicacion exitosa de un plan valido**
  Dado que el entrenador tiene un plan en estado Borrador con todos los datos obligatorios completos
  Cuando lo publica
  Entonces el plan cambia a estado Publicado
    Y pasa a ser visible para los atletas en el catalogo de planes

**CA-009-2: Intento de publicar plan incompleto**
  Dado que el entrenador tiene un plan en Borrador que no cumple los requisitos minimos de validez
  Cuando intenta publicarlo
  Entonces ve un mensaje indicando que debe completar los datos requeridos antes de publicar
    Y el plan permanece en Borrador

**CA-009-3: Plan publicado puede regresar a Borrador antes de tener suscriptores**
  Dado que el entrenador tiene un plan en estado Publicado sin atletas suscritos
  Cuando lo regresa a estado Borrador
  Entonces el plan deja de ser visible para los atletas
    Y el entrenador puede seguir editando la plantilla base

### Reglas de Negocio
- RN-27: Estados del plan: Borrador, Publicado, Finalizado, Archivado.
- RN-01: Un plan solo puede publicarse si tiene nombre, fechas y al menos una sesion con ejercicios.
- RN-03: No es obligatorio tener atletas suscritos para publicar un plan.

### Dependencias
- HU-008

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-008; inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-010: Finalizacion y archivo de un plan de entrenamiento

**Feature padre:** FEAT-07

### Narrativa
Como entrenador
quiero gestionar el cierre de un plan cuando llega a su fecha de fin o cuando decido retirarlo
para mantener el catalogo actualizado y controlar quienes pueden seguir registrando resultados

### Criterios de Aceptacion

**CA-010-1: Plan pasa a Finalizado al llegar la fecha de fin**
  Dado que un plan publicado llego a su fecha de fin
  Cuando ocurre ese evento
  Entonces el plan cambia automaticamente a estado Finalizado
    Y deja de aceptar nuevas inscripciones de atletas
    Y los atletas ya suscritos pueden continuar registrando resultados de sesiones pendientes

**CA-010-2: Archivo manual de un plan por el entrenador**
  Dado que el entrenador tiene un plan en cualquier estado activo
  Cuando decide archivarlo manualmente
  Entonces el plan cambia a estado Archivado
    Y deja de ser visible para los atletas
    Y los atletas ya suscritos no pueden registrar mas resultados en ese plan

**CA-010-3: Diferencia entre plan Finalizado y plan Archivado visible para el atleta**
  Dado que un atleta tiene suscripciones a planes en diferentes estados
  Cuando consulta su lista de planes
  Entonces ve los planes Finalizados con indicacion de que puede continuar registrando resultados pendientes
    Y ve los planes Archivados con indicacion de que el plan ya no esta disponible

### Reglas de Negocio
- RN-27: Estados: Borrador, Publicado, Finalizado, Archivado.
- RN-28: Plan Finalizado permite registro de resultados de sesiones pendientes.
- RN-29: Plan Archivado no es visible ni acepta resultados.

### Dependencias
- HU-009

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-009; inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-011: Exploracion del catalogo de entrenadores y planes publicados

**Feature padre:** FEAT-08

### Narrativa
Como atleta registrado en la plataforma
quiero explorar los entrenadores disponibles y los planes que han publicado
para encontrar el plan que mejor se adapte a mis objetivos antes de inscribirme

### Criterios de Aceptacion

**CA-011-1: Acceso al catalogo desde Fase 1**
  Dado que un atleta completo su registro inicial (Fase 1) y ha iniciado sesion
  Cuando navega al catalogo de planes
  Entonces puede ver los planes en estado Publicado de todos los entrenadores
    Y puede ver el perfil del entrenador asociado a cada plan

**CA-011-2: Detalle de un plan**
  Dado que el atleta esta explorando el catalogo de planes
  Cuando selecciona un plan especifico
  Entonces ve la informacion del plan: nombre, descripcion, fechas, fases y estructura de sesiones
    Y puede ver el perfil del entrenador que lo ofrece

**CA-011-3: Planes en otros estados no son visibles en el catalogo**
  Dado que existen planes en estado Borrador, Finalizado o Archivado
  Cuando el atleta consulta el catalogo
  Entonces esos planes no aparecen en el listado de planes disponibles

### Reglas de Negocio
- RN-26: El atleta en Fase 1 puede explorar entrenadores y planes publicados.
- RN-27: Solo los planes en estado Publicado son visibles en el catalogo.

### Dependencias
- HU-003
- HU-009

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (requiere atleta registrado y planes publicados; dependencias de datos maestros, aceptables)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-012: Solicitud de inscripcion a un plan de entrenamiento

**Feature padre:** FEAT-09

### Narrativa
Como atleta
quiero solicitar mi inscripcion a un plan de entrenamiento publicado
para iniciar el proceso de incorporacion a ese plan

### Criterios de Aceptacion

**CA-012-1: Solicitud de inscripcion enviada exitosamente**
  Dado que el atleta esta viendo el detalle de un plan en estado Publicado
  Cuando solicita su inscripcion
  Entonces la solicitud queda registrada con estado pendiente de aprobacion del entrenador
    Y el entrenador recibe una notificacion de nueva solicitud de inscripcion

**CA-012-2: Atleta ya suscrito al mismo plan no puede solicitar de nuevo**
  Dado que el atleta ya tiene una inscripcion activa en un plan especifico
  Cuando intenta solicitar inscripcion al mismo plan nuevamente
  Entonces ve un mensaje indicando que ya esta inscrito en ese plan

**CA-012-3: Plan no disponible para nuevas inscripciones**
  Dado que el atleta intenta inscribirse a un plan que ya no esta en estado Publicado
  Cuando realiza la solicitud
  Entonces ve un mensaje indicando que el plan ya no acepta nuevas inscripciones

### Reglas de Negocio
- RN-17: Relacion N:N entre atletas y entrenadores via suscripcion a planes.
- RN-18: El atleta se suscribe a planes; el entrenador debe aceptar la inscripcion.

### Dependencias
- HU-003
- HU-011

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (requiere atleta registrado y plan publicado; aceptable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-013: Aprobacion o rechazo de inscripcion de atleta a un plan

**Feature padre:** FEAT-10

### Narrativa
Como entrenador
quiero revisar las solicitudes de inscripcion pendientes a mis planes y aprobarlas o rechazarlas
para controlar quienes forman parte de mi grupo de atletas

### Criterios de Aceptacion

**CA-013-1: Aprobacion de inscripcion**
  Dado que existe una solicitud de inscripcion pendiente de un atleta a uno de mis planes
  Cuando el entrenador aprueba la solicitud
  Entonces el atleta queda inscrito al plan
    Y el sistema le presenta al atleta el consentimiento informado para ese plan
    Y el atleta recibe una notificacion indicando que su solicitud fue aprobada

**CA-013-2: Rechazo de inscripcion**
  Dado que existe una solicitud de inscripcion pendiente
  Cuando el entrenador la rechaza
  Entonces el atleta recibe una notificacion indicando que su solicitud fue rechazada
    Y el atleta puede solicitar inscripcion a otros planes

**CA-013-3: Listado de solicitudes pendientes de inscripcion**
  Dado que el entrenador accede al panel de gestion de sus atletas
  Cuando consulta las solicitudes pendientes
  Entonces ve el listado con el nombre del atleta y el plan al que solicito inscribirse

### Reglas de Negocio
- RN-18: El entrenador debe aceptar la inscripcion del atleta al plan.
- RN-20: Una vez aprobada la inscripcion, se solicita el consentimiento informado al atleta.

### Dependencias
- HU-012

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-012; inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-014: Aceptacion del consentimiento informado deportivo al inscribirse a un plan

**Feature padre:** FEAT-11

### Narrativa
Como atleta
quiero revisar y aceptar el consentimiento informado deportivo al momento de inscribirme a un plan
para dejar constancia de que comprendo los riesgos y condiciones del entrenamiento

### Criterios de Aceptacion

**CA-014-1: Consentimiento presentado tras la aprobacion del entrenador**
  Dado que el entrenador aprobo la inscripcion del atleta a un plan
  Cuando el atleta accede a la plataforma
  Entonces ve el consentimiento informado deportivo correspondiente a ese plan antes de poder iniciar el entrenamiento

**CA-014-2: Aceptacion del consentimiento habilita el inicio del plan**
  Dado que el atleta esta visualizando el consentimiento informado
  Cuando lo acepta explicitamente
  Entonces queda habilitado para iniciar las sesiones del plan
    Y el sistema registra la aceptacion con el momento exacto y la version del documento

**CA-014-3: Sin aceptacion del consentimiento el atleta no puede iniciar sesiones**
  Dado que el atleta fue inscrito a un plan pero aun no acepto el consentimiento informado
  Cuando intenta acceder a las sesiones del plan
  Entonces ve el consentimiento pendiente y no puede continuar hasta aceptarlo

**CA-014-4: Consentimiento independiente por cada plan**
  Dado que un atleta esta inscrito en multiples planes de diferentes entrenadores
  Cuando revisa sus consentimientos pendientes
  Entonces ve un consentimiento separado por cada plan al que se inscribio

**CA-014-5: Disclaimer de IA incluido en el consentimiento**
  Dado que la plataforma usa IA para generar recomendaciones sobre el entrenamiento
  Cuando el atleta visualiza el consentimiento informado
  Entonces ve incluida la informacion de que las recomendaciones de la IA no sustituyen asesoria medica profesional

### Reglas de Negocio
- RN-20: El consentimiento informado se solicita en cada inscripcion a un plan, de forma independiente.
- Cada aceptacion debe registrarse con timestamp, IP y version del documento.
- El disclaimer de IA es obligatorio en el consentimiento segun el marco legal investigado.

### Dependencias
- HU-013

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-013; inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-015: Registro de resultados al completar una sesion de entrenamiento

**Feature padre:** FEAT-12

### Narrativa
Como atleta
quiero registrar los resultados de cada sesion de entrenamiento que complete
para que el entrenador y la IA puedan analizar mi progreso y ajustar mi plan

### Criterios de Aceptacion

**CA-015-1: Registro de resultados de sesion**
  Dado que el atleta tiene una sesion programada en su plan activo
  Cuando completa la sesion y registra los resultados de cada ejercicio
  Entonces los resultados quedan guardados y visibles para el entrenador

**CA-015-2: Edicion de resultados dentro de la ventana de 7 dias**
  Dado que el atleta registro los resultados de una sesion hace menos de 7 dias
  Y la semana aun no ha cerrado
  Cuando accede a esos resultados y los modifica
  Entonces la actualizacion queda guardada

**CA-015-3: Edicion bloqueada despues de 7 dias**
  Dado que el atleta registro los resultados de una sesion hace mas de 7 dias
  Cuando intenta modificarlos
  Entonces ve un mensaje indicando que el periodo de edicion ya cerro
    Y los resultados permanecen tal como fueron registrados originalmente

**CA-015-4: Resultados bloqueados una vez cerrada la semana**
  Dado que el atleta completo todas las sesiones de la semana y la semana cerro automaticamente
  Cuando intenta modificar los resultados de cualquier sesion de esa semana
  Entonces ve un mensaje indicando que la semana ya esta cerrada y los datos son definitivos

### Reglas de Negocio
- RN-08: El atleta puede editar resultados dentro de una ventana maxima de 7 dias.
- RN-09: Al cerrar la semana los datos se congelan para la IA.
- RN-21: El atleta registra resultados por sesion.

### Dependencias
- HU-014

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (el atleta debe estar inscrito con consentimiento aceptado; aceptable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-016: Registro de sensaciones semanales del atleta

**Feature padre:** FEAT-13

### Narrativa
Como atleta
quiero registrar mis sensaciones al finalizar cada semana de entrenamiento
para que el entrenador y la IA puedan evaluar mi carga percibida y bienestar

### Criterios de Aceptacion

**CA-016-1: Registro de sensaciones semanales exitoso**
  Dado que el atleta tiene una semana de entrenamiento en curso o recien completada
  Cuando registra sus sensaciones de la semana indicando su nivel de dolor muscular y su nivel de motivacion
  Entonces las sensaciones quedan guardadas asociadas a esa semana en su plan

**CA-016-2: Sensaciones congeladas al cerrar la semana**
  Dado que la semana cerro automaticamente por completitud de sesiones
  Cuando el atleta intenta modificar las sensaciones de esa semana
  Entonces ve un mensaje indicando que los datos de esa semana ya son definitivos

**CA-016-3: Semana con sensaciones registradas diferenciada del resto**
  Dado que el atleta consulta el historial de sus semanas
  Cuando una semana ya tiene sensaciones registradas
  Entonces puede distinguir visualmente las semanas con registro completo de las que aun no tienen sensaciones registradas

### Reglas de Negocio
- RN-21: Cada semana el atleta debe registrar sus sensaciones: dolor muscular y motivacion.
- RN-09: Al cerrar la semana los datos se congelan para la IA.

### Dependencias
- HU-015

### Notas y Supuestos
- [SUPUESTO] "Dolor muscular" y "motivacion" son los dos indicadores de sensaciones semanales confirmados. Si existen indicadores adicionales (calidad del sueno, nivel de estres, etc.), el equipo debe definirlos antes de estimar esta HU.

### Validacion INVEST
- Independiente: ⚠️ (la semana debe existir para poder registrar sensaciones; dependencia logica aceptable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-017: Cierre automatico de la semana al completar las sesiones programadas

**Feature padre:** FEAT-14

### Narrativa
Como atleta
quiero que la semana se cierre automaticamente cuando complete todas las sesiones programadas
para que mis datos queden consolidados sin necesidad de una accion manual adicional

### Criterios de Aceptacion

**CA-017-1: Cierre automatico al completar la ultima sesion de la semana**
  Dado que el atleta registro los resultados de la ultima sesion programada de la semana
  Cuando ese registro se guarda exitosamente
  Entonces la semana se marca como cerrada automaticamente
    Y los datos de resultados y sensaciones de esa semana quedan congelados para el analisis de la IA
    Y el atleta ve una indicacion de que la semana fue cerrada

**CA-017-2: El entrenador visualiza la semana cerrada del atleta**
  Dado que la semana de un atleta cerro automaticamente
  Cuando el entrenador accede al panel de ese atleta
  Entonces ve la semana marcada como cerrada y disponible para solicitar el analisis de la IA

### Reglas de Negocio
- RN-30: El cierre de semana se dispara cuando el atleta completa todas las sesiones programadas de esa semana.
- RN-09: Al cerrar la semana los datos se congelan para la IA.

### Dependencias
- HU-015

### Notas y Supuestos
- [SUPUESTO] Si el atleta no completa todas las sesiones programadas de la semana (por ejemplo, por ausencia), la semana no cierra automaticamente. Queda un gap sin resolver: ¿existe un mecanismo de cierre por tiempo (fin de semana calendario) ademas del cierre por completitud? Debe definirse antes de implementar.

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-015; inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-018: Modificacion del plan del atleta antes del inicio de la semana

**Feature padre:** FEAT-15

### Narrativa
Como entrenador
quiero ajustar la instancia del plan de un atleta especifico antes de que inicie su nueva semana
para adaptar el entrenamiento a su progreso y condicion actual

### Criterios de Aceptacion

**CA-018-1: Modificacion permitida antes de que el atleta inicie la semana**
  Dado que el atleta aun no ha iniciado la semana en curso en su plan
  Cuando el entrenador modifica los ejercicios, series, repeticiones, cargas u orden de ejercicios dentro de una sesion
  Entonces los cambios quedan guardados en la instancia del atleta
    Y no afectan la plantilla base del plan ni las instancias de otros atletas

**CA-018-2: Modificacion bloqueada una vez iniciada la semana**
  Dado que el atleta ya registro al menos un resultado de la semana en curso
  Cuando el entrenador intenta modificar esa semana en la instancia del atleta
  Entonces ve un mensaje indicando que la semana ya esta en progreso y no puede ser modificada

**CA-018-3: Reemplazo de un ejercicio dentro de una sesion**
  Dado que el entrenador esta editando la instancia de un atleta en una semana no iniciada
  Cuando reemplaza un ejercicio por otro de la biblioteca
  Entonces el nuevo ejercicio reemplaza al anterior unicamente en la instancia de ese atleta

**CA-018-4: Agregar o quitar ejercicios dentro de una sesion**
  Dado que el entrenador esta editando la instancia de un atleta en una semana no iniciada
  Cuando agrega un ejercicio nuevo o elimina uno existente de una sesion
  Entonces la sesion se actualiza en la instancia del atleta exclusivamente

**CA-018-5: Numero de sesiones y duracion total son inmutables**
  Dado que el entrenador esta editando la instancia de un atleta
  Cuando intenta agregar o eliminar sesiones de una fase o modificar las fechas del plan
  Entonces ve un mensaje indicando que esas dimensiones son inmutables

### Reglas de Negocio
- RN-31: Cada atleta tiene su propia instancia personalizada del plan. Los cambios en una instancia no afectan la plantilla ni las instancias de otros atletas.
- RN-32: El entrenador puede cambiar ejercicios, series, reps, carga, agregar/quitar ejercicios en una sesion y cambiar el orden. No puede agregar ni quitar sesiones.
- RN-33: Las modificaciones solo son posibles antes de que el atleta inicie la semana.

### Dependencias
- HU-013
- HU-014

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (requiere atleta inscrito con consentimiento; aceptable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ⚠️ (5 criterios, en el limite; se mantiene unificada porque todos los criterios pertenecen al mismo flujo de edicion de la instancia y separarlos fragmentaria la logica de negocio)
- Testeable: ✅

---

## HU-019: Consulta del historial personal de entrenamiento por el atleta

**Feature padre:** FEAT-16

### Narrativa
Como atleta
quiero consultar mi historial de sesiones y sensaciones semanales registradas
para hacer seguimiento de mi progreso a lo largo del tiempo

### Criterios de Aceptacion

**CA-019-1: Visualizacion del historial de sesiones por plan**
  Dado que el atleta accede a su historial
  Cuando selecciona un plan al que esta o estuvo suscrito
  Entonces puede ver el registro de resultados de todas las sesiones completadas en ese plan

**CA-019-2: Consulta de sensaciones semanales en el historial**
  Dado que el atleta accede a su historial
  Cuando consulta una semana especifica de un plan
  Entonces puede ver las sensaciones que registro para esa semana (dolor muscular y motivacion)

**CA-019-3: Atleta solo ve su propio historial**
  Dado que el atleta esta autenticado en la plataforma
  Cuando accede a su historial
  Entonces solo ve sus propios datos, sin acceso a datos de ningun otro atleta

### Reglas de Negocio
- RN-10: El atleta solo ve su propio historico.
- RN-13: Planes y resultados no se eliminan (inmutabilidad historica).

### Dependencias
- HU-015
- HU-016

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (requiere historial previo registrado; aceptable como dependencia de datos)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-020: Consulta del progreso de un atleta por el entrenador

**Feature padre:** FEAT-17

### Narrativa
Como entrenador
quiero consultar el progreso individual de cada atleta suscrito a mis planes
para tomar decisiones informadas sobre los ajustes al entrenamiento

### Criterios de Aceptacion

**CA-020-1: Acceso al progreso individual de un atleta**
  Dado que el entrenador accede al panel de uno de sus atletas
  Cuando selecciona la opcion de ver su progreso
  Entonces ve el historial de resultados de sesiones y sensaciones semanales de ese atleta en el plan

**CA-020-2: El entrenador no accede a comparaciones entre atletas**
  Dado que el entrenador tiene multiples atletas suscritos a sus planes
  Cuando accede al panel de metricas
  Entonces ve cada atleta de forma individual, sin graficas ni tablas que comparen el rendimiento de un atleta con otro

**CA-020-3: Acceso a datos historicos de atleta que abandono el plan**
  Dado que un atleta se retiro o fue desvinculado de un plan del entrenador
  Cuando el entrenador accede al historial de ese atleta en ese plan
  Entonces puede ver todos los resultados registrados mientras el atleta estuvo activo en el plan

### Reglas de Negocio
- RN-11: El entrenador ve metricas por atleta, NO comparaciones entre atletas.
- RN-12: Sin rankings ni comparativas.
- RN-35: El entrenador conserva acceso permanente a datos historicos del atleta aunque haya abandonado el plan.
- RI-03: Los entrenadores solo ven datos de atletas suscritos o que hayan estado suscritos a SUS planes.

### Dependencias
- HU-015
- HU-016

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (requiere datos de sesiones previos; aceptable como dependencia de datos)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-021: Solicitud de analisis y recomendaciones de la IA para un atleta

**Feature padre:** FEAT-18

### Narrativa
Como entrenador
quiero solicitar que la IA analice los datos de un atleta y genere recomendaciones de ajuste para su plan
para contar con un apoyo objetivo en la toma de decisiones de personalizacion

### Criterios de Aceptacion

**CA-021-1: Solicitud manual del analisis de IA**
  Dado que el entrenador esta en el panel de un atleta con al menos una semana cerrada
  Cuando solicita el analisis de la IA
  Entonces la IA procesa los datos disponibles de ese atleta y genera un conjunto de recomendaciones

**CA-021-2: Contenido de las recomendaciones generadas**
  Dado que la IA proceso los datos del atleta
  Cuando el entrenador ve los resultados del analisis
  Entonces las recomendaciones incluyen propuestas concretas de ajuste (ejercicios a modificar, cambios de carga, ajustes de volumen) con la justificacion basada en los datos registrados del atleta

**CA-021-3: La IA no genera recomendaciones automaticamente**
  Dado que el entrenador no ha solicitado el analisis de la IA
  Cuando pasa el tiempo o se cierra una semana del atleta
  Entonces la IA no genera recomendaciones automaticamente

**CA-021-4: Disclaimer de IA visible en las recomendaciones**
  Dado que la IA genero recomendaciones para un atleta
  Cuando el entrenador consulta esas recomendaciones
  Entonces ve claramente que las recomendaciones son orientativas y no sustituyen asesoria medica o deportiva profesional

**CA-021-5: Historial de analisis anteriores disponible**
  Dado que el entrenador solicito analisis de IA en semanas anteriores para un atleta
  Cuando accede al panel de ese atleta
  Entonces puede consultar el historial de recomendaciones generadas anteriormente con la fecha de cada analisis

### Reglas de Negocio
- RN-14: La IA se ejecuta manualmente, solicitada por el entrenador.
- RN-15: La IA NO modifica planes, solo asesora con propuestas.
- RN-16: Se guarda historial semanal del feedback de la IA.

### Dependencias
- HU-017 (debe existir al menos una semana cerrada con datos disponibles)

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (requiere al menos una semana cerrada con datos; dependencia de datos, no de otra HU directamente)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## HU-022: Aprobacion o rechazo de propuestas de ajuste generadas por la IA

**Feature padre:** FEAT-19

### Narrativa
Como entrenador
quiero revisar las propuestas de ajuste que la IA genero para un atleta y aprobarlas o rechazarlas
para que los cambios aprobados se apliquen automaticamente a la instancia del atleta sin que yo tenga que editarlos manualmente

### Criterios de Aceptacion

**CA-022-1: Aprobacion de una propuesta aplica el cambio automaticamente**
  Dado que la IA genero propuestas de ajuste para el plan de un atleta en una semana no iniciada
  Cuando el entrenador aprueba una propuesta especifica
  Entonces el cambio propuesto se aplica automaticamente en la instancia del atleta
    Y el entrenador ve la instancia actualizada con los cambios aplicados

**CA-022-2: Rechazo de una propuesta deja la instancia sin cambios**
  Dado que la IA genero propuestas de ajuste
  Cuando el entrenador rechaza una propuesta
  Entonces esa propuesta queda descartada y la instancia del atleta no se modifica
    Y el rechazo queda registrado en el historial de la IA

**CA-022-3: Aprobacion bloqueada si la semana ya inicio**
  Dado que la semana del atleta ya inicio (el atleta registro al menos un resultado)
  Cuando el entrenador intenta aprobar una propuesta de la IA para esa semana
  Entonces ve un mensaje indicando que la semana ya inicio y los cambios no pueden aplicarse
    Y la propuesta queda en el historial como no aplicada

**CA-022-4: Aprobacion y rechazo independiente por propuesta**
  Dado que la IA genero multiples propuestas de ajuste para un atleta
  Cuando el entrenador revisa el listado de propuestas
  Entonces puede aprobar o rechazar cada propuesta de forma independiente, sin obligacion de aceptarlas todas

### Reglas de Negocio
- RN-34: La IA propone cambios concretos que el entrenador aprueba o rechaza; el entrenador no los edita manualmente.
- RN-33: Las modificaciones a la instancia del atleta solo son posibles antes de que el atleta inicie la semana.
- RN-15: La IA no modifica nada sin aprobacion del entrenador.

### Dependencias
- HU-021
- HU-018

### Notas y Supuestos
- Ninguno

### Validacion INVEST
- Independiente: ⚠️ (depende de HU-021 para que existan propuestas; inevitable)
- Negociable: ✅
- Valiosa: ✅
- Estimable: ✅
- Pequena: ✅
- Testeable: ✅

---

## Supuestos y Pendientes

### Supuestos Aceptados

| ID | Supuesto | Impacto si es incorrecto | HUs afectadas |
|----|----------|--------------------------|---------------|
| SUP-01 | El email es el identificador unico del entrenador | Habria que revisar el flujo de deteccion de duplicados | HU-001 |
| SUP-02 | Los datos obligatorios del atleta en el registro incluyen al menos nombre, email y contrasena | Los campos del formulario de registro podrian cambiar | HU-003 |
| SUP-03 | Los campos del ejercicio incluyen al menos nombre, descripcion y grupo muscular | Los campos de creacion de ejercicio podrian ampliarse | HU-005, HU-008 |
| SUP-04 | Las "fases" del plan son agrupaciones de sesiones con nombre definido por el entrenador; su estructura interna no fue especificada | El modelo de construccion del plan puede ser mas complejo | HU-008 |
| SUP-05 | Los indicadores de sensaciones semanales son exactamente dos: dolor muscular y motivacion | Podrian existir indicadores adicionales que cambiarian la HU | HU-016 |
| SUP-06 | Existe un mecanismo de recuperacion de contrasena aunque no fue descrito en el documento | Habria que agregar una HU adicional para ese flujo | HU-004 |
| SUP-07 | El administrador puede ver avatar y banner como parte de la revision de una solicitud de entrenador | El flujo de revision del admin podria ser mas simple | HU-002 |

### Pendientes sin Resolver

| ID | Pendiente | Pregunta al stakeholder | HUs afectadas |
|----|-----------|-------------------------|---------------|
| PEN-01 | Cierre de semana cuando el atleta no completa todas las sesiones | ¿Existe un cierre por tiempo (fin de semana calendario) ademas del cierre por completitud de sesiones? | HU-017 |

---

## Dependencias entre HUs

```
HU-001 (Registro entrenador)
  └── HU-002 (Aprobacion entrenador por Admin)
        └── HU-004 (Inicio de sesion) [tambien depende de HU-003]

HU-003 (Registro atleta)
  └── HU-004 (Inicio de sesion)
  └── HU-011 (Exploracion catalogo)
        └── HU-012 (Solicitud inscripcion)
              └── HU-013 (Aprobacion inscripcion)
                    └── HU-014 (Consentimiento informado)
                          └── HU-015 (Registro resultados sesion)
                          │     └── HU-017 (Cierre automatico semana)
                          │     └── HU-019 (Historial atleta)
                          │     └── HU-020 (Metricas entrenador)
                          │     └── HU-021 (Solicitud analisis IA)
                          │           └── HU-022 (Aprobacion propuestas IA)
                          └── HU-016 (Sensaciones semanales)
                                └── HU-019 (Historial atleta)
                                └── HU-020 (Metricas entrenador)

HU-005 (Creacion ejercicio)
  └── HU-006 (Versionado ejercicio)
  └── HU-007 (Inhabilitacion ejercicio)
  └── HU-008 (Creacion plantilla plan)
        └── HU-009 (Publicacion plan)
              └── HU-010 (Finalizacion y archivo)
              └── HU-011 (Exploracion catalogo) [tambien depende de HU-003]

HU-013 (Aprobacion inscripcion)
  └── HU-018 (Modificacion instancia atleta)
        └── HU-022 (Aprobacion propuestas IA) [tambien depende de HU-021]
```

---

## Glosario del Dominio

| Termino | Definicion en el contexto de la plataforma |
|---------|---------------------------------------------|
| Atleta | Usuario que se suscribe a planes de entrenamiento y registra sus resultados |
| Entrenador | Usuario o centro que crea planes, gestiona atletas y solicita analisis de IA |
| Administrador | Rol interno que aprueba entrenadores y gestiona la biblioteca de ejercicios |
| Plan de entrenamiento | Estructura que define fases, sesiones y ejercicios para un periodo determinado |
| Plantilla base | Version original del plan creada por el entrenador, punto de partida para cada instancia |
| Instancia del atleta | Copia personalizada del plan base asignada a un atleta especifico; puede evolucionar de forma independiente |
| Sesion | Unidad de entrenamiento dentro de un plan, compuesta por uno o mas ejercicios |
| Fase | Agrupacion de sesiones dentro del plan. La duracion y el numero de fases son inmutables una vez publicado el plan |
| Cierre de semana | Evento automatico que ocurre cuando el atleta completa todas las sesiones programadas de la semana; congela los datos para la IA |
| Biblioteca de ejercicios | Catalogo global compartido por todos los entrenadores y el admin |
| Sensaciones semanales | Registro subjetivo del atleta al finalizar la semana: dolor muscular y motivacion |
| Habeas Data | Autorizacion formal de tratamiento de datos personales exigida por la Ley 1581 de 2012 (Colombia) |
| Consentimiento informado | Documento que el atleta acepta al inscribirse a cada plan, declarando conocer los riesgos del entrenamiento |
| Suscripcion | Relacion entre un atleta y un plan de entrenamiento, establecida tras el flujo de solicitud-aprobacion-consentimiento |

---

*Documento generado por analisis de requerimientos estructurado.*
*Cualquier modificacion a las reglas de negocio, actores o flujos debe reflejarse en este documento y en las HUs afectadas.*
