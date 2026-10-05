require('dotenv').config({ quiet: true });
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// Archivos de datos (JSON) y funciones para leer/escribir
// ---------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  services: path.join(DATA_DIR, 'services.json'),
  users: path.join(DATA_DIR, 'users.json'),
  reservations: path.join(DATA_DIR, 'reservations.json'),
  resets: path.join(DATA_DIR, 'resets.json')
};

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Elimina etiquetas HTML/script de los campos de texto libre antes de guardarlos.
// Es una segunda capa de defensa: aunque el front end ya muestra los datos con textContent
// (no interpreta HTML), el dato guardado también debe quedar inofensivo por si en el futuro
// se muestra en otra pantalla, un reporte o un panel que use innerHTML.
function sanitizeText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

// Todas las respuestas de error usan el mismo formato: { ok:false, errors:[...] }
function fail(res, status, ...errors) {
  return res.status(status).json({ ok: false, errors });
}

// ---------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------
app.use(morgan('dev'));            // muestra cada petición en la terminal
app.use(express.json());           // lee el cuerpo JSON de las peticiones
// El secreto de la sesión YA NO tiene un valor por defecto conocido (antes era un texto fijo
// visible en el código; cualquiera que lo leyera podía falsificar una sesión). Si falta en .env,
// se genera uno aleatorio al arrancar: las sesiones siguen siendo válidas, solo se reinician si
// el servidor se reinicia sin el secreto guardado.
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('AVISO: no hay SESSION_SECRET en .env; se generó uno temporal solo para esta ejecución.');
}
// Cabeceras de seguridad. Se ajusta la política de contenido (CSP) para seguir permitiendo
// los recursos externos que ya usa la página (Bootstrap por CDN y Google Fonts); sin este ajuste,
// Helmet los bloquea por defecto y la página deja de funcionar.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:']
    }
  }
}));
app.use(session({                  // sesiones con cookie
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 2 } // 2 horas
}));

// Limita los intentos de inicio de sesión, registro y recuperación para frenar ataques de fuerza bruta
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 5,                   // 5 intentos por IP en ese lapso
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'] }
});

// Archivos públicos (server.js, .env y data/ NO se exponen)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Exige que el usuario haya iniciado sesión
function requireAuth(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Inicia sesión para continuar');
  next();
}

const publicUser = u => ({ id: u.id, name: u.name, email: u.email });

// ---------------------------------------------------------------
// AUTENTICACIÓN: registro, login, logout y usuario actual
// ---------------------------------------------------------------
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  const errors = [];
  if (!name || name.trim().length < 3) errors.push('Nombre inválido (mínimo 3 caracteres)');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Correo inválido');
  if (!password || password.length < 6) errors.push('La contraseña debe tener al menos 6 caracteres');
  if (password !== confirmPassword) errors.push('Las contraseñas no coinciden');
  if (errors.length) return fail(res, 400, ...errors);

  const users = readJSON(FILES.users);
  const emailNorm = email.trim().toLowerCase();
  if (users.some(u => u.email === emailNorm)) return fail(res, 409, 'Ese correo ya está registrado');

  const user = {
    id: Date.now(),
    name: sanitizeText(name),
    email: emailNorm,
    passwordHash: bcrypt.hashSync(password, 10), // la contraseña NUNCA se guarda en texto plano
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeJSON(FILES.users, users);

  req.session.userId = user.id;
  res.status(201).json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(FILES.users);
  const user = users.find(u => u.email === String(email || '').trim().toLowerCase());

  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return fail(res, 401, 'Correo o contraseña incorrectos');
  }
  req.session.regenerate(() => {
    req.session.userId = user.id;
    res.json({ ok: true, user: publicUser(user) });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = readJSON(FILES.users).find(u => u.id === req.session.userId);
  res.json({ ok: true, user: user ? publicUser(user) : null });
});

// ---------------------------------------------------------------
// RECUPERAR CONTRASEÑA ("olvidé mi contraseña")
// Flujo: 1) el usuario pide el enlace  2) abre el enlace  3) escribe una contraseña nueva
// ---------------------------------------------------------------
const RESET_MINUTES = 15;
const SHOW_RESET_LINK = process.env.NODE_ENV !== 'production'; // modo demostración (sin servicio de correo)
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');

app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Correo inválido');

  // Misma respuesta exista o no el correo, para no revelar quién tiene cuenta
  const message = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';
  const user = readJSON(FILES.users).find(u => u.email === email);
  if (!user) return res.json({ ok: true, message });

  // Solo se guarda el hash del token; el token en sí viaja únicamente en el enlace
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const resets = readJSON(FILES.resets).filter(r => r.expiresAt > now && r.userId !== user.id);
  resets.push({ userId: user.id, tokenHash: sha256(token), expiresAt: now + RESET_MINUTES * 60 * 1000 });
  writeJSON(FILES.resets, resets);

  const link = `${req.protocol}://${req.get('host')}/?reset=${token}`;
  console.log(`\n[Correo simulado] Enlace para restablecer la contraseña de ${email} (válido ${RESET_MINUTES} min):\n${link}\n`);
  res.json({ ok: true, message, ...(SHOW_RESET_LINK && { devLink: link }) });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password, confirmPassword } = req.body;

  const errors = [];
  if (!password || password.length < 6) errors.push('La contraseña debe tener al menos 6 caracteres');
  if (password !== confirmPassword) errors.push('Las contraseñas no coinciden');
  if (errors.length) return fail(res, 400, ...errors);

  const invalidLink = 'El enlace no es válido o ya expiró. Solicita uno nuevo';
  const resets = readJSON(FILES.resets);
  const entry = resets.find(r => r.tokenHash === sha256(String(token || '')) && r.expiresAt > Date.now());
  if (!entry) return fail(res, 400, invalidLink);

  const users = readJSON(FILES.users);
  const user = users.find(u => u.id === entry.userId);
  if (!user) return fail(res, 400, invalidLink);

  user.passwordHash = bcrypt.hashSync(password, 10);
  writeJSON(FILES.users, users);
  writeJSON(FILES.resets, resets.filter(r => r.userId !== user.id)); // el enlace solo sirve una vez
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// SERVICIOS
// ---------------------------------------------------------------
app.get('/api/services', (req, res) => {
  res.json(readJSON(FILES.services));
});

// ---------------------------------------------------------------
// RESERVACIONES
// ---------------------------------------------------------------
const FIRST_SLOT = '09:00';
const LAST_SLOT = '19:00';   // última hora de inicio (el spa cierra a las 20:00)
const CLOSED_DAY = 1;        // lunes (0 = domingo ... 6 = sábado)

function todayLocal() {
  return new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
}

function validateReservation(body, services) {
  const { fullName, phone, email, service, date, time, notes } = body;
  const errors = [];

  if (!fullName || fullName.trim().length < 3) errors.push('Nombre inválido');
  if (!phone || !/^[0-9\s()+-]{8,15}$/.test(phone)) errors.push('Teléfono inválido');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Correo inválido');
  if (!service || !services.some(s => s.name === service)) errors.push('Servicio no disponible');
  if (notes && notes.length > 300) errors.push('Los comentarios no pueden pasar de 300 caracteres');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || isNaN(new Date(`${date}T12:00:00`))) {
    errors.push('Fecha inválida');
  } else if (date < todayLocal()) {
    errors.push('No se puede reservar en una fecha pasada');
  } else if (new Date(`${date}T12:00:00`).getDay() === CLOSED_DAY) {
    errors.push('El spa cierra los lunes');
  }

  if (!/^\d{2}:\d{2}$/.test(time || '')) {
    errors.push('Hora inválida');
  } else if (time < FIRST_SLOT || time > LAST_SLOT) {
    errors.push(`El horario de atención es de ${FIRST_SLOT} a 20:00 (última cita a las ${LAST_SLOT})`);
  }
  return errors;
}

// Crear reservación (funciona con o sin sesión; si hay sesión, se liga al usuario)
app.post('/api/reservations', (req, res) => {
  const services = readJSON(FILES.services);
  const errors = validateReservation(req.body, services);
  if (errors.length) return fail(res, 400, ...errors);

  const { fullName, phone, email, service, date, time, notes } = req.body;
  const all = readJSON(FILES.reservations);

  // Sin traslapes: un horario ocupado no se puede volver a reservar
  if (all.some(r => r.date === date && r.time === time && r.status === 'confirmada')) {
    return fail(res, 409, 'Ese horario ya está ocupado, elige otro');
  }

  const reservation = {
    id: Date.now(),
    userId: req.session.userId || null,
    fullName: sanitizeText(fullName),
    phone, email, service, date, time,
    notes: sanitizeText(notes),
    status: 'confirmada',
    createdAt: new Date().toISOString()
  };
  all.push(reservation);
  console.log('Nueva reservación recibida:', reservation);
  writeJSON(FILES.reservations, all);

  res.status(201).json({ ok: true, reservation });
});

// Mis reservaciones (requiere sesión)
app.get('/api/reservations', requireAuth, (req, res) => {
  const mine = readJSON(FILES.reservations)
    .filter(r => r.userId === req.session.userId)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  res.json(mine);
});

// Cancelar una reservación propia (requiere sesión)
app.delete('/api/reservations/:id', requireAuth, (req, res) => {
  const all = readJSON(FILES.reservations);
  const reservation = all.find(r => r.id === Number(req.params.id));

  if (!reservation) return fail(res, 404, 'Reservación no encontrada');
  if (reservation.userId !== req.session.userId) return fail(res, 403, 'No puedes cancelar la reservación de otra persona');

  reservation.status = 'cancelada';
  writeJSON(FILES.reservations, all);
  res.json({ ok: true, reservation });
});

// Horarios ocupados de un día: /api/availability?date=AAAA-MM-DD
app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return fail(res, 400, 'Indica la fecha como AAAA-MM-DD');
  const taken = readJSON(FILES.reservations)
    .filter(r => r.date === date && r.status === 'confirmada')
    .map(r => r.time)
    .sort();
  res.json({ date, taken });
});

// ---------------------------------------------------------------
// Rutas inexistentes y manejo de errores
// ---------------------------------------------------------------
app.use('/api', (req, res) => fail(res, 404, 'Ruta no encontrada'));

app.use((err, req, res, next) => {
  if (err.status === 400) return fail(res, 400, 'El cuerpo de la petición no es un JSON válido');
  console.error(err);
  fail(res, 500, 'Error interno del servidor');
});

app.listen(PORT, () => {
  console.log(`Servidor Raíz & Bruma en http://localhost:${PORT}`);
});