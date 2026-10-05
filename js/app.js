// Los servicios ahora vienen del back end (GET /api/services)
let services = [];
try {
  services = await (await fetch('/api/services')).json();
} catch (error) {
  console.error('No se pudieron cargar los servicios:', error);
}

const screens = document.querySelectorAll('.screen');
const navLinks = document.querySelectorAll('[data-screen]');
const serviceSelect = document.getElementById('service');
// EVENTO 4 - KEYUP

const notesField =
    document.getElementById('notes');

notesField.addEventListener(
    'keyup',
    () => {

        console.log(
            'Caracteres:',
            notesField.value.length
        );

    }
);

// EVENTO 5 - KEYDOWN

const phoneField =
    document.getElementById('phone');

phoneField.addEventListener(
    'keydown',
    (event) => {

        if(event.key === '@'){

            alert(
                'No se permiten caracteres especiales'
            );

            event.preventDefault();

        }

    }
);

// EVENTO 6 - KEYPRESS

const fullNameField =
    document.getElementById('fullName');

fullNameField.addEventListener(
    'keypress',
    () => {

        console.log(
            fullNameField.value
        );

    }
);


const reservationForm = document.getElementById('reservationForm');

function serviceMarkup(service, includeButton=false) {
  return `<article class="service-row">
    <div class="service-swatch" style="background:${service.color}" aria-hidden="true"></div>
    <div><h3>${service.name}</h3><div class="service-description">${service.description}</div></div>
    <div class="service-meta">${service.duration} min${includeButton ? ` · ${service.category}` : ''}</div>
    <div class="service-price">$${service.price}</div>
    ${includeButton ? `<button class="btn rb-btn-primary service-action" type="button" data-reserve="${service.name}">Reservar este servicio</button>` : ''}
  </article>`;
}

document.getElementById('featuredServices').innerHTML = services.filter(s => s.featured).map(s => serviceMarkup(s)).join('');
document.getElementById('servicesCatalog').innerHTML = services.map(s => serviceMarkup(s, true)).join('');
serviceSelect.insertAdjacentHTML('beforeend', services.map(s => `<option value="${s.name}">${s.name}</option>`).join(''));

// EVENTO 1 - MOUSEENTER
document.querySelectorAll('.service-row').forEach(service => {

    service.addEventListener('mouseenter', () => {

        service.style.transform = 'scale(1.02)';
        service.style.transition = '0.3s';

    });

});

// EVENTO 2 - MOUSELEAVE
document.querySelectorAll('.service-row').forEach(service => {

    service.addEventListener('mouseleave', () => {

        service.style.transform = 'scale(1)';

    });

});

// EVENTO 3 - DBLCLICK
document.querySelectorAll('.service-row').forEach(service => {

    service.addEventListener('dblclick', () => {

        alert(
            'Servicio seleccionado para reservación'
        );

        showScreen('reservar');

    });

});

function showScreen(name) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === `screen-${name}`));
  document.querySelectorAll('.rb-nav-links .nav-link').forEach(link => link.classList.toggle('active', link.dataset.screen === name));
  const collapseEl = document.getElementById('mainNav');
  if (collapseEl.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
  window.scrollTo({ top:0, behavior:'smooth' });
  history.replaceState(null, '', `#${name}`);
  if (name === 'cuenta') loadMyReservations();
}

navLinks.forEach(control => control.addEventListener('click', event => {
  event.preventDefault();
  showScreen(control.dataset.screen);
}));

document.addEventListener('click', event => {
  const button = event.target.closest('[data-reserve]');
  if (!button) return;
  serviceSelect.value = button.dataset.reserve;
  showScreen('reservar');
});

const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
document.getElementById('date').min = today.toISOString().split('T')[0];

reservationForm.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();
  reservationForm.classList.add('was-validated');
  if (!reservationForm.checkValidity()) return;
  const data = Object.fromEntries(new FormData(reservationForm));

  try {
    // Envía la reservación al back end (Express)
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors ? result.errors.join(', ') : 'Error al guardar');

    const saved = result.reservation;
    const formattedDate = new Intl.DateTimeFormat('es-MX', { dateStyle:'long' }).format(new Date(`${saved.date}T12:00:00`));
    const rows = [
      ['Folio', saved.id], ['Nombre', saved.fullName], ['Servicio', saved.service], ['Fecha', formattedDate],
      ['Hora', saved.time], ['Correo', saved.email], ['Teléfono', saved.phone]
    ];
    const receipt = document.getElementById('receipt');
    receipt.innerHTML = '';
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'receipt-row';
      const a = document.createElement('span'); a.textContent = label;
      const b = document.createElement('span'); b.textContent = value; // textContent evita inyección de HTML
      row.append(a, b);
      receipt.appendChild(row);
    });
    reservationForm.reset();
    reservationForm.classList.remove('was-validated');
    showScreen('confirmacion');
  } catch (error) {
    showToast(`No se pudo guardar la reservación: ${error.message}`);
  }
});

document.getElementById('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  try {
    const result = await api('/api/auth/login', 'POST', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    });
    setUser(result.user);
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
    showToast(`Sesión iniciada. Hola, ${result.user.name}.`);
    form.reset();
    form.classList.remove('was-validated');
    if (document.getElementById('screen-cuenta').classList.contains('active')) loadMyReservations();
  } catch (error) {
    showToast(error.message);
  }
});

const initialScreen = ['inicio','servicios','reservar','cuestionario'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
showScreen(initialScreen);


const questions = [
  {
    question: '¿Cuál es la función principal de HTML?',
    options: ['Definir la estructura y el contenido', 'Administrar la base de datos', 'Crear estilos visuales', 'Publicar el servidor'],
    answer: 0
  },
  {
    question: '¿Para qué se utiliza una hoja de estilos CSS externa?',
    options: ['Para separar y reutilizar la presentación visual', 'Para almacenar contraseñas', 'Para ejecutar consultas SQL', 'Para sustituir JavaScript'],
    answer: 0
  },
  {
    question: '¿Qué permite JavaScript en esta maqueta?',
    options: ['Agregar interacción y procesar datos del usuario', 'Instalar el navegador', 'Crear la conexión física de red', 'Reemplazar todos los elementos HTML'],
    answer: 0
  },
  {
    question: '¿Qué método se utiliza para escuchar una acción del usuario?',
    options: ['addEventListener()', 'queryDatabase()', 'createServer()', 'styleSheet()'],
    answer: 0
  },
  {
    question: '¿Qué instrucción evita el envío predeterminado de un formulario?',
    options: ['event.preventDefault()', 'event.delete()', 'form.close()', 'window.stopForm()'],
    answer: 0
  },
  {
    question: '¿Cuál es una ventaja de Bootstrap?',
    options: ['Ofrece componentes y utilidades responsivas', 'Crea automáticamente un back end', 'Elimina la necesidad de HTML', 'Guarda datos en una base de datos'],
    answer: 0
  },
  {
    question: '¿Qué representa un elemento de entrada?',
    options: ['Un control donde el usuario captura o selecciona información', 'Un título estático', 'Una regla CSS', 'Una respuesta del servidor'],
    answer: 0
  },
  {
    question: '¿Cuál es un elemento de salida en la aplicación?',
    options: ['El comprobante de reservación', 'El campo de correo', 'El selector de fecha', 'El campo de contraseña'],
    answer: 0
  },
  {
    question: '¿Por qué se usan atributos name en los campos?',
    options: ['Para identificar los datos al construir o enviar el formulario', 'Para cambiar el color del texto', 'Para instalar Bootstrap', 'Para cerrar el navegador'],
    answer: 0
  },
  {
    question: '¿Qué formato es adecuado para enviar datos al futuro back end?',
    options: ['JSON', 'PNG', 'CSS', 'MP3'],
    answer: 0
  }
];

const questionList = document.getElementById('questionList');
questionList.innerHTML = questions.map((item, index) => `
  <fieldset class="question-card">
    <legend>${index + 1}. ${item.question}</legend>
    ${item.options.map((option, optionIndex) => `
      <label class="question-option">
        <input type="radio" name="question-${index}" value="${optionIndex}">
        <span>${option}</span>
      </label>`).join('')}
  </fieldset>`).join('');

const questionnaireForm = document.getElementById('questionnaireForm');
const questionnaireResult = document.getElementById('questionnaireResult');
questionnaireForm.addEventListener('submit', event => {
  event.preventDefault();
  let score = 0;
  const unanswered = [];
  questions.forEach((item, index) => {
    const selected = questionnaireForm.querySelector(`input[name="question-${index}"]:checked`);
    if (!selected) unanswered.push(index + 1);
    else if (Number(selected.value) === item.answer) score += 1;
  });
  questionnaireResult.hidden = false;
  questionnaireResult.innerHTML = `
    <h3>Resultado: ${score} de ${questions.length} respuestas correctas</h3>
    <p>${unanswered.length ? `Preguntas sin contestar: ${unanswered.join(', ')}.` : 'Contestaste todas las preguntas.'}</p>
    <p class="mb-0">El resultado se generó mediante JavaScript a partir de las opciones seleccionadas.</p>`;
  questionnaireResult.scrollIntoView({ behavior:'smooth', block:'center' });
});

document.getElementById('resetQuestionnaire').addEventListener('click', () => {
  questionnaireForm.reset();
  questionnaireResult.hidden = true;
  questionnaireResult.innerHTML = '';
});

function showToast(message) {
  document.getElementById('toastMessage').textContent = message;
  bootstrap.Toast.getOrCreateInstance(document.getElementById('appToast'), { delay:2400 }).show();
}

// Botón "Mostrar/Ocultar" en cualquier campo de contraseña
document.querySelectorAll('.toggle-password').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ocultar' : 'Mostrar';
  });
});

// Valida en vivo que "contraseña" y "confirmar contraseña" coincidan
function linkPasswordConfirmation(passwordId, confirmId) {
  const password = document.getElementById(passwordId);
  const confirm = document.getElementById(confirmId);
  const check = () => confirm.setCustomValidity(confirm.value && confirm.value !== password.value ? 'no coinciden' : '');
  password.addEventListener('input', check);
  confirm.addEventListener('input', check);
}
linkPasswordConfirmation('registerPassword', 'registerPasswordConfirm');
linkPasswordConfirmation('resetPassword', 'resetPasswordConfirm');

const registerForm = document.getElementById('registerForm');
const registerName = document.getElementById('registerName');
const registerEventStatus = document.getElementById('registerEventStatus');

function updateRegisterEvent(message) {
  registerEventStatus.textContent = message;
}

registerForm.addEventListener('mouseenter', () => {
  updateRegisterEvent('Evento mouseenter: formulario de alta activo.');
});

registerForm.addEventListener('mouseleave', () => {
  updateRegisterEvent('Evento mouseleave: formulario en espera.');
});

registerName.addEventListener('keyup', () => {
  updateRegisterEvent(`Evento keyup: ${registerName.value.length} caracteres en el nombre.`);
});

registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  try {
    const profile = Object.fromEntries(new FormData(form));
    const result = await api('/api/auth/register', 'POST', profile); // el servidor cifra la contraseña
    setUser(result.user);
    bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
    showToast(`Cuenta creada. Bienvenido(a), ${result.user.name}.`);
    updateRegisterEvent('Cuenta creada correctamente mediante el evento submit.');
    form.reset();
    form.classList.remove('was-validated');
  } catch (error) {
    showToast(error.message);
  }
});

// EVENTO 7 - WINDOW LOAD

window.addEventListener(
    'load',
    () => {

        showToast(
            'Bienvenido a Raíz & Bruma'
        );

    }
);

// EVENTO 8 - RESIZE

window.addEventListener(
    'resize',
    () => {

        console.log(
            'Ancho actual:',
            window.innerWidth
        );

    }
);


// ---------------------------------------------------------------
// Comunicación con el back end, sesión y "Mis reservas"
// ---------------------------------------------------------------
async function api(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.errors ? data.errors.join(', ') : 'Error del servidor');
  return data;
}

let currentUser = null;
const authButton = document.getElementById('authButton');

function setUser(user) {
  currentUser = user;
  authButton.textContent = user ? 'Cerrar sesión' : 'Iniciar sesión';
  document.getElementById('accountGreeting').textContent = user
    ? `Sesión iniciada como ${user.name}.`
    : 'Inicia sesión para consultar tus sesiones.';
}

authButton.addEventListener('click', async () => {
  if (!currentUser) {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).show();
    return;
  }
  await api('/api/auth/logout', 'POST');
  setUser(null);
  showToast('Sesión cerrada.');
  if (document.getElementById('screen-cuenta').classList.contains('active')) showScreen('inicio');
});

async function loadMyReservations() {
  const list = document.getElementById('myReservations');
  list.textContent = '';
  if (!currentUser) {
    const p = document.createElement('p');
    p.textContent = 'Inicia sesión para ver tus reservaciones.';
    list.appendChild(p);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).show();
    return;
  }
  try {
    const items = await api('/api/reservations');
    if (!items.length) {
      const p = document.createElement('p');
      p.textContent = 'Aún no tienes reservaciones.';
      list.appendChild(p);
      return;
    }
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'question-card d-flex flex-wrap justify-content-between align-items-center gap-3';
      const date = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(`${item.date}T12:00:00`));
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.service;
      const detail = document.createElement('div');
      detail.textContent = `${date} · ${item.time} · Folio ${item.id} · ${item.status}`;
      info.append(title, detail);
      card.appendChild(info);
      if (item.status === 'confirmada') {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn rb-btn-light-outline';
        cancel.textContent = 'Cancelar reservación';
        cancel.addEventListener('click', async () => {
          try {
            await api(`/api/reservations/${item.id}`, 'DELETE');
            showToast('Reservación cancelada.');
            loadMyReservations();
          } catch (error) {
            showToast(error.message);
          }
        });
        card.appendChild(cancel);
      }
      list.appendChild(card);
    });
  } catch (error) {
    showToast(error.message);
  }
}

// Al cargar la página, revisa si ya hay una sesión activa
try {
  const me = await api('/api/auth/me');
  setUser(me.user);
} catch {
  setUser(null);
}


// ---------------------------------------------------------------
// Recuperar / restablecer contraseña
// ---------------------------------------------------------------
document.getElementById('forgotForm').addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  try {
    const result = await api('/api/auth/forgot-password', 'POST', { email: document.getElementById('forgotEmail').value });
    bootstrap.Modal.getInstance(document.getElementById('forgotModal')).hide();
    form.reset();
    form.classList.remove('was-validated');
    // result.devLink solo existe en modo demostración (sin servidor de correo real)
    showToast(result.devLink ? `${result.message} Enlace de prueba: ${result.devLink}` : result.message);
  } catch (error) {
    showToast(error.message);
  }
});

let resetToken = null;
const resetParam = new URLSearchParams(location.search).get('reset');
if (resetParam) {
  resetToken = resetParam;
  history.replaceState(null, '', location.pathname); // el token no se queda visible en la barra de direcciones
  bootstrap.Modal.getOrCreateInstance(document.getElementById('resetModal')).show();
}

document.getElementById('resetForm').addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  try {
    await api('/api/auth/reset-password', 'POST', {
      token: resetToken,
      password: document.getElementById('resetPassword').value,
      confirmPassword: document.getElementById('resetPasswordConfirm').value
    });
    bootstrap.Modal.getInstance(document.getElementById('resetModal')).hide();
    form.reset();
    form.classList.remove('was-validated');
    showToast('Contraseña actualizada. Ya puedes iniciar sesión con ella.');
  } catch (error) {
    showToast(error.message);
  }
});