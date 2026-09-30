const contenedor = document.getElementById('servicios');

const AREAS = [
  { clave: 'hardware', titulo: 'Hardware', bajada: 'Trabajos concretos sobre los equipos.' },
  { clave: 'redes', titulo: 'Redes', bajada: 'Trabajos concretos sobre la red del cliente.' },
  { clave: 'asistencia', titulo: 'Asistencia informática', bajada: 'El área que acompaña al usuario todos los días.' },
  { clave: 'datos', titulo: 'Protección y recuperación de datos', bajada: 'Nuestra especialización.' }
];

// textContent en vez de innerHTML para no ejecutar html que venga de la base
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function textoPrecio(precio) {
  if (precio === null || precio === undefined) return 'Precio a consultar';
  return Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function crearTarjeta(servicio) {
  const destacada = servicio.area === 'datos';
  const tarjeta = crear('article', destacada ? 'tarjeta tarjeta-destacada' : 'tarjeta');
  if (destacada) tarjeta.append(crear('span', 'insignia', 'Nuestra especialidad'));

  const caja = crear('div', 'icono-caja');
  const icono = crear('span', 'icono');
  const nombreIcono = /^[a-z-]+$/.test(servicio.icono) ? servicio.icono : 'chip';
  icono.style.setProperty('--icono', `url('/img/iconos/${nombreIcono}.svg')`);
  caja.append(icono);

  const enlace = crear('a', 'tarjeta-enlace', 'Escribinos por este servicio →');
  enlace.href = `/contacto.html?servicio=${encodeURIComponent(servicio.nombre)}`;

  tarjeta.append(
    caja,
    crear('h3', '', servicio.nombre),
    crear('p', '', servicio.descripcion),
    crear('p', 'precio', textoPrecio(servicio.precio)),
    enlace
  );
  return tarjeta;
}

function dibujar(servicios) {
  const secciones = [];

  for (const area of AREAS) {
    const delArea = servicios.filter((servicio) => servicio.area === area.clave);
    if (delArea.length === 0) continue;

    const seccion = crear('section', 'area-servicios');
    seccion.id = area.clave;

    const cabecera = crear('div', 'area-cabecera');
    cabecera.append(crear('h2', '', area.titulo), crear('p', '', area.bajada));

    const grilla = crear('div', 'grilla');
    grilla.append(...delArea.map(crearTarjeta));

    seccion.append(cabecera, grilla);
    secciones.push(seccion);
  }

  if (secciones.length === 0) {
    mostrarMensaje('Por ahora no hay servicios para mostrar.');
    return;
  }

  contenedor.replaceChildren(...secciones);
  window.revelar?.(contenedor);

  if (location.hash) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }
}

function mostrarMensaje(texto) {
  const aviso = crear('p', 'estado-carga', texto + ' ');
  const enlace = crear('a', '', 'Escribinos');
  enlace.href = '/contacto.html';
  aviso.append(enlace, '.');
  contenedor.replaceChildren(aviso);
}

async function cargarServicios() {
  try {
    const respuesta = await fetch('/api/servicios');
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    dibujar(await respuesta.json());
  } catch (error) {
    console.error('No se pudieron cargar los servicios:', error);
    mostrarMensaje('No pudimos cargar los servicios en este momento. Probá de nuevo en unos minutos o');
  }
}

cargarServicios();
