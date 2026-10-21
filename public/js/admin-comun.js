// lo que comparten las secciones del panel: sesión, llamadas a la API, avisos y menú
(function () {
  const CLAVE_TOKEN = 'svad_token';
  const CLAVE_USUARIO = 'svad_usuario';
  let temporizadorAviso;
  let promesaEntidades;
  let primeraVez = true;

  const Admin = {
    token: () => sessionStorage.getItem(CLAVE_TOKEN),

    crear(etiqueta, clase, texto) {
      const elemento = document.createElement(etiqueta);
      if (clase) elemento.className = clase;
      if (texto !== undefined) elemento.textContent = texto;
      return elemento;
    },

    avisar(mensaje, esError = false) {
      const aviso = document.getElementById('aviso-flotante');
      clearTimeout(temporizadorAviso);
      aviso.textContent = mensaje;
      aviso.classList.toggle('error', esError);
      aviso.classList.add('visible');
      temporizadorAviso = setTimeout(() => aviso.classList.remove('visible'), 3200);
    },

    sesionVencida() {
      sessionStorage.removeItem(CLAVE_TOKEN);
      sessionStorage.removeItem(CLAVE_USUARIO);
      location.replace('/admin/login.html?expirada=1');
    },

    // llama a la API con el token; si responde 401 vuelve al login
    async api(ruta, opciones = {}) {
      let respuesta;
      try {
        respuesta = await fetch(`/api${ruta}`, {
          ...opciones,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Admin.token()}` }
        });
      } catch (error) {
        throw new Error('No se pudo conectar con el servidor.');
      }

      if (respuesta.status === 401) {
        Admin.sesionVencida();
        const error = new Error('Tu sesión venció.');
        error.sesionVencida = true;
        throw error;
      }

      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        const error = new Error((datos && datos.error) || `Error ${respuesta.status}`);
        error.errores = datos && datos.errores;
        throw error;
      }
      return datos;
    },

    // descripción de cada sección (campos, tipos, relaciones); se pide una sola vez
    entidades() {
      if (!promesaEntidades) {
        promesaEntidades = Admin.api('/admin/entidades').catch((error) => {
          promesaEntidades = null;
          throw error;
        });
      }
      return promesaEntidades;
    },

    fecha(texto) {
      const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(texto || '');
      return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : texto || '–';
    },

    // muestra la vista que pide la dirección (#bandeja, #servicios, #relaciones...)
    async irA() {
      const clave = location.hash.slice(1) || 'bandeja';
      const vistas = { bandeja: 'vista-bandeja', relaciones: 'vista-relaciones' };
      const idVista = vistas[clave] || 'vista-gestion';

      for (const id of ['vista-bandeja', 'vista-gestion', 'vista-relaciones']) {
        document.getElementById(id).hidden = id !== idVista;
      }
      document.querySelectorAll('#panel-nav a').forEach((enlace) => {
        if (enlace.getAttribute('href') === `#${clave}`) enlace.setAttribute('aria-current', 'page');
        else enlace.removeAttribute('aria-current');
      });

      if (clave === 'bandeja') {
        if (!primeraVez) document.getElementById('boton-actualizar').click();
      } else if (clave === 'relaciones') {
        window.Relaciones.mostrar();
      } else {
        window.Gestion.mostrar(clave);
      }
      primeraVez = false;
    },

    // arma el menú con la bandeja, cada sección de la base y las relaciones
    async armarMenu() {
      const menu = document.getElementById('panel-nav');
      const enlace = (clave, texto) => {
        const a = Admin.crear('a', '', texto);
        a.href = `#${clave}`;
        return a;
      };

      menu.append(enlace('bandeja', 'Bandeja'));
      try {
        const { entidades } = await Admin.entidades();
        for (const e of entidades) menu.append(enlace(e.clave, e.etiqueta));
      } catch (error) {
        if (!error.sesionVencida) console.error('No se pudo armar el menú:', error);
      }
      menu.append(enlace('relaciones', 'Relaciones'));
      Admin.irA();
    }
  };

  window.Admin = Admin;
  window.addEventListener('hashchange', Admin.irA);
  document.addEventListener('DOMContentLoaded', () => {
    if (Admin.token()) Admin.armarMenu();
  });
})();
