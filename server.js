require('dotenv').config({ quiet: true });
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const fs = require('fs');
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
  reservations: path.join(DATA_DIR, 'reservations.json')
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

// Todas las respuestas de error usan el mismo formato: { ok:false, errors:[...] }
function fail(res, status, ...errors) {
  return res.status(status).json({ ok: false, errors });
}

// ---------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------
app.use(morgan('dev'));            // muestra cada petición en la terminal
app.use(express.json());           // lee el cuerpo JSON de las peticiones
app.use(session({                  // sesiones con cookie
  secret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-el-archivo-env',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 2 } // 2 horas
}));

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
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  const errors = [];
  if (!name || name.trim().length < 3) errors.push('Nombre inválido (mínimo 3 caracteres)');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Correo inválido');
  if (!password || password.length < 6) errors.push('La contraseña debe tener al menos 6 caracteres');
  if (errors.length) return fail(res, 400, ...errors);

  const users = readJSON(FILES.users);
  const emailNorm = email.trim().toLowerCase();
  if (users.some(u => u.email === emailNorm)) return fail(res, 409, 'Ese correo ya está registrado');

  const user = {
    id: Date.now(),
    name: name.trim(),
    email: emailNorm,
    passwordHash: bcrypt.hashSync(password, 10), // la contraseña NUNCA se guarda en texto plano
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeJSON(FILES.users, users);

  req.session.userId = user.id;
  res.status(201).json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
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
    fullName: fullName.trim(),
    phone, email, service, date, time,
    notes: (notes || '').trim(),
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