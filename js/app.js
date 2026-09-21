const services = [
  { name:'Masaje de raíces', description:'Presión profunda con aceites tibios de romero y cedro para liberar tensión acumulada en espalda y hombros.', duration:'60 min', category:'relajante', price:'$780', color:'#5C6B4F', featured:true },
  { name:'Facial de bruma fría', description:'Limpieza profunda, vapor frío y mascarilla de arcilla mineral para piel cansada por el sol y la ciudad.', duration:'45 min', category:'rostro', price:'$650', color:'#B98A4A', featured:true },
  { name:'Circuito de aguas', description:'Recorrido guiado por sauna, vapor y alberca de contraste térmico, organizado por temperatura y tiempo.', duration:'90 min', category:'circuito', price:'$920', color:'#1B2420', featured:true },
  { name:'Aromaterapia nocturna', description:'Sesión suave con aceites esenciales pensada para favorecer el descanso y cerrar el ritmo del día.', duration:'40 min', category:'relajante', price:'$590', color:'#8A7550' },
  { name:'Exfoliación corporal de sal', description:'Exfoliación con sal de mar y aceite de coco, seguida de hidratación profunda de la piel.', duration:'50 min', category:'cuerpo', price:'$710', color:'#3F4C36' }
];

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
    <div class="service-meta">${service.duration}${includeButton ? ` · ${service.category}` : ''}</div>
    <div class="service-price">${service.price}</div>
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

reservationForm.addEventListener('submit', event => {
  event.preventDefault();
  event.stopPropagation();
  reservationForm.classList.add('was-validated');
  if (!reservationForm.checkValidity()) return;
  const data = Object.fromEntries(new FormData(reservationForm));
  const formattedDate = new Intl.DateTimeFormat('es-MX', { dateStyle:'long' }).format(new Date(`${data.date}T12:00:00`));
  const rows = [
    ['Nombre', data.fullName], ['Servicio', data.service], ['Fecha', formattedDate],
    ['Hora', data.time], ['Correo', data.email], ['Teléfono', data.phone]
  ];
  document.getElementById('receipt').innerHTML = rows.map(([label,value]) => `<div class="receipt-row"><span>${label}</span><span>${value}</span></div>`).join('');
  showScreen('confirmacion');
});

document.getElementById('loginForm').addEventListener('submit', event => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
  showToast('Sesión iniciada correctamente.');
  form.reset();
  form.classList.remove('was-validated');
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

document.getElementById('registerForm').addEventListener('submit', event => {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget;
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  const profile = Object.fromEntries(new FormData(form));
  // Demostración front end. En la siguiente etapa, este objeto se enviará al back end.
  sessionStorage.setItem('raizyBrumaProfile', JSON.stringify({ name:profile.name, email:profile.email }));
  bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
  showToast(`Cuenta de demostración creada para ${profile.name}.`);
  form.reset();
  form.classList.remove('was-validated');
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
