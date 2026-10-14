const crypto = require('crypto');

const LARGO_HASH = 64;

// devuelve "salt:hash" con scrypt, así no se guarda la contraseña en texto plano
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, LARGO_HASH).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, guardado) {
  const [salt, hash] = String(guardado).split(':');
  if (!salt || !hash) return false;

  const original = Buffer.from(hash, 'hex');
  const calculado = crypto.scryptSync(password, salt, LARGO_HASH);
  return original.length === calculado.length && crypto.timingSafeEqual(original, calculado);
}

module.exports = { hashPassword, verifyPassword };
