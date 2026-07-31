// ─── Configuración de Sucursales ────────────────────────────────────────────
// Vendedores de San Luis (el resto es Mendoza por defecto)
const SAN_LUIS_CODIGOS = new Set(['006','010','017','041','043']);

// Vendedores que manejan ambos canales ON y OFF (pueden registrar cualquier activación)
const DUAL_CANAL_CODIGOS = new Set(['017','041']);

/** Retorna 'San Luis' o 'Mendoza' según el código de vendedor */
function getSucursal(codigoVendedor) {
  return SAN_LUIS_CODIGOS.has(String(codigoVendedor ?? '').trim())
    ? 'San Luis'
    : 'Mendoza';
}

/** Retorna true si el vendedor puede registrar activaciones de ambas ligas */
function isDualCanal(codigoVendedor) {
  return DUAL_CANAL_CODIGOS.has(String(codigoVendedor ?? '').trim());
}

/** Para un supervisor con liga 'AMBAS', determina si un vendedor es de su sucursal */
function esSupervisorAmbas(liga) {
  return liga === 'AMBAS';
}
