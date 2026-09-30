const formulario = document.getElementById('formulario-contacto');
const avisoEnvio = document.getElementById('aviso-envio');
const botonEnviar = document.getElementById('boton-enviar');
const panelExito = document.getElementById('exito');
const contadorMensaje = document.getElementById('contador-mensaje');

const CAMPOS = ['nombre', 'email', 'telefono', 'asunto', 'mensaje'];
const MINIMO_MENSAJE = 10;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^[0-9+\-()\s]{6,30}$/;

// devuelve el error del campo, o '' si está bien (mismas reglas que el servidor)
function validar(campo, valor) {
  const texto = valor.trim();

  switch (campo) {
    case 'nombre':
      if (!texto) return 'Contanos cómo te llamás para que podamos responderte.';
      if (texto.length < 2) return 'Escribí tu nombre (al menos 2 letras).';
      return '';
    case 'email':
      if (!texto) return 'Necesitamos tu email para poder responderte.';
      if (!REGEX_EMAIL.test(texto)) return 'Revisá el email: tiene que ser como nombre@ejemplo.com.';
      return '';
    case 'telefono':
      if (texto && !REGEX_TELEFONO.test(texto)) return 'Si nos dejás un teléfono, usá solo números, espacios y los símbolos + - ( ).';
      return '';
    case 'asunto':
      if (!texto) return 'Contanos en pocas palabras de qué se trata.';
      if (texto.length < 3) return 'El asunto quedó muy corto: sumale un poco más de detalle.';
      return '';
    case 'mensaje':
      if (!texto) return 'Contanos qué necesitás: con eso podemos ayudarte mejor.';
      if (texto.length < MINIMO_MENSAJE) return `Contanos un poco más (al menos ${MINIMO_MENSAJE} caracteres) para entender bien tu caso.`;
      return '';
    default:
      return '';
  }
}

function mostrarError(campo, mensaje) {
  const contenedor = document.getElementById(`campo-${campo}`);
  const entrada = document.getElementById(campo);
  contenedor.classList.toggle('invalido', Boolean(mensaje));
  contenedor.classList.toggle('valido', !mensaje && entrada.value.trim() !== '');
  entrada.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  document.getElementById(`error-${campo}`).textContent = mensaje;
}

function validarCampo(campo) {
  const mensaje = validar(campo, document.getElementById(campo).value);
  mostrarError(campo, mensaje);
  return mensaje === '';
}

function validarTodo() {
  let primerError = null;
  for (const campo of CAMPOS) {
    if (!validarCampo(campo) && !primerError) primerError = campo;
  }
  if (primerError) document.getElementById(primerError).focus();
  return primerError === null;
}

function actualizarContador() {
  const cantidad = document.getElementById('mensaje').value.trim().length;
  const alcanza = cantidad >= MINIMO_MENSAJE;
  contadorMensaje.textContent = alcanza
    ? `${cantidad} caracteres`
    : `${cantidad} caracteres (mínimo ${MINIMO_MENSAJE})`;
  contadorMensaje.classList.toggle('ok', alcanza);
}

function mostrarAviso(texto) {
  avisoEnvio.textContent = texto;
  avisoEnvio.hidden = !texto;
}

for (const campo of CAMPOS) {
  const entrada = document.getElementById(campo);
  entrada.addEventListener('blur', () => {
    if (entrada.value.trim() !== '' || document.getElementById(`campo-${campo}`).classList.contains('invalido')) {
      validarCampo(campo);
    }
  });
  entrada.addEventListener('input', () => {
    if (campo === 'mensaje') actualizarContador();
    if (document.getElementById(`campo-${campo}`).classList.contains('invalido')) validarCampo(campo);
  });
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarAviso('');

  if (!validarTodo()) return;

  const datos = {};
  for (const campo of CAMPOS) datos[campo] = document.getElementById(campo).value.trim();

  botonEnviar.disabled = true;
  botonEnviar.textContent = 'Enviando…';

  try {
    const respuesta = await fetch('/api/consultas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const resultado = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 201) {
      formulario.hidden = true;
      panelExito.hidden = false;
      panelExito.focus();
      return;
    }

    if (respuesta.status === 400 && resultado.errores) {
      let primerError = null;
      for (const campo of CAMPOS) {
        mostrarError(campo, resultado.errores[campo] || '');
        if (resultado.errores[campo] && !primerError) primerError = campo;
      }
      if (primerError) document.getElementById(primerError).focus();
      return;
    }

    throw new Error(resultado.error || `Error ${respuesta.status}`);
  } catch (error) {
    console.error('No se pudo enviar la consulta:', error);
    mostrarAviso('No pudimos enviar tu consulta. Revisá tu conexión e intentá de nuevo en unos minutos.');
  } finally {
    botonEnviar.disabled = false;
    botonEnviar.textContent = 'Enviar consulta';
  }
});

document.getElementById('boton-otra').addEventListener('click', () => {
  formulario.reset();
  for (const campo of CAMPOS) mostrarError(campo, '');
  for (const campo of CAMPOS) document.getElementById(`campo-${campo}`).classList.remove('valido');
  actualizarContador();
  panelExito.hidden = true;
  formulario.hidden = false;
  document.getElementById('nombre').focus();
});

const servicioElegido = new URLSearchParams(location.search).get('servicio');
if (servicioElegido) {
  document.getElementById('asunto').value = `Consulta sobre: ${servicioElegido}`.slice(0, 150);
}
actualizarContador();
