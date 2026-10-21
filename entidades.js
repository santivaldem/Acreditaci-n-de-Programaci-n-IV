const { consultar } = require('./db');
const { hashPassword } = require('./password');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^[0-9+\-()\s]{6,30}$/;
const REGEX_ID = /^\d+$/;

// Cada tabla del panel se describe acá. Para sumar una tabla nueva alcanza con agregar un bloque.
// tipos: texto, textarea, email, entero, decimal, enum, booleano, relacion, password, fecha
const ENTIDADES = {
  servicios: {
    tabla: 'servicios',
    etiqueta: 'Servicios',
    singular: 'servicio',
    texto: 'nombre',
    acciones: ['crear', 'editar', 'eliminar'],
    ordenInicial: { campo: 'orden', dir: 'asc' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, min: 3, max: 100, lista: true, buscar: true },
      { nombre: 'area', etiqueta: 'Área', tipo: 'enum', opciones: ['hardware', 'redes', 'asistencia', 'datos'], requerido: true, lista: true, filtro: true },
      { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', requerido: true, min: 10, max: 1000, buscar: true },
      { nombre: 'icono', etiqueta: 'Ícono', tipo: 'enum', opciones: ['chip', 'mantenimiento', 'mejoras', 'red', 'wifi', 'soporte', 'capacitacion', 'datos'], requerido: true },
      { nombre: 'precio', etiqueta: 'Precio', tipo: 'decimal', min: 0, max: 99999999, lista: true, ayuda: 'Dejalo vacío para mostrar "Precio a consultar".' },
      { nombre: 'orden', etiqueta: 'Orden', tipo: 'entero', min: 0, max: 255, requerido: true, lista: true }
    ]
  },

  consultas: {
    tabla: 'consultas',
    etiqueta: 'Consultas',
    singular: 'consulta',
    texto: 'asunto',
    campoFecha: 'fecha',
    acciones: ['crear', 'editar', 'eliminar'],
    ordenInicial: { campo: 'fecha', dir: 'desc' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, min: 2, max: 100, lista: true, buscar: true },
      { nombre: 'email', etiqueta: 'Email', tipo: 'email', requerido: true, max: 150, lista: true, buscar: true },
      { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'texto', max: 30, patron: REGEX_TELEFONO, mensajePatron: 'Solo números, espacios y + - ( ).' },
      { nombre: 'asunto', etiqueta: 'Asunto', tipo: 'texto', requerido: true, min: 3, max: 150, lista: true, buscar: true },
      { nombre: 'mensaje', etiqueta: 'Mensaje', tipo: 'textarea', requerido: true, min: 10, max: 2000 },
      { nombre: 'servicio_id', etiqueta: 'Servicio', tipo: 'relacion', relacion: { entidad: 'servicios' }, lista: true, filtro: true },
      { nombre: 'leida', etiqueta: 'Estado', tipo: 'booleano', etiquetas: ['No leída', 'Leída'], lista: true, filtro: true },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', soloLectura: true, lista: true }
    ]
  },

  administradores: {
    tabla: 'administradores',
    etiqueta: 'Administradores',
    singular: 'administrador',
    texto: 'usuario',
    campoFecha: 'creado_en',
    acciones: ['crear', 'editar', 'eliminar'],
    ordenInicial: { campo: 'id', dir: 'asc' },
    campos: [
      { nombre: 'usuario', etiqueta: 'Usuario', tipo: 'texto', requerido: true, min: 3, max: 50, unico: true, patron: /^[A-Za-z0-9_.-]+$/, mensajePatron: 'Solo letras, números y _ . -', lista: true, buscar: true },
      { nombre: 'password', columna: 'password_hash', etiqueta: 'Contraseña', tipo: 'password', requerido: true, min: 8, max: 72, ayuda: 'Al editar, dejala vacía para no cambiarla.' },
      { nombre: 'creado_en', etiqueta: 'Creado', tipo: 'fecha', soloLectura: true, lista: true }
    ],
    // no se puede borrar a uno mismo ni al último administrador
    async puedeEliminar(admin, id) {
      if (admin.id === id) return 'No podés eliminar tu propio usuario.';
      const [{ total }] = await consultar('SELECT COUNT(*) AS total FROM administradores');
      if (total <= 1) return 'Tiene que quedar al menos un administrador.';
      return null;
    }
  },

  registros: {
    tabla: 'registros',
    etiqueta: 'Registros',
    singular: 'registro',
    texto: 'accion',
    campoFecha: 'fecha',
    acciones: [],
    ordenInicial: { campo: 'fecha', dir: 'desc' },
    campos: [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', soloLectura: true, lista: true },
      { nombre: 'administrador_id', etiqueta: 'Administrador', tipo: 'relacion', relacion: { entidad: 'administradores' }, soloLectura: true, lista: true, filtro: true },
      { nombre: 'accion', etiqueta: 'Acción', tipo: 'texto', soloLectura: true, lista: true, buscar: true },
      { nombre: 'entidad', etiqueta: 'Sección', tipo: 'texto', soloLectura: true, lista: true, buscar: true },
      { nombre: 'entidad_id', etiqueta: 'ID afectado', tipo: 'entero', soloLectura: true, lista: true },
      { nombre: 'detalle', etiqueta: 'Detalle', tipo: 'texto', soloLectura: true, buscar: true }
    ]
  }
};

function columnaDe(campo) {
  return campo.columna || campo.nombre;
}

// revisa un valor según el tipo del campo; devuelve { valor } o { error }
async function convertir(campo, valor) {
  switch (campo.tipo) {
    case 'texto':
    case 'textarea':
    case 'email':
    case 'password': {
      if (typeof valor !== 'string') return { error: 'Tiene que ser texto.' };
      const v = campo.tipo === 'password' ? valor : valor.trim();
      if (campo.min && v.length < campo.min) return { error: `Escribí al menos ${campo.min} caracteres.` };
      if (campo.max && v.length > campo.max) return { error: `No puede tener más de ${campo.max} caracteres.` };
      if (campo.tipo === 'email' && !REGEX_EMAIL.test(v)) return { error: 'Ingresá un email válido.' };
      if (campo.patron && !campo.patron.test(v)) return { error: campo.mensajePatron || 'El formato no es válido.' };
      return { valor: v };
    }
    case 'entero':
    case 'decimal': {
      const n = Number(valor);
      if (!Number.isFinite(n)) return { error: 'Tiene que ser un número.' };
      if (campo.tipo === 'entero' && !Number.isInteger(n)) return { error: 'Tiene que ser un número entero.' };
      if (campo.min !== undefined && n < campo.min) return { error: `No puede ser menor a ${campo.min}.` };
      if (campo.max !== undefined && n > campo.max) return { error: `No puede ser mayor a ${campo.max}.` };
      return { valor: campo.tipo === 'decimal' ? Math.round(n * 100) / 100 : n };
    }
    case 'enum':
      return campo.opciones.includes(valor) ? { valor } : { error: 'Elegí una opción de la lista.' };
    case 'booleano':
      if (valor === true || valor === 1 || valor === '1' || valor === 'true') return { valor: 1 };
      if (valor === false || valor === 0 || valor === '0' || valor === 'false') return { valor: 0 };
      return { error: 'Tiene que ser sí o no.' };
    case 'relacion': {
      const id = String(valor);
      if (!REGEX_ID.test(id)) return { error: 'Elegí un valor de la lista.' };
      const destino = ENTIDADES[campo.relacion.entidad];
      const existe = await consultar(`SELECT id FROM \`${destino.tabla}\` WHERE id = ?`, [id]);
      return existe.length ? { valor: Number(id) } : { error: 'Ese registro no existe.' };
    }
    default:
      return { error: 'Tipo de campo no permitido.' };
  }
}

// valida el cuerpo; devuelve los datos listos para guardar (por nombre de columna) y los errores
// parcial = true en las ediciones: solo se revisan los campos que llegaron
async function validar(entidad, cuerpo, parcial) {
  const datos = {};
  const errores = {};

  for (const campo of entidad.campos) {
    if (campo.soloLectura) continue;
    const llego = Object.prototype.hasOwnProperty.call(cuerpo, campo.nombre);
    if (parcial && !llego) continue;

    const valor = cuerpo[campo.nombre];
    const vacio = valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

    if (vacio) {
      if (campo.tipo === 'password' && parcial) continue;
      if (campo.tipo === 'booleano') datos[columnaDe(campo)] = 0;
      else if (campo.requerido) errores[campo.nombre] = 'Este campo es obligatorio.';
      else datos[columnaDe(campo)] = null;
      continue;
    }

    const { valor: limpio, error } = await convertir(campo, valor);
    if (error) errores[campo.nombre] = error;
    else datos[columnaDe(campo)] = campo.tipo === 'password' ? hashPassword(limpio) : limpio;
  }

  return { datos, errores };
}

// lo que el navegador necesita saber para dibujar cada sección (sin datos internos)
function describir() {
  return Object.entries(ENTIDADES).map(([clave, e]) => ({
    clave,
    etiqueta: e.etiqueta,
    singular: e.singular,
    texto: e.texto,
    acciones: e.acciones,
    ordenInicial: e.ordenInicial,
    tieneFecha: Boolean(e.campoFecha),
    campos: [
      { nombre: 'id', etiqueta: 'ID', tipo: 'id', lista: true, soloLectura: true },
      ...e.campos.map((c) => ({
        nombre: c.nombre,
        etiqueta: c.etiqueta,
        tipo: c.tipo,
        requerido: Boolean(c.requerido),
        soloLectura: Boolean(c.soloLectura),
        opciones: c.opciones,
        etiquetas: c.etiquetas,
        relacion: c.relacion ? c.relacion.entidad : undefined,
        lista: Boolean(c.lista),
        filtro: Boolean(c.filtro),
        max: c.max,
        ayuda: c.ayuda
      }))
    ]
  }));
}

module.exports = { ENTIDADES, columnaDe, validar, describir };
