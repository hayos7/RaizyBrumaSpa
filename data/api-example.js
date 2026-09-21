// Ejemplo para la futura integración con back end. No se ejecuta en esta unidad.
async function sendReservation(reservation) {
  const response = await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservation)
  });
  if (!response.ok) throw new Error('No fue posible registrar la reservación.');
  return response.json();
}
