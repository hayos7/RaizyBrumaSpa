# Raíz & Bruma Spa

Aplicación web front end desarrollada con HTML5, CSS3, JavaScript y Bootstrap 5.

## Cumplimiento de la actividad

- Hoja de estilos externa en `css/styles.css`.
- JavaScript externo en `js/app.js`.
- Bootstrap para estructura responsiva, navegación, formularios, modales, validación y notificaciones.
- Login incluido y funcional como simulación front end.
- Registro de cuenta de demostración.
- Elementos de entrada: reservación, login, registro y cuestionario.
- Elementos de salida: comprobante, resultados del cuestionario y notificaciones.
- Menús y controles funcionales.
- Cuestionario con diez preguntas.
- Dos sentencias JavaScript visibles y aplicadas.
- Archivo `data/api-example.js` como preparación para una futura API de back end.

## Ejecutar el proyecto

1. Abre esta carpeta en Visual Studio Code.
2. Ejecuta `npm install` para instalar Bootstrap y las dependencias registradas.
3. Abre `index.html` con Live Server.

La versión actual utiliza Bootstrap por CDN para facilitar su publicación como sitio estático. `package.json` también registra Bootstrap para documentar el uso del framework mediante npm.

## Preparación para back end

Los formularios utilizan atributos `name`, JavaScript convierte las entradas en objetos y `data/api-example.js` contiene un ejemplo de envío JSON a `/api/reservations`. El ejemplo no se ejecuta hasta que exista un servidor.
