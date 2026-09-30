const express = require('express');
const { consultar } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const servicios = await consultar(
    'SELECT id, nombre, descripcion, area, icono, precio FROM servicios ORDER BY orden'
  );
  res.json(servicios);
});

module.exports = router;
