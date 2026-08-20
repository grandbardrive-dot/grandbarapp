// ============================================================
//  GrandBar Hub · Function · passkey (WebAuthn / Face ID)
//   Ingreso sin contraseña con Face ID (passkey).
//   Verificación con crypto nativo de Node (sin dependencias).
//   Env: HUB_SERVICE_ROLE
// ============================================================
const crypto = require('crypto');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const RP_ID  = 'portalgrandbar.com';
const ORIGIN = 'https://portalgrandbar.com';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const sha256 = b => crypto.createHash('sha256').update(b).digest();
const randId = () => crypto.randomBytes(16).toString('hex');

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    async function usuarioDeToken() {
      const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return null;
      const r = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
      if (!r.ok) return null;
      return await r.json();
    }
    async function guardarReto(purpose, user_id) {
      const id = randId(), challenge = b64url(crypto.randomBytes(32));
      const expires_at = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      await sb('webauthn_challenges', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id, challenge, purpose, user_id: user_id || null, expires_at }) });
      return { id, challenge };
    }
    async function tomarReto(id, purpose) {
      const row = (await (await sb('webauthn_challenges?id=eq.' + encodeURIComponent(id) + '&select=*')).json())[0];
      await sb('webauthn_challenges?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      if (!row || row.purpose !== purpose) return null;
      if (new Date(row.expires_at).getTime() < Date.now()) return null;
      return row;
    }
    function clientDataOk(clientDataB64, tipoEsperado, challengeGuardado) {
      let cd; try { cd = JSON.parse(fromB64(clientDataB64).toString('utf8')); } catch (e) { return false; }
      if (cd.type !== tipoEsperado) return false;
      if (cd.origin !== ORIGIN) return false;
      // el challenge viene en base64url en clientDataJSON
      if (String(cd.challenge) !== String(challengeGuardado)) return false;
      return true;
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Método' });
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

    // ---- Reto para registrar (requiere sesión) ----
    if (b.accion === 'reto-registro') {
      const u = await usuarioDeToken(); if (!u) return json(401, { error: 'Sin sesión' });
      const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(u.id) + '&select=nombre')).json())[0] || {};
      const reto = await guardarReto('register', u.id);
      return json(200, { id: reto.id, challenge: reto.challenge, rpId: RP_ID, user: { id: b64url(Buffer.from(u.id.replace(/-/g, ''), 'hex')), name: u.email, displayName: perfil.nombre || u.email } });
    }

    // ---- Guardar passkey nueva (requiere sesión) ----
    if (b.accion === 'guardar-passkey') {
      const u = await usuarioDeToken(); if (!u) return json(401, { error: 'Sin sesión' });
      if (!b.id || !b.credentialId || !b.publicKey || !b.clientDataJSON) return json(400, { error: 'Datos incompletos' });
      const reto = await tomarReto(b.id, 'register');
      if (!reto || String(reto.user_id) !== String(u.id)) return json(400, { error: 'Reto inválido o vencido' });
      if (!clientDataOk(b.clientDataJSON, 'webauthn.create', reto.challenge)) return json(400, { error: 'Validación fallida' });
      const fila = { user_id: u.id, email: u.email, credential_id: String(b.credentialId), public_key: String(b.publicKey) };
      const r = await sb('passkeys?on_conflict=credential_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
      if (!r.ok) return json(502, { error: 'No pude guardar: ' + (await r.text()).slice(0, 150) });
      return json(200, { ok: true });
    }

    // ---- Reto para login (sin sesión) ----
    if (b.accion === 'reto-login') {
      const reto = await guardarReto('login', null);
      return json(200, { id: reto.id, challenge: reto.challenge, rpId: RP_ID });
    }

    // ---- Login con passkey (sin sesión) ----
    if (b.accion === 'login') {
      if (!b.id || !b.credentialId || !b.authenticatorData || !b.clientDataJSON || !b.signature) return json(400, { error: 'Datos incompletos' });
      const reto = await tomarReto(b.id, 'login');
      if (!reto) return json(400, { error: 'Reto inválido o vencido' });
      if (!clientDataOk(b.clientDataJSON, 'webauthn.get', reto.challenge)) return json(400, { error: 'Validación fallida' });

      const pk = (await (await sb('passkeys?credential_id=eq.' + encodeURIComponent(b.credentialId) + '&select=*')).json())[0];
      if (!pk) return json(401, { error: 'Passkey no reconocida' });

      const authData = fromB64(b.authenticatorData);
      // rpIdHash (primeros 32 bytes) debe coincidir con SHA256(rpId)
      if (Buffer.compare(authData.slice(0, 32), sha256(Buffer.from(RP_ID))) !== 0) return json(401, { error: 'RP inválido' });
      const flags = authData[32];
      if (!(flags & 0x01)) return json(401, { error: 'Sin user presence' });     // UP
      if (!(flags & 0x04)) return json(401, { error: 'Sin verificación (Face ID)' }); // UV

      // firma sobre authenticatorData || SHA256(clientDataJSON)
      const signedData = Buffer.concat([authData, sha256(fromB64(b.clientDataJSON))]);
      let ok = false;
      try {
        const key = crypto.createPublicKey({ key: fromB64(pk.public_key), format: 'der', type: 'spki' });
        ok = crypto.verify('sha256', signedData, { key, dsaEncoding: 'der' }, fromB64(b.signature));
      } catch (e) { return json(500, { error: 'verify: ' + (e.message || e) }); }
      if (!ok) return json(401, { error: 'Firma inválida' });

      await sb('passkeys?credential_id=eq.' + encodeURIComponent(b.credentialId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_used_at: new Date().toISOString() }) });

      // Emitir sesión de Supabase para ese email (magic-link token_hash → el cliente hace verifyOtp)
      const glr = await fetch(HUB_URL + '/auth/v1/admin/generate_link', { method: 'POST', headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email: pk.email }) });
      if (!glr.ok) return json(502, { error: 'No pude emitir sesión' });
      const gl = await glr.json();
      const token_hash = gl.hashed_token || (gl.properties && gl.properties.hashed_token);
      if (!token_hash) return json(502, { error: 'Sin token' });
      return json(200, { ok: true, token_hash });
    }

    return json(400, { error: 'Acción inválida' });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
