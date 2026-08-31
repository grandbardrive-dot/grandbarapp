/* ===========================================================
   GrandBar Hub — capa de autenticación (login por rol)
   -----------------------------------------------------------
   Usa Supabase Auth + una tabla `usuarios` que guarda el rol.
   Si Supabase no está configurado (supabase-config.js vacío),
   cae en MODO DEMO: no valida y usa el rol guardado localmente.
   =========================================================== */
(function () {
  const cfg = window.GB_SUPABASE || {};
  const CONFIGURED = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  let client = null;
  if (CONFIGURED && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const Auth = {
    configured: CONFIGURED,
    client,

    /* --- Iniciar sesión con email + contraseña --- */
    async signIn(email, password) {
      if (!CONFIGURED) {
        // Modo demo: acepta cualquier cosa y deja el rol por defecto.
        localStorage.setItem("gb_demo", "1");
        return { ok: true, demo: true };
      }
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true, user: data.user };
    },

    /* --- Traer la sesión + rol del usuario logueado --- */
    async getSession() {
      if (!CONFIGURED) {
        // Demo: sesión "fantasma" con el rol guardado (o admin).
        const role = localStorage.getItem("gb_role") || "admin";
        return { demo: true, user: { email: "demo@grandbar" }, role, nombre: "Equipo GrandBar" };
      }
      const { data: { session } } = await client.auth.getSession();
      if (!session) return null;
      // Buscar el rol en la tabla usuarios (id = auth.users.id)
      const { data: perfil } = await client
        .from("usuarios")
        .select("nombre, rol, es_supervisor, activo")
        .eq("id", session.user.id)
        .single();
      // Quien está marcado como "sin acceso" en el panel NO entra. Antes ese campo
      // era decorativo: el interruptor del panel decía "Sin acceso" y la persona
      // seguía entrando igual.
      if (perfil && perfil.activo === false) {
        try { await client.auth.signOut(); } catch (e) {}
        return { bloqueado: true, nombre: perfil.nombre || session.user.email };
      }
      return {
        user: session.user,
        role: perfil?.rol || "ventas",
        nombre: perfil?.nombre || session.user.email,
        es_supervisor: !!perfil?.es_supervisor,
      };
    },

    /* --- Cerrar sesión --- */
    async signOut() {
      if (CONFIGURED && client) await client.auth.signOut();
      localStorage.removeItem("gb_demo");
      window.location.href = "index.html";
    },

    /* --- Portero: llamar al inicio de una página protegida --- */
    async requireAuth() {
      const s = await this.getSession();
      if (!s) { window.location.href = "index.html"; return null; }
      if (s.bloqueado) {
        alert("Tu acceso está desactivado. Hablá con Nahuel o Josefina para que te lo habiliten.");
        window.location.href = "index.html";
        return null;
      }
      return s;
    },
  };

  window.GBAuth = Auth;
})();
