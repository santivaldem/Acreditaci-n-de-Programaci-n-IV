# SVAD - Sitio web y panel de administración

Acreditación de Programación IV. Santino Valenzuela, 7° 2ª.

Sitio web de mi empresa SVAD ("Tu información, siempre a salvo"). Presenta la empresa y sus servicios, tiene un formulario de consultas que se guardan en MySQL y un panel para que el dueño lea esas consultas.

Tecnologías: HTML, CSS y JavaScript, Node.js con Express, MySQL (XAMPP) con mysql2 (`createConnection`) y Git.

## Cómo probarlo

1. Abrir XAMPP e iniciar MySQL.
2. En phpMyAdmin, ir a *Importar* y elegir `database/svad.sql`.
3. En la carpeta del proyecto: `npm install`
4. Iniciar el servidor: `npm start`
5. Abrir http://localhost:3000

## Panel de administración

- Dirección: http://localhost:3000/admin
- Usuario: `admin`
- Contraseña: `Svad#Admin2026`

Desde el panel se ven todas las consultas, se pueden filtrar por estado, fecha y nombre o email, abrir el detalle, marcarlas como leídas o no leídas y cerrar sesión.

## API

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/servicios` | público | lista los servicios |
| POST | `/api/consultas` | público | guarda una consulta |
| POST | `/api/login` | público | devuelve un token si el usuario y la contraseña son correctos |
| POST | `/api/logout` | admin | cierra la sesión |
| GET | `/api/consultas` | admin | lista las consultas (filtros: `estado`, `desde`, `hasta`, `buscar`) |
| GET | `/api/consultas/:id` | admin | detalle de una consulta |
| PATCH | `/api/consultas/:id/leida` | admin | marca una consulta como leída o no leída |

Las rutas de admin necesitan la cabecera `Authorization: Bearer <token>`. Si falta o venció, responden 401.

## Base de datos

Base `svad_web` con tres tablas:

- `administradores`: usuarios del panel (la contraseña se guarda con hash).
- `servicios`: servicios que se muestran en el sitio.
- `consultas`: mensajes del formulario de contacto.

## Estructura

```
database/     svad.sql y generar-hash.js
routes/       auth.js, servicios.js, consultas.js
middleware/   auth.js
utils/        password.js
public/       páginas, estilos, scripts e imágenes
db.js         conexión a MySQL
server.js     servidor Express
```
