const CLAVE_TOKEN = 'svad_token';
const CLAVE_USUARIO = 'svad_usuario';

const formulario = document.getElementById('formulario-login');
const inputUsuario = document.getElementById('usuario');
const inputPassword = document.getElementById('password');
const botonIngresar = document.getElementById('boton-ingresar');
const botonVerClave = document.getElementById('ver-clave');
const errorLogin = document.getElementById('error-login');
const avisoSesion = document.getElementById('aviso-sesion');

if (sessionStorage.getItem(CLAVE_TOKEN)) {
  location.replace('/admin/panel.html');
}

const parametros = new URLSearchParams(location.search);
if (parametros.has('expirada')) {
  avisoSesion.textContent = 'Tu sesión venció. Volvé a ingresar para continuar.';
  avisoSesion.hidden = false;
} else if (parametros.has('salio')) {
  avisoSesion.textContent = 'Cerraste sesión correctamente.';
  avisoSesion.hidden = false;
}

function mostrarErrorCampo(campo, mensaje) {
  document.getElementById(`campo-${campo}`).classList.toggle('invalido', Boolean(mensaje));
  document.getElementById(`error-${campo}`).textContent = mensaje;
  document.getElementById(campo).setAttribute('aria-invalid', mensaje ? 'true' : 'false');
}

function mostrarErrorLogin(mensaje) {
  errorLogin.textContent = mensaje;
  errorLogin.hidden = !mensaje;
}

botonVerClave.addEventListener('click', () => {
  const visible = inputPassword.type === 'text';
  inputPassword.type = visible ? 'password' : 'text';
  botonVerClave.textContent = visible ? 'Mostrar' : 'Ocultar';
  botonVerClave.setAttribute('aria-pressed', String(!visible));
});

inputUsuario.addEventListener('input', () => { mostrarErrorCampo('usuario', ''); mostrarErrorLogin(''); });
inputPassword.addEventListener('input', () => { mostrarErrorCampo('password', ''); mostrarErrorLogin(''); });

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarErrorLogin('');

  const usuario = inputUsuario.value.trim();
  const password = inputPassword.value;

  mostrarErrorCampo('usuario', usuario ? '' : 'Ingresá tu usuario.');
  mostrarErrorCampo('password', password ? '' : 'Ingresá tu contraseña.');
  if (!usuario) return inputUsuario.focus();
  if (!password) return inputPassword.focus();

  botonIngresar.disabled = true;
  botonIngresar.textContent = 'Ingresando…';

  try {
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });
    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.ok && datos.token) {
      sessionStorage.setItem(CLAVE_TOKEN, datos.token);
      sessionStorage.setItem(CLAVE_USUARIO, datos.usuario);
      location.replace('/admin/panel.html');
      return;
    }

    mostrarErrorLogin(datos.error || 'No pudimos iniciar sesión. Intentá de nuevo.');
    inputPassword.select();
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    mostrarErrorLogin('No se pudo conectar con el servidor. Revisá que esté iniciado e intentá de nuevo.');
  } finally {
    botonIngresar.disabled = false;
    botonIngresar.textContent = 'Ingresar';
  }
});
