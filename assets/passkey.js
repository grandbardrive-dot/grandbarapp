// ============================================================
//  GrandBar Hub · passkey.js (cliente WebAuthn / Face ID)
//   window.GBPasskey.disponible()  -> bool
//   window.GBPasskey.enrolar(hub)  -> registra Face ID (usuario logueado)
//   window.GBPasskey.login(hub)    -> inicia sesión con Face ID
//  hub = cliente supabase ya creado.
// ============================================================
(function () {
  var FN = '/.netlify/functions/passkey';

  function b64urlToBuf(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }
  function bufToB64url(buf) {
    var bytes = new Uint8Array(buf), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function tokenDe(hub) {
    var s = (await hub.auth.getSession()).data.session;
    return s ? s.access_token : null;
  }
  async function post(body, token) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    var r = await fetch(FN, { method: 'POST', headers: h, body: JSON.stringify(body) });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    return d;
  }

  function disponible() {
    return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
  }

  async function enrolar(hub) {
    if (!disponible()) throw new Error('Este dispositivo no soporta Face ID en la web.');
    var token = await tokenDe(hub);
    if (!token) throw new Error('Iniciá sesión primero.');
    var reto = await post({ accion: 'reto-registro' }, token);
    var cred = await navigator.credentials.create({
      publicKey: {
        challenge: b64urlToBuf(reto.challenge),
        rp: { id: reto.rpId, name: 'GrandBar Hub' },
        user: { id: b64urlToBuf(reto.user.id), name: reto.user.name, displayName: reto.user.displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
        timeout: 60000, attestation: 'none'
      }
    });
    if (!cred) throw new Error('Cancelado.');
    if (!cred.response.getPublicKey) throw new Error('Tu iOS es viejo para passkeys (necesitás iOS 16+).');
    var spki = cred.response.getPublicKey();
    if (!spki) throw new Error('No se pudo leer la clave.');
    await post({ accion: 'guardar-passkey', id: reto.id, credentialId: bufToB64url(cred.rawId), publicKey: bufToB64(spki), clientDataJSON: bufToB64(cred.response.clientDataJSON) }, token);
    try { localStorage.setItem('gb_passkey', '1'); } catch (e) {}
    return true;
  }

  async function login(hub) {
    if (!disponible()) throw new Error('Este dispositivo no soporta Face ID en la web.');
    var reto = await post({ accion: 'reto-login' });
    var cred = await navigator.credentials.get({
      publicKey: { challenge: b64urlToBuf(reto.challenge), rpId: reto.rpId, userVerification: 'required', timeout: 60000, allowCredentials: [] }
    });
    if (!cred) throw new Error('Cancelado.');
    var d = await post({
      accion: 'login', id: reto.id,
      credentialId: bufToB64url(cred.rawId),
      authenticatorData: bufToB64(cred.response.authenticatorData),
      clientDataJSON: bufToB64(cred.response.clientDataJSON),
      signature: bufToB64(cred.response.signature)
    });
    // Establecer la sesión de Supabase con el token_hash del magic-link
    var v = await hub.auth.verifyOtp({ token_hash: d.token_hash, type: 'magiclink' });
    if (v.error) throw new Error(v.error.message || 'No pude iniciar sesión');
    try { localStorage.setItem('gb_passkey', '1'); } catch (e) {}
    return true;
  }

  window.GBPasskey = { disponible: disponible, enrolar: enrolar, login: login };
})();
