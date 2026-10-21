// Sección genérica del panel: una sola pantalla que sirve para cualquier tabla.
// Se arma con la descripción que manda /api/admin/entidades, así una tabla nueva no pide código nuevo acá.
(function () {
  const $ = (id) => document.getElementById(id);
  const crear = (...args) => window.Admin.crear(...args);

  const el = {
    titulo: $('g-titulo'), subtitulo: $('g-subtitulo'), nuevo: $('g-nuevo'),
    filtros: $('g-filtros'), buscar: $('g-buscar'), extra: $('g-filtros-extra'), limpiar: $('g-limpiar'),
    contador: $('g-contador'), porPagina: $('g-por-pagina'),
    tabla: $('g-tabla'), caption: $('g-caption'), cabeza: $('g-cabeza'), cuerpo: $('g-cuerpo'), vacio: $('g-vacio'),
    paginacion: $('g-paginacion'),
    formulario: $('dialogo-formulario'), fTitulo: $('df-titulo'), fForm: $('df-form'), fCampos: $('df-campos'), fError: $('df-error'), fGuardar: $('df-guardar'),
    detalle: $('dialogo-detalle'), dTitulo: $('dd-titulo'), dDatos: $('dd-datos'), dVinculos: $('dd-vinculos'), dEditar: $('dd-editar'),
    confirmar: $('dialogo-confirmar'), cTexto: $('dc-texto'), cAceptar: $('dc-aceptar')
  };

  let todas = [];
  let porPaginaOpciones = [10, 25, 50];
  let entidad = null;
  let estado = null;
  let filas = [];
  let numeroPeticion = 0;
  let temporizadorBusqueda;
  let editandoId = null;
  let idAEliminar = null;
  let versionPantalla = 0;

  const puede = (accion) => entidad.acciones.includes(accion);

  function estadoInicial() {
    return { buscar: '', filtros: {}, desde: '', hasta: '', orden: entidad.ordenInicial.campo, dir: entidad.ordenInicial.dir, pagina: 1, porPagina: porPaginaOpciones[0] };
  }

  function formatearValor(campo, fila) {
    const valor = fila[campo.nombre];
    switch (campo.tipo) {
      case 'id': return `#${valor}`;
      case 'booleano': {
        const pill = crear('span', valor ? 'pill pill-leida' : 'pill pill-nueva', (campo.etiquetas || ['No', 'Sí'])[valor ? 1 : 0]);
        return pill;
      }
      case 'relacion': return fila[`${campo.nombre}_texto`] || '—';
      case 'fecha': return window.Admin.fecha(valor);
      case 'decimal': return valor === null ? '—' : Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
      default: return valor === null || valor === '' ? '—' : String(valor);
    }
  }

  // --- armado de la pantalla según la sección ---

  async function opcionesDe(campo) {
    if (campo.tipo === 'enum') return campo.opciones.map((o) => ({ valor: o, texto: o }));
    if (campo.tipo === 'booleano') return [{ valor: '0', texto: campo.etiquetas[0] }, { valor: '1', texto: campo.etiquetas[1] }];
    const lista = await window.Admin.api(`/admin/${campo.relacion}/opciones`);
    return lista.map((o) => ({ valor: String(o.id), texto: o.texto }));
  }

  async function armarFiltros(version) {
    const nodos = [];

    for (const campo of entidad.campos.filter((c) => c.filtro)) {
      const caja = crear('div', 'campo');
      const etiqueta = crear('label', '', campo.etiqueta);
      const selector = crear('select');
      selector.id = `g-f-${campo.nombre}`;
      etiqueta.htmlFor = selector.id;
      selector.append(new Option('Todos', ''));
      if (campo.tipo === 'relacion') selector.append(new Option('Sin asignar', 'ninguno'));
      for (const o of await opcionesDe(campo)) selector.append(new Option(o.texto, o.valor));
      selector.addEventListener('change', () => {
        estado.filtros[campo.nombre] = selector.value;
        estado.pagina = 1;
        cargar();
      });
      caja.append(etiqueta, selector);
      nodos.push(caja);
    }

    if (entidad.tieneFecha) {
      for (const [clave, texto] of [['desde', 'Desde'], ['hasta', 'Hasta']]) {
        const caja = crear('div', 'campo');
        const etiqueta = crear('label', '', texto);
        const entrada = crear('input');
        entrada.type = 'date';
        entrada.id = `g-${clave}`;
        etiqueta.htmlFor = entrada.id;
        entrada.addEventListener('change', () => {
          estado[clave] = entrada.value;
          estado.pagina = 1;
          cargar();
        });
        caja.append(etiqueta, entrada);
        nodos.push(caja);
      }
    }

    if (version === versionPantalla) el.extra.replaceChildren(...nodos);
  }

  function armarCabecera() {
    el.cabeza.replaceChildren();

    for (const campo of entidad.campos.filter((c) => c.lista)) {
      const th = crear('th');
      th.scope = 'col';
      if (campo.tipo === 'textarea') {
        th.textContent = campo.etiqueta;
      } else {
        const boton = crear('button', 'orden-boton', campo.etiqueta);
        boton.type = 'button';
        boton.dataset.campo = campo.nombre;
        boton.addEventListener('click', () => {
          estado.dir = estado.orden === campo.nombre && estado.dir === 'asc' ? 'desc' : 'asc';
          estado.orden = campo.nombre;
          estado.pagina = 1;
          cargar();
        });
        th.append(boton);
      }
      th.dataset.campo = campo.nombre;
      el.cabeza.append(th);
    }

    const accion = crear('th');
    accion.scope = 'col';
    accion.append(crear('span', 'solo-lectores', 'Acciones'));
    el.cabeza.append(accion);
  }

  function marcarOrden() {
    el.cabeza.querySelectorAll('th[data-campo]').forEach((th) => {
      const activo = th.dataset.campo === estado.orden;
      if (activo) th.setAttribute('aria-sort', estado.dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  // --- datos ---

  function parametros() {
    const p = new URLSearchParams({ orden: estado.orden, dir: estado.dir, pagina: estado.pagina, porPagina: estado.porPagina });
    if (estado.buscar) p.set('buscar', estado.buscar);
    if (estado.desde) p.set('desde', estado.desde);
    if (estado.hasta) p.set('hasta', estado.hasta);
    for (const [nombre, valor] of Object.entries(estado.filtros)) {
      if (valor) p.set(`f_${nombre}`, valor);
    }
    return p.toString();
  }

  function pintarEstado(titulo, texto, esError = false) {
    el.tabla.hidden = true;
    el.vacio.hidden = false;
    el.vacio.className = esError ? 'estado-vacio error' : 'estado-vacio';
    el.vacio.replaceChildren(...[titulo && crear('h2', '', titulo), texto && crear('p', '', texto)].filter(Boolean));
  }

  async function cargar() {
    const propia = ++numeroPeticion;
    marcarOrden();
    try {
      const respuesta = await window.Admin.api(`/admin/${entidad.clave}?${parametros()}`);
      if (propia !== numeroPeticion) return;
      filas = respuesta.datos;
      estado.pagina = respuesta.pagina;
      dibujar(respuesta);
    } catch (error) {
      if (propia !== numeroPeticion || error.sesionVencida) return;
      el.contador.textContent = '';
      el.paginacion.replaceChildren();
      pintarEstado('No pudimos cargar los datos', error.message, true);
    }
  }

  function dibujar(respuesta) {
    const desde = respuesta.total === 0 ? 0 : (respuesta.pagina - 1) * respuesta.porPagina + 1;
    const hasta = Math.min(respuesta.total, respuesta.pagina * respuesta.porPagina);
    el.contador.textContent = respuesta.total === 0 ? '0 registros' : `Mostrando ${desde} a ${hasta} de ${respuesta.total}`;

    if (respuesta.total === 0) {
      const hayFiltros = estado.buscar || estado.desde || estado.hasta || Object.values(estado.filtros).some(Boolean);
      pintarEstado(hayFiltros ? 'Ningún registro coincide' : 'Todavía no hay registros', hayFiltros ? 'Probá con otra búsqueda o limpiá los filtros.' : '');
      el.paginacion.replaceChildren();
      return;
    }

    el.vacio.hidden = true;
    el.tabla.hidden = false;
    const columnas = entidad.campos.filter((c) => c.lista);

    el.cuerpo.replaceChildren(...filas.map((fila) => {
      const tr = crear('tr');
      tr.dataset.id = fila.id;
      for (const campo of columnas) {
        const td = crear('td');
        td.dataset.etiqueta = campo.etiqueta;
        td.append(formatearValor(campo, fila));
        tr.append(td);
      }

      const acciones = crear('td', 'celda-accion');
      if (puede('editar')) acciones.append(botonMini('Editar', 'editar'));
      if (puede('eliminar')) acciones.append(botonMini('Eliminar', 'eliminar'));
      tr.append(acciones);
      return tr;
    }));

    dibujarPaginacion(respuesta);
  }

  function botonMini(texto, accion) {
    const boton = crear('button', 'boton-mini', texto);
    boton.type = 'button';
    boton.dataset.accion = accion;
    return boton;
  }

  function dibujarPaginacion({ pagina, paginas }) {
    el.paginacion.replaceChildren();
    if (paginas <= 1) return;

    const ir = (n, texto, deshabilitado = false, actual = false) => {
      const boton = crear('button', actual ? 'pagina actual' : 'pagina', texto);
      boton.type = 'button';
      boton.disabled = deshabilitado;
      if (actual) boton.setAttribute('aria-current', 'page');
      boton.addEventListener('click', () => { estado.pagina = n; cargar(); });
      el.paginacion.append(boton);
    };

    ir(pagina - 1, '‹ Anterior', pagina === 1);
    const inicio = Math.max(1, Math.min(pagina - 2, paginas - 4));
    for (let n = inicio; n <= Math.min(paginas, inicio + 4); n++) ir(n, String(n), false, n === pagina);
    ir(pagina + 1, 'Siguiente ›', pagina === paginas);
  }

  // --- detalle ---

  async function abrirDetalle(id) {
    try {
      const { dato, dependientes } = await window.Admin.api(`/admin/${entidad.clave}/${id}`);
      el.dTitulo.textContent = `${entidad.singular[0].toUpperCase()}${entidad.singular.slice(1)} #${dato.id}`;

      el.dDatos.replaceChildren();
      for (const campo of entidad.campos.filter((c) => c.tipo !== 'password')) {
        const bloque = crear('div');
        bloque.append(crear('dt', '', campo.etiqueta));
        const dd = crear('dd');
        dd.append(formatearValor(campo, dato));
        bloque.append(dd);
        el.dDatos.append(bloque);
      }

      el.dVinculos.replaceChildren();
      const usados = dependientes.filter((d) => d.total > 0);
      el.dVinculos.append(crear('h3', '', 'Información vinculada'));
      if (usados.length === 0) {
        el.dVinculos.append(crear('p', '', dependientes.length ? 'Ningún registro usa este dato.' : 'Esta sección no es usada por otras.'));
      } else {
        const lista = crear('ul', 'lista-vinculos');
        for (const d of usados) lista.append(crear('li', '', `${d.etiqueta} (${d.campo}): ${d.total}`));
        el.dVinculos.append(lista);
      }

      el.dEditar.hidden = !puede('editar');
      el.dEditar.onclick = () => { el.detalle.close(); abrirFormulario(dato); };
      el.detalle.showModal();
    } catch (error) {
      if (!error.sesionVencida) window.Admin.avisar(error.message, true);
    }
  }

  // --- formulario de crear y editar ---

  async function crearControl(campo, valor) {
    let control;
    if (campo.tipo === 'textarea') {
      control = crear('textarea');
      control.rows = 4;
    } else if (campo.tipo === 'enum' || campo.tipo === 'booleano' || campo.tipo === 'relacion') {
      control = crear('select');
      if (campo.tipo !== 'booleano' && !campo.requerido) control.append(new Option(campo.tipo === 'relacion' ? 'Sin asignar' : '—', ''));
      if (campo.tipo !== 'booleano' && campo.requerido) control.append(new Option('Elegí una opción', ''));
      for (const o of await opcionesDe(campo)) control.append(new Option(o.texto, o.valor));
    } else {
      control = crear('input');
      control.type = { email: 'email', password: 'password', entero: 'number', decimal: 'number' }[campo.tipo] || 'text';
      if (campo.tipo === 'decimal') control.step = '0.01';
      if (campo.tipo === 'password') control.autocomplete = 'new-password';
    }
    control.id = `df-${campo.nombre}`;
    control.name = campo.nombre;
    if (campo.max && ['texto', 'email', 'textarea', 'password'].includes(campo.tipo)) control.maxLength = campo.max;
    if (valor !== undefined && valor !== null && campo.tipo !== 'password') control.value = campo.tipo === 'booleano' ? (valor ? '1' : '0') : String(valor);
    return control;
  }

  async function abrirFormulario(dato) {
    editandoId = dato ? dato.id : null;
    el.fTitulo.textContent = dato ? `Editar ${entidad.singular}` : `Nuevo ${entidad.singular}`;
    el.fError.hidden = true;
    el.fCampos.replaceChildren();

    for (const campo of entidad.campos.filter((c) => !c.soloLectura && c.tipo !== 'id')) {
      const caja = crear('div', 'campo');
      caja.id = `df-campo-${campo.nombre}`;
      const etiqueta = crear('label', '', campo.etiqueta + (campo.requerido && !(campo.tipo === 'password' && dato) ? ' *' : ''));
      const control = await crearControl(campo, dato ? dato[campo.nombre] : campo.tipo === 'booleano' ? 0 : undefined);
      etiqueta.htmlFor = control.id;
      caja.append(etiqueta, control);
      if (campo.ayuda) caja.append(crear('p', 'campo-ayuda', campo.ayuda));
      const error = crear('p', 'mensaje-error');
      error.id = `df-error-${campo.nombre}`;
      error.setAttribute('aria-live', 'polite');
      caja.append(error);
      control.setAttribute('aria-describedby', error.id);
      el.fCampos.append(caja);
    }

    el.formulario.showModal();
    const primero = el.fCampos.querySelector('input, select, textarea');
    if (primero) primero.focus();
  }

  function mostrarErrores(errores) {
    for (const campo of entidad.campos) {
      const caja = $(`df-campo-${campo.nombre}`);
      if (!caja) continue;
      const mensaje = errores[campo.nombre] || '';
      caja.classList.toggle('invalido', Boolean(mensaje));
      $(`df-error-${campo.nombre}`).textContent = mensaje;
    }
    const primero = el.fCampos.querySelector('.invalido input, .invalido select, .invalido textarea');
    if (primero) primero.focus();
  }

  async function guardar(evento) {
    evento.preventDefault();
    el.fError.hidden = true;
    mostrarErrores({});

    const cuerpo = {};
    for (const campo of entidad.campos.filter((c) => !c.soloLectura && c.tipo !== 'id')) {
      const valor = $(`df-${campo.nombre}`).value;
      if (campo.tipo === 'password' && editandoId && valor === '') continue;
      cuerpo[campo.nombre] = valor;
    }

    el.fGuardar.disabled = true;
    try {
      const ruta = editandoId ? `/admin/${entidad.clave}/${editandoId}` : `/admin/${entidad.clave}`;
      await window.Admin.api(ruta, { method: editandoId ? 'PUT' : 'POST', body: JSON.stringify(cuerpo) });
      el.formulario.close();
      window.Admin.avisar(editandoId ? 'Cambios guardados.' : 'Registro creado.');
      await cargar();
    } catch (error) {
      if (error.sesionVencida) return;
      if (error.errores) {
        mostrarErrores(error.errores);
        if (error.errores.general) { el.fError.textContent = error.errores.general; el.fError.hidden = false; }
      } else {
        el.fError.textContent = error.message;
        el.fError.hidden = false;
      }
    } finally {
      el.fGuardar.disabled = false;
    }
  }

  // --- eliminar ---

  async function pedirEliminar(id) {
    try {
      const { dato, dependientes } = await window.Admin.api(`/admin/${entidad.clave}/${id}`);
      const usados = dependientes.filter((d) => d.total > 0);
      let mensaje = `¿Eliminar ${entidad.singular} "${dato[entidad.texto]}"? Esta acción no se puede deshacer.`;
      if (usados.length > 0) {
        mensaje += ` Hay información vinculada (${usados.map((d) => `${d.etiqueta}: ${d.total}`).join(', ')}): no se borra, pero pierde este vínculo.`;
      }
      idAEliminar = id;
      el.cTexto.textContent = mensaje;
      el.confirmar.showModal();
    } catch (error) {
      if (!error.sesionVencida) window.Admin.avisar(error.message, true);
    }
  }

  async function eliminar() {
    el.cAceptar.disabled = true;
    try {
      await window.Admin.api(`/admin/${entidad.clave}/${idAEliminar}`, { method: 'DELETE' });
      el.confirmar.close();
      window.Admin.avisar('Registro eliminado.');
      await cargar();
    } catch (error) {
      el.confirmar.close();
      if (!error.sesionVencida) window.Admin.avisar(error.message, true);
    } finally {
      el.cAceptar.disabled = false;
    }
  }

  // --- eventos (se registran una sola vez) ---

  el.cuerpo.addEventListener('click', (evento) => {
    const tr = evento.target.closest('tr');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    const boton = evento.target.closest('button[data-accion]');

    if (boton && boton.dataset.accion === 'editar') {
      window.Admin.api(`/admin/${entidad.clave}/${id}`).then(({ dato }) => abrirFormulario(dato)).catch((e) => !e.sesionVencida && window.Admin.avisar(e.message, true));
    } else if (boton) {
      pedirEliminar(id);
    } else {
      abrirDetalle(id);
    }
  });

  el.nuevo.addEventListener('click', () => abrirFormulario(null));
  el.fForm.addEventListener('submit', guardar);
  $('df-cancelar').addEventListener('click', () => el.formulario.close());
  $('dd-cerrar').addEventListener('click', () => el.detalle.close());
  $('dc-cancelar').addEventListener('click', () => el.confirmar.close());
  el.cAceptar.addEventListener('click', eliminar);
  el.filtros.addEventListener('submit', (e) => e.preventDefault());

  el.buscar.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
      estado.buscar = el.buscar.value.trim();
      estado.pagina = 1;
      cargar();
    }, 300);
  });

  el.porPagina.addEventListener('change', () => {
    estado.porPagina = Number(el.porPagina.value);
    estado.pagina = 1;
    cargar();
  });

  el.limpiar.addEventListener('click', () => {
    estado = { ...estadoInicial(), porPagina: estado.porPagina };
    el.buscar.value = '';
    el.extra.querySelectorAll('select, input').forEach((c) => { c.value = ''; });
    cargar();
  });

  // --- entrada ---

  async function mostrar(clave) {
    try {
      const respuesta = await window.Admin.entidades();
      todas = respuesta.entidades;
      porPaginaOpciones = respuesta.porPagina;
    } catch (error) {
      if (!error.sesionVencida) pintarEstado('No pudimos cargar la sección', error.message, true);
      return;
    }

    entidad = todas.find((e) => e.clave === clave);
    if (!entidad) {
      el.titulo.textContent = 'Sección no encontrada';
      el.subtitulo.textContent = '';
      el.nuevo.hidden = true;
      pintarEstado('Esa sección no existe', 'Elegí una del menú.');
      return;
    }

    estado = estadoInicial();
    numeroPeticion++;
    const version = ++versionPantalla;
    el.titulo.textContent = entidad.etiqueta;
    el.subtitulo.textContent = entidad.acciones.length === 0 ? 'Solo lectura: se completa sola con las acciones del panel.' : `Tabla ${entidad.clave}: buscá, ordená, creá, editá o eliminá registros.`;
    el.caption.textContent = `Listado de ${entidad.etiqueta.toLowerCase()}`;
    el.nuevo.hidden = !puede('crear');
    el.nuevo.textContent = `Nuevo ${entidad.singular}`;
    el.buscar.value = '';
    el.porPagina.replaceChildren(...porPaginaOpciones.map((n) => new Option(`${n} por página`, n)));
    el.cuerpo.replaceChildren();
    pintarEstado('', 'Cargando…');

    armarCabecera();
    await armarFiltros(version);
    if (version === versionPantalla) await cargar();
  }

  window.Gestion = { mostrar };
})();
