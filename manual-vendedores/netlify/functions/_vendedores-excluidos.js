// ============================================================
//  Vendedores excluidos (25/11/2026): la ÚNICA lista de vendedores que se dejan afuera.
//  Pedido del usuario: "todos los filtros que tenemos en cuenta hasta ahora para excluir los
//  vendedores dejen de tener validez y empecemos a tener en cuenta los excluidos del archivo
//  vendedores excluidos de la carpeta share de drive".
//   · Archivo: "Vendedores Excluidos.xlsx", carpeta SHARE de Drive (Administración), columnas
//     "Vendedor" y "NroVendedor". Administración lo actualiza pisando el mismo archivo; si suben
//     uno nuevo (otro link), cambiar ARCHIVO.
//   · En VENTAS quedan fuera de todo: no salen en ninguna lista, selector ni ranking, y sus
//     ventas no cuentan en ningún número (decisión del usuario, 25/11/2026).
//   · En COBRANZAS no se excluye a nadie: cada cuenta sale con su cartera real (decisión del
//     usuario, 25/11/2026). Por eso las funciones de cobranzas no usan este módulo.
//  Reemplaza a vendedores.oculto (Manual), a dir_vendedor_excluido() (lista fija en la base) y a
//  la hoja "Excluidos" de "Comparativo (fuente)".
//  Las funciones leen el archivo directo. Para lo que se arma en la base o en el navegador (vista
//  de Power BI, listas de admin, admin-importar y supervisor del Manual) hay una copia en
//  vendedores.excluido que actualiza sync-ventas-cron cada 20 minutos (sincronizarBase).
//  (El "_" evita que Netlify lo publique como función.)
// ============================================================
const ARCHIVO = '1KXeCnIsY4seLsYGir5ZLAoZrQ5oegEbW';   // Vendedores Excluidos.xlsx (SHARE)
const URL_CSV = 'https://docs.google.com/spreadsheets/d/' + ARCHIVO + '/gviz/tq?tqx=out:csv';
// Si Drive no responde y no hay nada leído en esta instancia: la lista del archivo al 25/11/2026.
const RESPALDO = ['001', '003', '009', '018', '019', '020', '021', '022', '023', '034', '035', '036', '040', '042', '044', '045'];
const cod3 = c => { const s = String(c == null ? '' : c).trim(); return /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : s; };

function partirLinea(l) {
  const out = []; let cur = '', dentro = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (dentro && l[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro; }
    else if (ch === ',' && !dentro) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

// Lee el archivo de Drive. Si no se puede leer o viene vacío, error (no se inventa nada).
async function leerArchivo() {
  const r = await fetch(URL_CSV);
  if (!r.ok) throw new Error('Drive ' + r.status);
  const filas = String(await r.text()).replace(/\r/g, '').split('\n').filter(l => l.trim()).map(partirLinea);
  const cab = (filas.shift() || []).map(c => c.toLowerCase());
  let iCod = cab.findIndex(c => /nro|n[uú]mero|c[oó]d/.test(c));
  let iNom = cab.findIndex((c, i) => i !== iCod && /vendedor|nombre/.test(c));
  if (iCod < 0) iCod = 1;
  if (iNom < 0) iNom = 0;
  const lista = [];
  filas.forEach(f => {
    const codigo = cod3(f[iCod]);
    if (/^\d{3}$/.test(codigo) && !lista.some(x => x.codigo === codigo)) lista.push({ codigo, nombre: String(f[iNom] || '').replace(/\s+/g, ' ').trim() });
  });
  if (!lista.length) throw new Error('el archivo vino vacío');
  return lista;
}

let CACHE = { t: 0, lista: null };
// [{ codigo: '019', nombre: 'Analía Roldan' }, …] tal como está en el archivo. Caché de 10 minutos.
async function listaExcluidos() {
  if (CACHE.lista && Date.now() - CACHE.t < 10 * 60e3) return CACHE.lista;
  try {
    CACHE = { t: Date.now(), lista: await leerArchivo() };
  } catch (e) {
    console.error('vendedores-excluidos: no se pudo leer el archivo de Drive', String(e && e.message || e));
    if (!CACHE.lista) return RESPALDO.map(codigo => ({ codigo, nombre: '' }));
  }
  return CACHE.lista;
}
// Set con los códigos (3 dígitos) de los excluidos.
async function excluidos() { return new Set((await listaExcluidos()).map(x => x.codigo)); }
// ¿Este código es de un vendedor excluido? (acepta '2', '02' o '002')
const esExcluido = (set, codigo) => codigo != null && String(codigo).trim() !== '' && set.has(cod3(codigo));

// Copia el archivo en vendedores.excluido (base del Manual), para lo que se arma en la base o en
// el navegador: la vista de Power BI (dir_vendedor_excluido) y las listas de admin, admin-importar
// y supervisor. La llama sync-ventas-cron cada 20 minutos. Si el archivo no se puede leer, no toca
// nada. (La tabla vendedores ya se escribe con la clave pública, como el resto del Manual.)
async function sincronizarBase() {
  const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
  const MAN_KEY = process.env.MANUAL_SERVICE_ROLE || process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
  const lista = await leerArchivo();
  CACHE = { t: Date.now(), lista };
  const cods = lista.map(x => x.codigo).join(',');
  const patch = async (filtro, valor) => {
    const r = await fetch(MAN_URL + '/rest/v1/vendedores?' + filtro, {
      method: 'PATCH',
      headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ excluido: valor }),
    });
    if (!r.ok) throw new Error('vendedores ' + r.status + ' ' + (await r.text()).slice(0, 150));
    return ((await r.json()) || []).map(v => v.codigo);
  };
  const marcados = await patch('codigo=in.(' + cods + ')&excluido=is.false&select=codigo', true);
  const sacados = await patch('codigo=not.in.(' + cods + ')&excluido=is.true&select=codigo', false);
  return { excluidos: lista.length, marcados, sacados };
}

module.exports = { excluidos, listaExcluidos, esExcluido, cod3, sincronizarBase, ARCHIVO };
