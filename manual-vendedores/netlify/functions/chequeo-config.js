// TEMPORAL (19/10/2026): dice si existen las variables y si la clave del manual sirve.
// Solo responde sí/no, nunca un valor. Se borra apenas se usa.
exports.handler = async () => {
  const k = process.env.MANUAL_SERVICE_ROLE;
  let funciona = null;
  if (k) {
    // minutas_sueltas del manual quedó cerrada a la clave pública: solo la lee una clave de servicio.
    const r = await fetch('https://fzaxwuuodseyyinveknn.supabase.co/rest/v1/minutas_sueltas?select=id&limit=1',
      { headers: { apikey: k, Authorization: 'Bearer ' + k } }).catch(() => null);
    funciona = !!(r && r.ok);
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      MANUAL_SERVICE_ROLE: !!k, manual_service_role_funciona: funciona,
      MANUAL_ANON_KEY: !!process.env.MANUAL_ANON_KEY,
      HUB_SERVICE_ROLE: !!process.env.HUB_SERVICE_ROLE,
      COBRANZAS_SERVICE_ROLE: !!process.env.COBRANZAS_SERVICE_ROLE,
    }),
  };
};
