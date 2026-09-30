const crypto = require('crypto');

const DURACION_SESION_MS = 2 * 60 * 60 * 1000;

// sesiones en memoria: token -> { usuario, expira }
const sesiones = new Map();

function crearSesion(usuario) {
  const ahora = Date.now();

  for (const [token, sesion] of sesiones) {
    if (sesion.expira < ahora) sesiones.delete(token);
  }

  const token = crypto.randomBytes(32).toString('hex');
  sesiones.set(token, { usuario, expira: ahora + DURACION_SESION_MS });
  return token;
}

function cerrarSesion(token) {
  sesiones.delete(token);
}

// deja pasar el pedido solo si el token es válido
function requiereAuth(req, res, next) {
  const [tipo, token] = (req.get('Authorization') || '').split(' ');
  const sesion = tipo === 'Bearer' ? sesiones.get(token) : undefined;

  if (!sesion || sesion.expira < Date.now()) {
    sesiones.delete(token);
    return res.status(401).json({ error: 'No autorizado. Iniciá sesión.' });
  }

  req.usuario = sesion.usuario;
  req.token = token;
  next();
}

module.exports = { crearSesion, cerrarSesion, requiereAuth };
