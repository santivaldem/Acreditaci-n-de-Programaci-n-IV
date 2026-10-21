# SVAD - Sitio web y panel de administración

Acreditación de Programación IV. Santino Valenzuela, 7° 2ª.

Sitio web de mi empresa SVAD ("Tu información, siempre a salvo"). Presenta la empresa y sus servicios, tiene un formulario de consultas que se guardan en MySQL y un panel de administración para gestionar la información de la base.

Tecnologías: HTML, CSS y JavaScript, Node.js con Express, MySQL (XAMPP) con mysql2 (`createConnection`) y Git.

## Cómo probarlo

1. Abrir XAMPP e iniciar MySQL.
2. En phpMyAdmin, ir a *Importar* y elegir `database/svad.sql`.
3. En la carpeta del proyecto: `npm install`
4. Iniciar el servidor: `npm start`
5. Abrir http://localhost:3000

## Panel de administración

- Entrada escondida: en el pie de cualquier página del sitio, tocar 5 veces seguidas el texto «© 2026 SVAD...». También se puede entrar directo en http://localhost:3000/admin/login.html
- Usuario: `admin`
- Contraseña: `Svad#Admin2026`

Es un solo panel con un menú de secciones:

- **Bandeja:** las consultas, con una ficha por servicio (cuántas hay de cada uno y cuántas sin leer), filtros por estado, servicio, fecha y nombre o email, detalle y marca de leída.
- **Servicios, Consultas y Administradores:** tablas con búsqueda, orden por columna, filtros, paginación y crear, ver, editar y eliminar.
- **Registros:** historial de las acciones importantes (ingresos, altas, cambios y bajas). Es de solo lectura.
- **Relaciones:** diagrama de las tablas y sus claves foráneas, leído en vivo desde MySQL.

Ocultar la entrada es solo comodidad: la protección real es el login, el token y los permisos del servidor.

## API

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/estado` | público | dice si la base de datos responde |
| GET | `/api/servicios` | público | lista los servicios |
| POST | `/api/consultas` | público | guarda una consulta (el servicio es opcional) |
| POST | `/api/login` | público | devuelve un token si el usuario y la contraseña son correctos |
| POST | `/api/logout` | admin | cierra la sesión |
| GET | `/api/consultas` | admin | lista las consultas (filtros: `estado`, `servicio`, `desde`, `hasta`, `buscar`) |
| GET | `/api/consultas/:id` | admin | detalle de una consulta |
| PATCH | `/api/consultas/:id/leida` | admin | marca una consulta como leída o no leída |
| GET | `/api/admin/entidades` | admin | describe las secciones del panel (campos y tipos) |
| GET | `/api/admin/relaciones` | admin | tablas y claves foráneas de la base |
| GET | `/api/admin/:seccion` | admin | lista con búsqueda, filtros, orden y paginación |
| GET | `/api/admin/:seccion/:id` | admin | detalle y registros vinculados |
| POST | `/api/admin/:seccion` | admin | crea un registro |
| PUT | `/api/admin/:seccion/:id` | admin | edita un registro |
| DELETE | `/api/admin/:seccion/:id` | admin | elimina un registro |

Las secciones son `servicios`, `consultas`, `administradores` y `registros` (esta última de solo lectura). Cada acción importante queda guardada en la tabla `registros`.

Las rutas de admin necesitan la cabecera `Authorization: Bearer <token>`. Si falta o venció, responden 401.

## Base de datos

Base `svad_web` con cuatro tablas:

- `administradores`: usuarios del panel (la contraseña se guarda con hash).
- `servicios`: servicios que se muestran en el sitio.
- `consultas`: mensajes del formulario de contacto. `servicio_id` es una clave foránea a `servicios` (opcional; si se borra el servicio, queda vacío).
- `registros`: acciones importantes de los administradores. `administrador_id` es una clave foránea a `administradores`.

## Estructura

```
database/     svad.sql y generar-hash.js
routes/       auth.js, servicios.js, consultas.js, admin.js
public/       páginas, estilos, scripts e imágenes
auth.js       sesiones y protección de rutas
password.js   hash de contraseñas
entidades.js  campos y reglas de cada sección del panel
db.js         conexión a MySQL y registro de acciones
server.js     servidor Express
```
