const express = require('express');
const { consultar, registrar } = require('../db');
const { requiereAuth } = require('../auth');
const { ENTIDADES, columnaDe, validar, describir } = require('../entidades');

const router = express.Router();

// todo lo que está acá exige iniciar sesión
router.use(requiereAuth);

const REGEX_ID = /^\d+$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const POR_PAGINA = [10, 25, 50];

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const campoTexto = (entidad) => entidad.campos.find((c) => c.nombre === entidad.texto);

// los nombres de tablas y columnas salen siempre de entidades.js, nunca del pedido
function buscarEntidad(req, res, next) {
  const entidad = ENTIDADES[req.params.entidad];
  if (!entidad) return res.status(404).json({ error: 'Esa sección no existe.' });
  req.entidad = entidad;
  next();
}

function permitir(accion) {
  return (req, res, next) => {
    if (req.entidad.acciones.includes(accion)) return next();
    res.status(403).json({ error: 'Esa acción no está permitida en esta sección.' });
  };
}

function idValido(req, res, next) {
  if (!REGEX_ID.test(req.params.id)) return res.status(400).json({ error: 'El id debe ser un número.' });
  next();
}

// SELECT con los campos visibles y el texto de las relaciones (sin contraseñas)
function armarSelect(entidad) {
  const columnas = ['t.id'];
  const uniones = [];

  for (const campo of entidad.campos) {
    if (campo.tipo === 'password') continue;
    columnas.push(`t.\`${columnaDe(campo)}\` AS \`${campo.nombre}\``);

    if (campo.tipo === 'relacion') {
      const destino = ENTIDADES[campo.relacion.entidad];
      const alias = `r_${campo.nombre}`;
      uniones.push(`LEFT JOIN \`${destino.tabla}\` ${alias} ON ${alias}.id = t.\`${columnaDe(campo)}\``);
      columnas.push(`${alias}.\`${columnaDe(campoTexto(destino))}\` AS \`${campo.nombre}_texto\``);
    }
  }

  return `SELECT ${columnas.join(', ')} FROM \`${entidad.tabla}\` t ${uniones.join(' ')}`;
}

function formatear(entidad, fila) {
  const salida = { ...fila };
  for (const campo of entidad.campos) {
    if (campo.tipo === 'booleano') salida[campo.nombre] = Boolean(fila[campo.nombre]);
  }
  return salida;
}

// qué otras secciones apuntan a esta (ej.: consultas apunta a servicios)
function dependientesDe(clave) {
  const lista = [];
  for (const [otraClave, otra] of Object.entries(ENTIDADES)) {
    for (const campo of otra.campos) {
      if (campo.tipo === 'relacion' && campo.relacion.entidad === clave) {
        lista.push({ entidad: otraClave, etiqueta: otra.etiqueta, campo });
      }
    }
  }
  return lista;
}

async function contarDependientes(clave, id) {
  const resultado = [];
  for (const dep of dependientesDe(clave)) {
    const otra = ENTIDADES[dep.entidad];
    const [{ total }] = await consultar(
      `SELECT COUNT(*) AS total FROM \`${otra.tabla}\` WHERE \`${columnaDe(dep.campo)}\` = ?`,
      [id]
    );
    resultado.push({ entidad: dep.entidad, etiqueta: dep.etiqueta, campo: dep.campo.etiqueta, total });
  }
  return resultado;
}

function errorDuplicado(entidad, err) {
  if (err.code !== 'ER_DUP_ENTRY') return null;
  const unico = entidad.campos.find((c) => c.unico);
  return unico ? { [unico.nombre]: 'Ya existe un registro con ese valor.' } : { general: 'Ya existe un registro igual.' };
}

// --- información para armar el panel ---

router.get('/entidades', (req, res) => {
  res.json({ entidades: describir(), porPagina: POR_PAGINA });
});

// relaciones reales de la base: claves foráneas leídas desde information_schema
router.get('/relaciones', async (req, res) => {
  const [{ bd }] = await consultar('SELECT DATABASE() AS bd');

  const columnas = await consultar(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo, IS_NULLABLE AS nulo, COLUMN_KEY AS clave
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [bd]
  );
  const claves = await consultar(
    `SELECT k.TABLE_NAME AS tabla, k.COLUMN_NAME AS columna, k.REFERENCED_TABLE_NAME AS destino,
            k.REFERENCED_COLUMN_NAME AS destinoColumna, r.DELETE_RULE AS alBorrar, r.UPDATE_RULE AS alActualizar
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY k.TABLE_NAME, k.COLUMN_NAME`,
    [bd]
  );

  const tablas = [];
  for (const c of columnas) {
    let tabla = tablas.find((t) => t.nombre === c.tabla);
    if (!tabla) {
      tabla = { nombre: c.tabla, columnas: [] };
      tablas.push(tabla);
    }
    const fk = claves.find((k) => k.tabla === c.tabla && k.columna === c.columna);
    tabla.columnas.push({
      nombre: c.columna,
      tipo: c.tipo,
      nulo: c.nulo === 'YES',
      pk: c.clave === 'PRI',
      fk: fk ? `${fk.destino}.${fk.destinoColumna}` : null
    });
  }

  const nombreSeguro = /^\w+$/;
  for (const tabla of tablas) {
    if (!nombreSeguro.test(tabla.nombre)) continue;
    const [{ total }] = await consultar(`SELECT COUNT(*) AS total FROM \`${tabla.nombre}\``);
    tabla.filas = total;
  }

  const relaciones = [];
  for (const k of claves) {
    let usadas = null;
    if (nombreSeguro.test(k.tabla) && nombreSeguro.test(k.columna)) {
      [{ usadas }] = await consultar(`SELECT COUNT(*) AS usadas FROM \`${k.tabla}\` WHERE \`${k.columna}\` IS NOT NULL`);
    }
    relaciones.push({
      tabla: k.tabla,
      columna: k.columna,
      destino: k.destino,
      destinoColumna: k.destinoColumna,
      alBorrar: k.alBorrar,
      alActualizar: k.alActualizar,
      filasUsadas: usadas
    });
  }

  res.json({ baseDeDatos: bd, tablas, relaciones });
});

// --- listado con búsqueda, filtros, orden y paginación ---

router.get('/:entidad', buscarEntidad, async (req, res) => {
  const entidad = req.entidad;
  const q = req.query;
  const condiciones = [];
  const valores = [];

  const buscar = texto(q.buscar);
  const camposBuscar = entidad.campos.filter((c) => c.buscar);
  if (buscar && camposBuscar.length > 0) {
    const patron = `%${buscar.replace(/[\\%_]/g, '\\$&')}%`;
    condiciones.push(`(${camposBuscar.map((c) => `t.\`${columnaDe(c)}\` LIKE ?`).join(' OR ')})`);
    camposBuscar.forEach(() => valores.push(patron));
  }

  for (const campo of entidad.campos.filter((c) => c.filtro)) {
    const valor = texto(q[`f_${campo.nombre}`]);
    if (!valor) continue;
    const columna = `t.\`${columnaDe(campo)}\``;

    if (campo.tipo === 'relacion' && valor === 'ninguno') condiciones.push(`${columna} IS NULL`);
    else if (campo.tipo === 'relacion' && REGEX_ID.test(valor)) { condiciones.push(`${columna} = ?`); valores.push(Number(valor)); }
    else if (campo.tipo === 'booleano' && (valor === '0' || valor === '1')) { condiciones.push(`${columna} = ?`); valores.push(Number(valor)); }
    else if (campo.tipo === 'enum' && campo.opciones.includes(valor)) { condiciones.push(`${columna} = ?`); valores.push(valor); }
  }

  if (entidad.campoFecha) {
    const columna = `t.\`${entidad.campoFecha}\``;
    const desde = texto(q.desde);
    const hasta = texto(q.hasta);
    if (REGEX_FECHA.test(desde)) { condiciones.push(`${columna} >= ?`); valores.push(`${desde} 00:00:00`); }
    if (REGEX_FECHA.test(hasta)) { condiciones.push(`${columna} <= ?`); valores.push(`${hasta} 23:59:59`); }
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  // solo se puede ordenar por columnas que existen en la configuración
  const ordenable = entidad.campos.find((c) => c.nombre === q.orden && c.tipo !== 'password' && c.tipo !== 'textarea');
  const campoOrden = q.orden === 'id' ? 'id' : ordenable ? ordenable.nombre : entidad.ordenInicial.campo;
  const direccion = q.dir === 'asc' || q.dir === 'desc' ? q.dir : entidad.ordenInicial.dir;
  const campoDeOrden = entidad.campos.find((c) => c.nombre === campoOrden);
  const expresionOrden = campoOrden === 'id' ? 't.id' : campoDeOrden.tipo === 'relacion' ? `\`${campoOrden}_texto\`` : `t.\`${columnaDe(campoDeOrden)}\``;

  const porPagina = POR_PAGINA.includes(Number(q.porPagina)) ? Number(q.porPagina) : POR_PAGINA[0];
  const [{ total }] = await consultar(`SELECT COUNT(*) AS total FROM \`${entidad.tabla}\` t ${donde}`, valores);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(parseInt(q.pagina, 10) || 1, 1), paginas);

  const filas = await consultar(
    `${armarSelect(entidad)} ${donde} ORDER BY ${expresionOrden} ${direccion.toUpperCase()}, t.id DESC LIMIT ? OFFSET ?`,
    [...valores, porPagina, (pagina - 1) * porPagina]
  );

  res.json({ datos: filas.map((f) => formatear(entidad, f)), total, pagina, porPagina, paginas });
});

// lista corta (id y texto) para llenar los desplegables de las relaciones
router.get('/:entidad/opciones', buscarEntidad, async (req, res) => {
  const entidad = req.entidad;
  const columna = columnaDe(campoTexto(entidad));
  const filas = await consultar(`SELECT id, \`${columna}\` AS texto FROM \`${entidad.tabla}\` ORDER BY \`${columna}\` LIMIT 500`);
  res.json(filas);
});

router.get('/:entidad/:id', buscarEntidad, idValido, async (req, res) => {
  const entidad = req.entidad;
  const filas = await consultar(`${armarSelect(entidad)} WHERE t.id = ?`, [req.params.id]);
  if (filas.length === 0) return res.status(404).json({ error: 'No se encontró el registro.' });

  res.json({
    dato: formatear(entidad, filas[0]),
    dependientes: await contarDependientes(req.params.entidad, Number(req.params.id))
  });
});

// --- crear, editar y eliminar (cada acción queda en la tabla registros) ---

router.post('/:entidad', buscarEntidad, permitir('crear'), async (req, res) => {
  const entidad = req.entidad;
  const { datos, errores } = await validar(entidad, req.body ?? {}, false);
  if (Object.keys(errores).length > 0) return res.status(400).json({ error: 'Datos inválidos.', errores });

  const columnas = Object.keys(datos);
  let resultado;
  try {
    resultado = await consultar(
      `INSERT INTO \`${entidad.tabla}\` (${columnas.map((c) => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      columnas.map((c) => datos[c])
    );
  } catch (err) {
    const duplicado = errorDuplicado(entidad, err);
    if (duplicado) return res.status(400).json({ error: 'Datos inválidos.', errores: duplicado });
    throw err;
  }

  const principal = datos[columnaDe(campoTexto(entidad))];
  await registrar(req.admin.id, 'crear', req.params.entidad, resultado.insertId, `${entidad.singular}: ${principal}`);
  res.status(201).json({ id: resultado.insertId });
});

router.put('/:entidad/:id', buscarEntidad, idValido, permitir('editar'), async (req, res) => {
  const entidad = req.entidad;
  const existe = await consultar(`SELECT id FROM \`${entidad.tabla}\` WHERE id = ?`, [req.params.id]);
  if (existe.length === 0) return res.status(404).json({ error: 'No se encontró el registro.' });

  const { datos, errores } = await validar(entidad, req.body ?? {}, true);
  if (Object.keys(errores).length > 0) return res.status(400).json({ error: 'Datos inválidos.', errores });

  const columnas = Object.keys(datos);
  if (columnas.length === 0) return res.status(400).json({ error: 'No hay cambios para guardar.' });

  try {
    await consultar(
      `UPDATE \`${entidad.tabla}\` SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...columnas.map((c) => datos[c]), req.params.id]
    );
  } catch (err) {
    const duplicado = errorDuplicado(entidad, err);
    if (duplicado) return res.status(400).json({ error: 'Datos inválidos.', errores: duplicado });
    throw err;
  }

  await registrar(req.admin.id, 'editar', req.params.entidad, Number(req.params.id), `Campos: ${columnas.map((c) => (c === 'password_hash' ? 'password' : c)).join(', ')}`);
  res.json({ id: Number(req.params.id) });
});

router.delete('/:entidad/:id', buscarEntidad, idValido, permitir('eliminar'), async (req, res) => {
  const entidad = req.entidad;
  const id = Number(req.params.id);
  const filas = await consultar(`${armarSelect(entidad)} WHERE t.id = ?`, [id]);
  if (filas.length === 0) return res.status(404).json({ error: 'No se encontró el registro.' });

  if (entidad.puedeEliminar) {
    const motivo = await entidad.puedeEliminar(req.admin, id);
    if (motivo) return res.status(403).json({ error: motivo });
  }

  const afectados = (await contarDependientes(req.params.entidad, id)).reduce((suma, d) => suma + d.total, 0);
  await consultar(`DELETE FROM \`${entidad.tabla}\` WHERE id = ?`, [id]);

  const nombre = filas[0][entidad.texto];
  await registrar(req.admin.id, 'eliminar', req.params.entidad, id, `${entidad.singular}: ${nombre} (${afectados} registros vinculados)`);
  res.json({ id, vinculadosActualizados: afectados });
});

module.exports = router;
