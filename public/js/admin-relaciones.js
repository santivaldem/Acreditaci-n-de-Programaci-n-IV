// Sección "Relaciones": dibuja las tablas de la base y sus claves foráneas, leídas en vivo desde MySQL
(function () {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';

  const ANCHO = 260;
  const ALTO_TITULO = 36;
  const ALTO_FILA = 24;
  const SEPARACION_X = 130;
  const SEPARACION_Y = 56;
  const MARGEN = 20;

  const REGLAS = {
    'SET NULL': 'El campo queda vacío',
    CASCADE: 'Se borra o actualiza también',
    RESTRICT: 'No lo permite',
    'NO ACTION': 'No lo permite'
  };

  function svg(nombre, atributos = {}, texto) {
    const nodo = document.createElementNS(NS, nombre);
    for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  // deja cada tabla hija al lado de su tabla padre
  function ordenar(tablas, relaciones) {
    const orden = [];
    const agregar = (nombre) => { if (!orden.includes(nombre)) orden.push(nombre); };
    for (const r of relaciones) { agregar(r.destino); agregar(r.tabla); }
    for (const t of tablas) agregar(t.nombre);
    return orden.map((nombre) => tablas.find((t) => t.nombre === nombre));
  }

  function dibujar(datos) {
    const tablas = ordenar(datos.tablas, datos.relaciones);
    const columnas = Math.min(2, tablas.length);
    const alto = (t) => ALTO_TITULO + t.columnas.length * ALTO_FILA + 10;

    const posiciones = new Map();
    const filasAltos = [];
    tablas.forEach((t, i) => {
      const fila = Math.floor(i / columnas);
      filasAltos[fila] = Math.max(filasAltos[fila] || 0, alto(t));
    });
    tablas.forEach((t, i) => {
      const col = i % columnas;
      const fila = Math.floor(i / columnas);
      const y = MARGEN + filasAltos.slice(0, fila).reduce((suma, h) => suma + h + SEPARACION_Y, 0);
      posiciones.set(t.nombre, { x: MARGEN + col * (ANCHO + SEPARACION_X), y, alto: alto(t), col });
    });

    const anchoTotal = MARGEN * 2 + columnas * ANCHO + (columnas - 1) * SEPARACION_X + 60;
    const altoTotal = MARGEN * 2 + filasAltos.reduce((suma, h) => suma + h, 0) + (filasAltos.length - 1) * SEPARACION_Y;

    const dibujo = svg('svg', { viewBox: `0 0 ${anchoTotal} ${altoTotal}`, role: 'img', class: 'diagrama' });
    dibujo.append(
      svg('title', {}, 'Diagrama de relaciones de la base de datos'),
      svg('desc', {}, datos.relaciones.map((r) => `${r.tabla}.${r.columna} apunta a ${r.destino}.${r.destinoColumna}`).join('. '))
    );

    const filaY = (nombreTabla, nombreColumna) => {
      const t = datos.tablas.find((x) => x.nombre === nombreTabla);
      const indice = t.columnas.findIndex((c) => c.nombre === nombreColumna);
      return posiciones.get(nombreTabla).y + ALTO_TITULO + indice * ALTO_FILA + ALTO_FILA / 2;
    };

    // primero las líneas, para que las tablas queden encima
    for (const r of datos.relaciones) {
      const hija = posiciones.get(r.tabla);
      const padre = posiciones.get(r.destino);
      const y1 = filaY(r.tabla, r.columna);
      const y2 = filaY(r.destino, r.destinoColumna);
      let x1, x2, curva;

      if (hija.col === padre.col) {
        x1 = hija.x + ANCHO;
        x2 = padre.x + ANCHO;
        curva = `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 + 60} ${y2}, ${x2} ${y2}`;
      } else if (hija.col > padre.col) {
        x1 = hija.x;
        x2 = padre.x + ANCHO;
        curva = `M ${x1} ${y1} C ${x1 - 60} ${y1}, ${x2 + 60} ${y2}, ${x2} ${y2}`;
      } else {
        x1 = hija.x + ANCHO;
        x2 = padre.x;
        curva = `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`;
      }

      const sentido = x1 < x2 ? 1 : -1;
      dibujo.append(
        svg('path', { d: curva, class: 'dg-linea', fill: 'none' }),
        svg('circle', { cx: x1, cy: y1, r: 4.5, class: 'dg-punto' }),
        svg('circle', { cx: x2, cy: y2, r: 4.5, class: 'dg-punto dg-punto-padre' }),
        svg('text', { x: x1 + sentido * 12, y: y1 - 8, class: 'dg-cardinal', 'text-anchor': sentido > 0 ? 'start' : 'end' }, 'N'),
        svg('text', { x: x2 - sentido * 12, y: y2 - 8, class: 'dg-cardinal', 'text-anchor': sentido > 0 ? 'end' : 'start' }, '1')
      );
    }

    for (const tabla of tablas) {
      const { x, y, alto: h } = posiciones.get(tabla.nombre);
      const caja = svg('g', { class: 'dg-tabla' });
      caja.append(
        svg('rect', { x, y, width: ANCHO, height: h, rx: 10, class: 'dg-caja' }),
        svg('path', { d: `M ${x} ${y + ALTO_TITULO} V ${y + 10} Q ${x} ${y} ${x + 10} ${y} H ${x + ANCHO - 10} Q ${x + ANCHO} ${y} ${x + ANCHO} ${y + 10} V ${y + ALTO_TITULO} Z`, class: 'dg-titulo' }),
        svg('text', { x: x + 14, y: y + ALTO_TITULO / 2 + 5, class: 'dg-nombre' }, tabla.nombre),
        svg('text', { x: x + ANCHO - 14, y: y + ALTO_TITULO / 2 + 4, class: 'dg-filas', 'text-anchor': 'end' }, `${tabla.filas ?? '?'} ${tabla.filas === 1 ? 'fila' : 'filas'}`)
      );

      tabla.columnas.forEach((c, i) => {
        const yFila = y + ALTO_TITULO + i * ALTO_FILA + ALTO_FILA / 2 + 4;
        const marca = c.pk ? 'PK' : c.fk ? 'FK' : '';
        if (marca) caja.append(svg('text', { x: x + 12, y: yFila, class: c.pk ? 'dg-pk' : 'dg-fk' }, marca));
        caja.append(
          svg('text', { x: x + 40, y: yFila, class: 'dg-columna' }, c.nombre),
          svg('text', { x: x + ANCHO - 12, y: yFila, class: 'dg-tipo', 'text-anchor': 'end' }, c.tipo.startsWith('enum') ? 'enum' : c.tipo.replace(' unsigned', 'u').slice(0, 16))
        );
      });
      dibujo.append(caja);
    }

    $('r-diagrama').replaceChildren(dibujo);
  }

  function listar(datos) {
    const cuerpo = $('r-lista');
    cuerpo.replaceChildren();

    for (const r of datos.relaciones) {
      const tr = document.createElement('tr');
      const celdas = [
        `${r.tabla}.${r.columna}`,
        `${r.destino}.${r.destinoColumna}`,
        REGLAS[r.alBorrar] || r.alBorrar,
        REGLAS[r.alActualizar] || r.alActualizar,
        r.filasUsadas === null ? '–' : String(r.filasUsadas)
      ];
      const etiquetas = ['Campo (clave foránea)', 'Apunta a', 'Si se borra el registro padre', 'Si cambia su id', 'Filas vinculadas'];
      celdas.forEach((texto, i) => {
        const td = document.createElement('td');
        td.textContent = texto;
        td.dataset.etiqueta = etiquetas[i];
        tr.append(td);
      });
      cuerpo.append(tr);
    }

    $('r-vacio').hidden = datos.relaciones.length > 0;
  }

  async function mostrar() {
    try {
      const datos = await window.Admin.api('/admin/relaciones');
      $('r-bd').textContent = datos.baseDeDatos;
      dibujar(datos);
      listar(datos);
    } catch (error) {
      if (error.sesionVencida) return;
      $('r-diagrama').replaceChildren(window.Admin.crear('p', 'estado-vacio error', error.message));
    }
  }

  window.Relaciones = { mostrar };
})();
