const CLAVE_TOKEN = 'svad_token';
const CLAVE_USUARIO = 'svad_usuario';
const token = sessionStorage.getItem(CLAVE_TOKEN);

if (!token) {
  location.replace('/admin/login.html');
} else {
  iniciar();
}

function iniciar() {
  const $ = (id) => document.getElementById(id);

  const el = {
    usuario: $('usuario-nombre'),
    botonSalir: $('boton-salir'),
    botonActualizar: $('boton-actualizar'),
    tiles: document.querySelectorAll('.resumen-tile[data-estado]'),
    totalTodas: $('total-todas'),
    totalNoLeidas: $('total-no-leidas'),
    totalLeidas: $('total-leidas'),
    ultimaConsulta: $('ultima-consulta'),
    formFiltros: $('filtros'),
    buscar: $('filtro-buscar'),
    estado: $('filtro-estado'),
    desde: $('filtro-desde'),
    hasta: $('filtro-hasta'),
    limpiar: $('filtros-limpiar'),
    avisoFiltros: $('aviso-filtros'),
    contador: $('contador-resultados'),
    tabla: $('tabla'),
    cuerpo: $('cuerpo-tabla'),
    vacio: $('estado-vacio'),
    cortina: $('cortina'),
    detalle: $('detalle'),
    detalleId: $('detalle-id'),
    detalleTitulo: $('detalle-titulo'),
    detalleCerrar: $('detalle-cerrar'),
    detalleCargando: $('detalle-cargando'),
    detalleContenido: $('detalle-contenido'),
    detalleNombre: $('detalle-nombre'),
    detalleEstado: $('detalle-estado'),
    detalleEmail: $('detalle-email'),
    detalleTelefono: $('detalle-telefono'),
    detalleFecha: $('detalle-fecha'),
    detalleMensaje: $('detalle-mensaje'),
    detalleResponder: $('detalle-responder'),
    detalleMarcar: $('detalle-marcar'),
    aviso: $('aviso-flotante')
  };

  const filtros = { buscar: '', estado: '', desde: '', hasta: '' };
  let consultas = [];
  let totalGeneral = null;
  let numeroPeticion = 0;
  let detalleActual = null;
  let idDetalleAbierto = null;
  let disparadorDetalle = null;
  let temporizadorBusqueda;
  let temporizadorAviso;

  el.usuario.textContent = sessionStorage.getItem(CLAVE_USUARIO) || 'admin';

  function crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function partesFecha(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(texto || '');
    return m ? { fecha: `${m[3]}/${m[2]}/${m[1]}`, hora: `${m[4]}:${m[5]}` } : { fecha: texto || '–', hora: '' };
  }

  function crearPill(leida) {
    return crear('span', leida ? 'pill pill-leida' : 'pill pill-nueva', leida ? 'Leída' : 'No leída');
  }

  function avisar(mensaje, esError = false) {
    clearTimeout(temporizadorAviso);
    el.aviso.textContent = mensaje;
    el.aviso.classList.toggle('error', esError);
    el.aviso.classList.add('visible');
    temporizadorAviso = setTimeout(() => el.aviso.classList.remove('visible'), 3200);
  }

  function limpiarSesion() {
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
  }

  function sesionVencida() {
    limpiarSesion();
    location.replace('/admin/login.html?expirada=1');
  }

  // llamada a la api con el token; si responde 401 vuelve al login
  async function api(ruta, opciones = {}) {
    let respuesta;
    try {
      respuesta = await fetch(`/api${ruta}`, {
        ...opciones,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      throw new Error('No se pudo conectar con el servidor.');
    }

    if (respuesta.status === 401) {
      sesionVencida();
      const error = new Error('Tu sesión venció.');
      error.sesionVencida = true;
      throw error;
    }

    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new Error((datos && datos.error) || `Error ${respuesta.status}`);
    return datos;
  }

  async function cargarResumen() {
    try {
      const todas = await api('/consultas');
      totalGeneral = todas.length;
      el.totalTodas.textContent = todas.length;
      el.totalNoLeidas.textContent = todas.filter((c) => !c.leida).length;
      el.totalLeidas.textContent = todas.filter((c) => c.leida).length;

      if (todas.length > 0) {
        const { fecha, hora } = partesFecha(todas[0].fecha);
        el.ultimaConsulta.textContent = `${fecha} · ${hora}`;
      } else {
        el.ultimaConsulta.textContent = '–';
      }
      actualizarContador();
    } catch (error) {
      if (!error.sesionVencida) console.error('No se pudo cargar el resumen:', error);
    }
  }

  function sincronizarTiles() {
    el.tiles.forEach((tile) => {
      tile.setAttribute('aria-pressed', String(tile.dataset.estado === filtros.estado));
    });
  }

  function hayFiltros() {
    return Object.values(filtros).some(Boolean);
  }

  function actualizarContador() {
    const cantidad = consultas.length;
    let texto = `${cantidad} ${cantidad === 1 ? 'consulta' : 'consultas'}`;
    if (hayFiltros() && totalGeneral !== null) texto += ` de ${totalGeneral} en total`;
    el.contador.textContent = texto;
  }

  function pintarEstado({ titulo, texto, boton, alAccionar, error = false, icono = true }) {
    el.tabla.hidden = true;
    el.vacio.hidden = false;
    el.vacio.className = error ? 'estado-vacio error' : 'estado-vacio';
    const partes = [];

    if (icono) {
      const caja = crear('div', 'icono-caja');
      const simbolo = crear('span', 'icono');
      simbolo.style.setProperty('--icono', "url('/img/iconos/sobre.svg')");
      caja.append(simbolo);
      partes.push(caja);
    }
    if (titulo) partes.push(crear('h2', '', titulo));
    if (texto) partes.push(crear('p', '', texto));
    if (boton) {
      const b = crear('button', 'boton boton-claro boton-chico', boton);
      b.type = 'button';
      b.addEventListener('click', alAccionar);
      partes.push(b);
    }
    el.vacio.replaceChildren(...partes);
  }

  function crearFila(consulta) {
    const fila = crear('tr', consulta.leida ? '' : 'no-leida');
    fila.dataset.id = consulta.id;

    const celdaEstado = crear('td', 'celda-estado');
    celdaEstado.append(crearPill(consulta.leida));

    const celdaNombre = crear('td', 'celda-nombre');
    const abrir = crear('button', 'fila-abrir', consulta.nombre);
    abrir.type = 'button';
    abrir.setAttribute('aria-label', `Abrir la consulta de ${consulta.nombre}: ${consulta.asunto}`);
    celdaNombre.append(abrir);

    const celdaEmail = crear('td', 'celda-email', consulta.email);

    const celdaAsunto = crear('td', 'celda-asunto');
    celdaAsunto.append(crear('span', '', consulta.asunto));

    const { fecha, hora } = partesFecha(consulta.fecha);
    const celdaFecha = crear('td', 'celda-fecha');
    celdaFecha.append(fecha, crear('small', '', hora));

    const celdaAccion = crear('td', 'celda-accion');
    const alternar = crear('button', 'boton-mini', consulta.leida ? 'Marcar no leída' : 'Marcar leída');
    alternar.type = 'button';
    alternar.dataset.accion = 'alternar';
    celdaAccion.append(alternar);

    fila.append(celdaEstado, celdaNombre, celdaEmail, celdaAsunto, celdaFecha, celdaAccion);
    return fila;
  }

  function dibujarLista() {
    actualizarContador();

    if (consultas.length === 0) {
      if (hayFiltros()) {
        pintarEstado({
          titulo: 'Ninguna consulta coincide',
          texto: 'Probá con otra búsqueda o cambiá los filtros.',
          boton: 'Limpiar filtros',
          alAccionar: limpiarFiltros
        });
      } else {
        pintarEstado({
          titulo: 'Todavía no llegaron consultas',
          texto: 'Cuando alguien complete el formulario de contacto, la consulta va a aparecer acá.'
        });
      }
      return;
    }

    el.vacio.hidden = true;
    el.tabla.hidden = false;
    el.cuerpo.replaceChildren(...consultas.map(crearFila));
  }

  // los filtros van en la url: /api/consultas?estado=leidas&buscar=ana
  async function cargarLista() {
    const propia = ++numeroPeticion;

    const parametros = new URLSearchParams();
    for (const [nombre, valor] of Object.entries(filtros)) {
      if (valor) parametros.set(nombre, valor);
    }
    const consulta = parametros.toString();

    try {
      const datos = await api(`/consultas${consulta ? `?${consulta}` : ''}`);
      if (propia !== numeroPeticion) return;
      consultas = datos;
      dibujarLista();
    } catch (error) {
      if (propia !== numeroPeticion) return;
      el.contador.textContent = '';
      pintarEstado({
        titulo: 'No pudimos cargar las consultas',
        texto: error.message,
        boton: 'Reintentar',
        alAccionar: cargarLista,
        error: true,
        icono: false
      });
    }
  }

  function aplicarFiltros() {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      el.avisoFiltros.textContent = 'La fecha "Desde" no puede ser posterior a "Hasta".';
      el.avisoFiltros.hidden = false;
      return;
    }
    el.avisoFiltros.hidden = true;
    cargarLista();
  }

  function limpiarFiltros() {
    Object.keys(filtros).forEach((clave) => { filtros[clave] = ''; });
    el.buscar.value = '';
    el.estado.value = '';
    el.desde.value = '';
    el.hasta.value = '';
    sincronizarTiles();
    aplicarFiltros();
  }

  async function cambiarLeida(id, leida, boton) {
    if (boton) boton.disabled = true;
    try {
      await api(`/consultas/${id}/leida`, { method: 'PATCH', body: JSON.stringify({ leida }) });
      if (detalleActual && detalleActual.id === id) {
        detalleActual.leida = leida;
        pintarDetalle();
      }
      avisar(leida ? 'Consulta marcada como leída.' : 'Consulta marcada como no leída.');
      await Promise.all([cargarLista(), cargarResumen()]);
    } catch (error) {
      avisar(error.message, true);
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  const EMAIL_SEGURO = /^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/;

  function pintarDetalle() {
    const c = detalleActual;
    const { fecha, hora } = partesFecha(c.fecha);

    el.detalleId.textContent = `Consulta #${c.id}`;
    el.detalleTitulo.textContent = c.asunto;
    el.detalleNombre.textContent = c.nombre;
    el.detalleEstado.replaceChildren(crearPill(c.leida));
    el.detalleFecha.textContent = `${fecha} · ${hora} hs`;
    el.detalleMensaje.textContent = c.mensaje;

    if (EMAIL_SEGURO.test(c.email)) {
      const enlace = crear('a', '', c.email);
      enlace.href = `mailto:${c.email}`;
      el.detalleEmail.replaceChildren(enlace);
      el.detalleResponder.href = `mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.asunto}`)}`;
      el.detalleResponder.hidden = false;
    } else {
      el.detalleEmail.textContent = c.email;
      el.detalleResponder.hidden = true;
    }

    if (c.telefono) {
      const enlace = crear('a', '', c.telefono);
      enlace.href = `tel:${c.telefono.replace(/[^\d+]/g, '')}`;
      el.detalleTelefono.replaceChildren(enlace);
    } else {
      el.detalleTelefono.textContent = 'No informado';
    }

    el.detalleMarcar.textContent = c.leida ? 'Marcar como no leída' : 'Marcar como leída';
    el.detalleMarcar.hidden = false;
    el.detalleCargando.hidden = true;
    el.detalleContenido.hidden = false;
  }

  function mostrarPanelDetalle() {
    el.detalleId.textContent = 'Consulta';
    el.detalleTitulo.textContent = 'Cargando…';
    el.detalleCargando.hidden = false;
    el.detalleContenido.hidden = true;
    el.detalleMarcar.hidden = true;
    el.detalleResponder.hidden = true;

    el.cortina.hidden = false;
    el.detalle.hidden = false;
    void el.detalle.offsetWidth;
    el.cortina.classList.add('abierta');
    el.detalle.classList.add('abierto');

    document.querySelector('.panel-cabecera').inert = true;
    document.getElementById('contenido').inert = true;
    document.body.style.overflow = 'hidden';
    el.detalleCerrar.focus();
  }

  function cerrarDetalle() {
    if (el.detalle.hidden) return;
    el.cortina.classList.remove('abierta');
    el.detalle.classList.remove('abierto');
    document.querySelector('.panel-cabecera').inert = false;
    document.getElementById('contenido').inert = false;
    document.body.style.overflow = '';
    detalleActual = null;

    setTimeout(() => {
      if (!el.detalle.classList.contains('abierto')) {
        el.cortina.hidden = true;
        el.detalle.hidden = true;
      }
    }, 320);

    const volver = document.contains(disparadorDetalle)
      ? disparadorDetalle
      : document.querySelector(`tr[data-id="${idDetalleAbierto}"] .fila-abrir`);
    if (volver) volver.focus();
    idDetalleAbierto = null;
  }

  async function abrirDetalle(id, disparador) {
    idDetalleAbierto = id;
    disparadorDetalle = disparador;
    mostrarPanelDetalle();
    try {
      const datos = await api(`/consultas/${id}`);
      detalleActual = datos;
      pintarDetalle();
    } catch (error) {
      cerrarDetalle();
      avisar(error.message, true);
    }
  }

  el.cuerpo.addEventListener('click', (evento) => {
    const fila = evento.target.closest('tr');
    if (!fila) return;
    const id = Number(fila.dataset.id);

    const alternar = evento.target.closest('button[data-accion="alternar"]');
    if (alternar) {
      const consulta = consultas.find((c) => c.id === id);
      if (consulta) cambiarLeida(id, !consulta.leida, alternar);
      return;
    }
    abrirDetalle(id, fila.querySelector('.fila-abrir'));
  });

  el.detalleMarcar.addEventListener('click', () => {
    if (detalleActual) cambiarLeida(detalleActual.id, !detalleActual.leida, el.detalleMarcar);
  });
  el.detalleCerrar.addEventListener('click', cerrarDetalle);
  el.cortina.addEventListener('click', cerrarDetalle);
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') cerrarDetalle();
  });

  el.formFiltros.addEventListener('submit', (evento) => evento.preventDefault());
  el.buscar.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
      filtros.buscar = el.buscar.value.trim();
      aplicarFiltros();
    }, 300);
  });
  el.estado.addEventListener('change', () => {
    filtros.estado = el.estado.value;
    sincronizarTiles();
    aplicarFiltros();
  });
  el.desde.addEventListener('change', () => { filtros.desde = el.desde.value; aplicarFiltros(); });
  el.hasta.addEventListener('change', () => { filtros.hasta = el.hasta.value; aplicarFiltros(); });
  el.limpiar.addEventListener('click', limpiarFiltros);

  el.tiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      filtros.estado = tile.dataset.estado;
      el.estado.value = filtros.estado;
      sincronizarTiles();
      aplicarFiltros();
    });
  });

  el.botonActualizar.addEventListener('click', async () => {
    el.botonActualizar.disabled = true;
    el.botonActualizar.textContent = 'Actualizando…';
    await Promise.all([cargarLista(), cargarResumen()]);
    el.botonActualizar.disabled = false;
    el.botonActualizar.textContent = 'Actualizar';
    avisar('Listado actualizado.');
  });

  el.botonSalir.addEventListener('click', async () => {
    el.botonSalir.disabled = true;
    try {
      await fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
    }
    limpiarSesion();
    location.replace('/admin/login.html?salio=1');
  });

  pintarEstado({ texto: 'Cargando consultas…', icono: false });
  cargarResumen();
  cargarLista();
}
