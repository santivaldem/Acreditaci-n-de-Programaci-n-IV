const mysql = require('mysql2/promise');

// datos de conexión (los de XAMPP por defecto)
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'svad_web',
  dateStrings: true
};

let conexion;

async function conectar() {
  conexion = await mysql.createConnection(config);
  console.log(`Conectado a MySQL (base "${config.database}")`);
}

// ejecuta la consulta; si se cae la conexión, reconecta y reintenta una vez
async function consultar(sql, params = []) {
  try {
    const [resultado] = await conexion.query(sql, params);
    return resultado;
  } catch (err) {
    if (!err.fatal) throw err;
    console.warn('Se perdió la conexión con MySQL, reconectando...');
    await conectar();
    const [resultado] = await conexion.query(sql, params);
    return resultado;
  }
}

module.exports = { conectar, consultar };
