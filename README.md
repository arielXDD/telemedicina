# Plataforma de Telemedicina

## Descripcion del Proyecto

Sistema integral de telemedicina disenado bajo una arquitectura de microservicios orientada a la escalabilidad, seguridad y alto rendimiento. La plataforma permite la interaccion digital segura entre pacientes y medicos, facilitando la programacion de citas, la gestion de historiales clinicos y la administracion de perfiles profesionales.

## Arquitectura del Sistema

El sistema esta construido utilizando un enfoque de microservicios, comunicados a traves de un API Gateway y contenerizados mediante Docker para garantizar la consistencia entre entornos de desarrollo y produccion.

### Microservicios (Backend)

* **API Gateway:** Punto de entrada unico para todas las peticiones de los clientes. Enruta y balancea las solicitudes hacia los microservicios correspondientes, implementando politicas de seguridad (CORS estricto, Helmet) a nivel de frontera.
* **Auth Service:** Gestiona la identidad y el control de acceso. Implementa autenticacion basada en JSON Web Tokens (JWT) y maneja el ciclo de vida de los usuarios (registro, login, validacion). Incluye logica de registro seguro para medicos mediante claves de acceso pre-compartidas y procesos de aprobacion administrativa.
* **Appointment Service:** Maneja la logica de negocio relacionada con la disponibilidad de los medicos, la programacion, cancelacion y seguimiento de las citas medicas.
* **Clinical History Service:** Servicio dedicado al almacenamiento seguro y recuperacion de los registros medicos de los pacientes.

### Tecnologias Backend

* Node.js y NestJS (Framework principal)
* Prisma ORM (Mapeo objeto-relacional y migraciones de base de datos)
* PostgreSQL / SQLite (Gestores de base de datos relacionales)
* Docker y Docker Compose (Contenerizacion y orquestacion local)
* JSON Web Tokens (Autenticacion)
* Helmet y bcrypt (Seguridad y hashing criptografico)

### Frontend

La aplicacion cliente es una Single Page Application (SPA) disenada con un enfoque moderno, responsivo y altamente interactivo.

* React 18
* TypeScript
* Vite (Herramienta de construccion)
* Tailwind CSS (Estilos basados en utilidades)
* shadcn/ui y Radix UI (Componentes de interfaz accesibles)
* WebGL Shaders (Animaciones de fondo de alto rendimiento)

## Caracteristicas Principales

### 1. Gestion de Usuarios y Roles
El sistema soporta multiples tipos de usuarios con permisos diferenciados. Los pacientes pueden registrarse libremente, mientras que los medicos requieren una validacion secundaria (clave de registro y aprobacion administrativa) para poder ejercer en la plataforma, garantizando la legitimidad del personal medico.

### 2. Panel de Control del Paciente
Interfaz intuitiva dividida en modulos independientes:
* **Agendamiento:** Exploracion de medicos disponibles por especialidad y reserva de horarios en tiempo real.
* **Citas Pendientes:** Visualizacion estructurada de los proximos compromisos medicos.
* **Historial Clinico:** Acceso cronologico a diagnositcos y notas medicas previas.

### 3. Seguridad y Privacidad
* Encriptacion de contrasenas en la base de datos (bcrypt).
* Autenticacion sin estado (JWT) con firmas criptograficas fuertes.
* Proteccion contra exposicion de secretos en codigo fuente (manejo estricto de variables de entorno).
* Prevencion de vulnerabilidades web estandar mediante cabeceras HTTP seguras (Clickjacking, MIME-sniffing, XSS mitigations).
* Politicas restrictivas de Cross-Origin Resource Sharing (CORS).

## Requisitos de Ejecucion

Para ejecutar la aplicacion en un entorno de desarrollo local, se requiere:

* Docker Desktop o Docker Engine (version 20.10.x o superior)
* Docker Compose (version 2.x o superior)
* Node.js (version 20.x o superior, opcional para desarrollo local fuera de contenedores)

## Instrucciones de Despliegue Local

1. Clonar el repositorio.
2. Copiar el archivo `.env.example` y renombrarlo a `.env`. Configurar las variables de entorno, incluyendo la inyeccion de claves fuertes para `JWT_SECRET` y `DOCTOR_REGISTRATION_KEY`.
3. Ejecutar el orquestador de contenedores en la raiz del proyecto:
   `docker-compose up -d --build`
4. Acceder al Frontend en `http://localhost:5173`.
5. Acceder al API Gateway en `http://localhost:8000`.

## Contribucion y Mantenimiento

Para mantener la integridad de la base de codigo, todas las nuevas caracteristicas deben adherirse al tipado estricto de TypeScript y las validaciones de datos mediante Data Transfer Objects (DTOs) en el backend. Toda configuracion sensible debe permanecer invariablemente dentro de gestores de variables de entorno, excluyendo dichos secretos del control de versiones.
