const express = require('express');
const { consultar } = require('../db');
const { verifyPassword } = require('../utils/password');
const { crearSesion, cerrarSesion, requiereAuth } = require('../middleware/auth');

const router = express.Router();

// compara usuario y contraseña con la tabla administradores
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body ?? {};

  if (typeof usuario !== 'string' || typeof password !== 'string' || !usuario.trim() || !password) {
    return res.status(400).json({ error: 'Ingresá usuario y contraseña.' });
  }

  const filas = await consultar(
    'SELECT usuario, password_hash FROM administradores WHERE usuario = ?',
    [usuario.trim()]
  );
  const admin = filas[0];

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  res.json({ token: crearSesion(admin.usuario), usuario: admin.usuario });
});

router.post('/logout', requiereAuth, (req, res) => {
  cerrarSesion(req.token);
  res.json({ mensaje: 'Sesión cerrada.' });
});

module.exports = router;
