const { hashPassword } = require('../utils/password');

const password = process.argv[2];

if (!password) {
  console.error('Falta la contraseña. Ejemplo: node database/generar-hash.js "mi clave"');
  process.exit(1);
}

console.log(hashPassword(password));
