// ============================================================
//  Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) en crypto nativo, sin libs.
//  Lo usan push-cron.js y push-subscribe.js (el "_" hace que Netlify NO lo
//  publique como función suelta).
//  Env: VAPID_PUBLIC (base64url), VAPID_PRIVATE (pkcs8 base64), VAPID_SUBJECT.
// ============================================================
const crypto = require('crypto');

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4), 'base64');
const hkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

function vapidAuth(endpoint) {
  const pub = process.env.VAPID_PUBLIC;
  const privB64 = process.env.VAPID_PRIVATE;
  const sub = process.env.VAPID_SUBJECT || 'mailto:grandbardrive@gmail.com';
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub }));
  const signingInput = header + '.' + payload;
  const key = crypto.createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' });
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return { authorization: 'vapid t=' + signingInput + '.' + b64u(sig) + ', k=' + pub };
}

// sub = { endpoint, p256dh, auth } ; payloadObj = objeto JSON a enviar
async function sendPush(sub, payloadObj, ttl = 86400) {
  const uaPublic = unb64u(sub.p256dh);   // 65 bytes (0x04||X||Y)
  const authSecret = unb64u(sub.auth);   // 16 bytes
  const plaintext = Buffer.from(JSON.stringify(payloadObj), 'utf8');

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();  // 65 bytes uncompressed
  const shared = ecdh.computeSecret(uaPublic);

  const salt = crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(shared, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  const record = Buffer.concat([plaintext, Buffer.from([0x02])]); // delimitador de padding
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const rs = 4096;
  const head = Buffer.alloc(21);
  salt.copy(head, 0);
  head.writeUInt32BE(rs, 16);
  head.writeUInt8(asPublic.length, 20);
  const body = Buffer.concat([head, asPublic, ciphertext]);

  const { authorization } = vapidAuth(sub.endpoint);
  const resp = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Authorization: authorization,
    },
    body,
  });
  return { status: resp.status, gone: resp.status === 404 || resp.status === 410 };
}

module.exports = { sendPush };
