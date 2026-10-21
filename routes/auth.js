const express = require('express');
const { consultar, registrar } = require('../db');
const { verifyPassword } = require('../password');
const { crearSesion, cerrarSesion, requiereAuth } = require('../auth');

const router = express.Router();

// compara usuario y contraseña con la tabla administradores
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body ?? {};

  if (typeof usuario !== 'string' || typeof password !== 'string' || !usuario.trim() || !password) {
    return res.status(400).json({ error: 'Ingresá usuario y contraseña.' });
  }

  const filas = await consultar(
    'SELECT id, usuario, password_hash FROM administradores WHERE usuario = ?',
    [usuario.trim()]
  );
  const admin = filas[0];

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    await registrar(admin ? admin.id : null, 'login_fallido', 'administradores', admin ? admin.id : null, `Usuario: ${usuario.trim().slice(0, 50)}`);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  await registrar(admin.id, 'login', 'administradores', admin.id);
  res.json({ token: crearSesion(admin.id, admin.usuario), usuario: admin.usuario });
});

router.post('/logout', requiereAuth, async (req, res) => {
  await registrar(req.admin.id, 'logout', 'administradores', req.admin.id);
  cerrarSesion(req.token);
  res.json({ mensaje: 'Sesión cerrada.' });
});

module.exports = router;
