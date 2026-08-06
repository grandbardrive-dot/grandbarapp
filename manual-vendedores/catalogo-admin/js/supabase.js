// ============================================================
//  GrandBar · Catálogo · Cliente Supabase
// ============================================================
//  Se importa el SDK de Supabase vía CDN (ESM). En el HTML
//  este archivo se carga como módulo:
//      <script type="module" src="/js/supabase.js"></script>
//  o se importa desde otro módulo:
//      import { supabase } from '/js/supabase.js';
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ----------------------------------------------------------------
//  >>> COMPLETAR ESTOS VALORES <<<
//  Proyecto Supabase: fzaxwuuodseyyinveknn (el de vendedores)
// ----------------------------------------------------------------
const SUPABASE_URL      = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4'; // publishable key (pública)
// ----------------------------------------------------------------

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Nombre del bucket público de Storage y subcarpetas del catálogo.
export const STORAGE_BUCKET = 'Activaciones';
export const PATH_LOGOS     = 'catalogo/logos';
export const PATH_PRODUCTOS = 'catalogo/productos';
export const PATH_BANNERS   = 'catalogo/banners';

// Helper para obtener la URL pública de un archivo del bucket.
export function urlPublica(path) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
