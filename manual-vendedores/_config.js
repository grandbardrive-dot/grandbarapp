// ─── Configuración Supabase ────────────────────────────────────────────────
const SUPABASE_URL      = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

// Contraseña del panel admin — cambiala cuando quieras
const ADMIN_PASSWORD = 'admin2024';

// Cliente Supabase (disponible globalmente en todos los HTML que incluyan este archivo)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
