const express = require('express');
const { consultar, registrar } = require('../db');
const { requiereAuth } = require('../auth');

const router = express.Router();

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^[0-9+\-()\s]{6,30}$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_ID = /^\d+$/;

function formatear(consulta) {
  return { ...consulta, leida: Boolean(consulta.leida) };
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// el navegador ya valida, pero acá se vuelve a validar todo
function validarConsulta(body) {
  const errores = {};
  const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');

  const nombre = limpiar(body.nombre);
  const email = limpiar(body.email);
  const telefono = limpiar(body.telefono);
  const asunto = limpiar(body.asunto);
  const mensaje = limpiar(body.mensaje);
  const servicio = limpiar(body.servicio_id == null ? '' : String(body.servicio_id));

  if (nombre.length < 2 || nombre.length > 100) {
    errores.nombre = 'El nombre debe tener entre 2 y 100 caracteres.';
  }
  if (!REGEX_EMAIL.test(email) || email.length > 150) {
    errores.email = 'Ingresá un email válido.';
  }
  if (telefono && !REGEX_TELEFONO.test(telefono)) {
    errores.telefono = 'El teléfono solo puede tener números, espacios y los símbolos + - ( ).';
  }
  if (asunto.length < 3 || asunto.length > 150) {
    errores.asunto = 'El asunto debe tener entre 3 y 150 caracteres.';
  }
  if (mensaje.length < 10 || mensaje.length > 2000) {
    errores.mensaje = 'El mensaje debe tener entre 10 y 2000 caracteres.';
  }

  if (servicio && !REGEX_ID.test(servicio)) {
    errores.servicio_id = 'Elegí un servicio de la lista.';
  }

  return { datos: { nombre, email, telefono, asunto, mensaje, servicio_id: servicio || null }, errores };
}

router.post('/', async (req, res) => {
  const { datos, errores } = validarConsulta(req.body ?? {});

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({ error: 'Datos inválidos.', errores });
  }

  if (datos.servicio_id) {
    const existe = await consultar('SELECT id FROM servicios WHERE id = ?', [datos.servicio_id]);
    if (existe.length === 0) {
      return res.status(400).json({ error: 'Datos inválidos.', errores: { servicio_id: 'Elegí un servicio de la lista.' } });
    }
  }

  const resultado = await consultar(
    'INSERT INTO consultas (nombre, email, telefono, asunto, mensaje, servicio_id) VALUES (?, ?, ?, ?, ?, ?)',
    [datos.nombre, datos.email, datos.telefono || null, datos.asunto, datos.mensaje, datos.servicio_id]
  );

  res.status(201).json({ id: resultado.insertId, mensaje: 'Consulta recibida. ¡Gracias por escribirnos!' });
});

// lista con filtros opcionales: estado, servicio, desde, hasta y buscar
router.get('/', requiereAuth, async (req, res) => {
  const estado = texto(req.query.estado);
  const desde = texto(req.query.desde);
  const hasta = texto(req.query.hasta);
  const buscar = texto(req.query.buscar);
  const servicio = texto(req.query.servicio);

  // los valores van aparte (en "valores") para evitar inyección sql
  const condiciones = [];
  const valores = [];

  if (estado === 'leidas') condiciones.push('c.leida = 1');
  if (estado === 'no-leidas') condiciones.push('c.leida = 0');
  if (REGEX_FECHA.test(desde)) {
    condiciones.push('c.fecha >= ?');
    valores.push(`${desde} 00:00:00`);
  }
  if (REGEX_FECHA.test(hasta)) {
    condiciones.push('c.fecha <= ?');
    valores.push(`${hasta} 23:59:59`);
  }
  if (buscar) {
    const patron = `%${buscar.replace(/[\\%_]/g, '\\$&')}%`;
    condiciones.push('(c.nombre LIKE ? OR c.email LIKE ?)');
    valores.push(patron, patron);
  }
  if (servicio === 'ninguno') condiciones.push('c.servicio_id IS NULL');
  else if (REGEX_ID.test(servicio)) {
    condiciones.push('c.servicio_id = ?');
    valores.push(Number(servicio));
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = await consultar(
    `SELECT c.id, c.nombre, c.email, c.asunto, c.servicio_id, s.nombre AS servicio, c.leida, c.fecha
     FROM consultas c LEFT JOIN servicios s ON s.id = c.servicio_id ${where} ORDER BY c.fecha DESC, c.id DESC`,
    valores
  );

  res.json(filas.map(formatear));
});

router.get('/:id', requiereAuth, async (req, res) => {
  if (!REGEX_ID.test(req.params.id)) {
    return res.status(400).json({ error: 'El id debe ser un número.' });
  }

  const filas = await consultar(
    `SELECT c.id, c.nombre, c.email, c.telefono, c.asunto, c.mensaje, c.servicio_id, s.nombre AS servicio, c.leida, c.fecha
     FROM consultas c LEFT JOIN servicios s ON s.id = c.servicio_id WHERE c.id = ?`,
    [req.params.id]
  );

  if (filas.length === 0) {
    return res.status(404).json({ error: 'Consulta no encontrada.' });
  }
  res.json(formatear(filas[0]));
});

// marca la consulta como leída o no leída
router.patch('/:id/leida', requiereAuth, async (req, res) => {
  if (!REGEX_ID.test(req.params.id)) {
    return res.status(400).json({ error: 'El id debe ser un número.' });
  }
  const leida = req.body?.leida;
  if (typeof leida !== 'boolean') {
    return res.status(400).json({ error: 'El campo "leida" debe ser true o false.' });
  }

  const resultado = await consultar('UPDATE consultas SET leida = ? WHERE id = ?', [leida ? 1 : 0, req.params.id]);

  if (resultado.affectedRows === 0) {
    return res.status(404).json({ error: 'Consulta no encontrada.' });
  }
  await registrar(req.admin.id, leida ? 'marcar_leida' : 'marcar_no_leida', 'consultas', Number(req.params.id));
  res.json({ id: Number(req.params.id), leida });
});

module.exports = router;
