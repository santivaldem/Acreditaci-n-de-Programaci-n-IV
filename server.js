const express = require('express');
const cors = require('cors');
const path = require('path');
const { conectar } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// middlewares
app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/admin', (req, res) => res.redirect('/admin/login.html'));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// rutas de la api
app.use('/api', require('./routes/auth'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/consultas', require('./routes/consultas'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor.' : 'Solicitud inválida.'
  });
});

// el servidor arranca solo si hay conexión con mysql
conectar()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('No se pudo conectar a MySQL:', err.code || err.message);
    console.error('¿Está iniciado MySQL en XAMPP y importaste database/svad.sql?');
    process.exit(1);
  });
