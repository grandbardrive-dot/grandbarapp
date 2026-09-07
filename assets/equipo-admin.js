/* ===========================================================
   GrandBar — Equipo de administración
   -----------------------------------------------------------
   Dos secciones del panel de Brenda:
     · Tareas del equipo  — qué tiene que hacer cada una y qué se hizo
     · Agenda del equipo  — el calendario compartido

   Las personas del equipo son filas de admin_equipo, no cuentas del Portal:
   hoy solo Mónica tiene cuenta. Así se puede seguir el trabajo de las cinco
   igual, y el día que tengan cuenta no hay que recargar nada.

   Estas tablas viven en el Hub, así que se leen y escriben derecho con la
   sesión del usuario (GBAuth.client) y las reglas de la base. No hace falta
   una function: no hay plata de por medio, es la agenda del área.
   =========================================================== */

/* Estas cuatro las tenía cobranzas.js. Ahora las trae este archivo para que la
   agenda pueda vivir sola en el Hub y, al mismo tiempo, adentro del panel. */
const eqQ   = id => document.getElementById(id);
const eqEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const eqErr = m => `<div class="aviso"><span>⚠️</span><div>${eqEsc(m)}</div></div>`;
// Dentro del panel de Cobranzas vuelve al tablero; sola en el Hub, al Hub.
const eqCabecera = (t, sub) =>
  (typeof cobTablero === 'function'
    ? `<button class="cb-volver" onclick="cobTablero()">‹ Volver al tablero</button>`
    : `<a class="cb-volver" href="hub.html">‹ Volver al Hub</a>`) +
  `<div class="head"><div><h1>${eqEsc(t)}</h1><div class="head-sub">${eqEsc(sub)}</div></div></div>`;

const EQ_DIAS  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const EQ_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
const EQ_COLORES = ['#2f6db0','#e0567f','#69a531','#d6a52b','#7b5cd6','#2d8a4f','#e0533c'];
const EQ_FREQ = {
  diaria:  'Todos los días',
  habiles: 'De lunes a viernes',
  semanal: 'Una vez por semana',
  puntual: 'Un día puntual',
};
const EQ_TIPOS = {
  evento:       { n:'Evento',       ico:'📌' },
  reunion:      { n:'Reunión',      ico:'👥' },
  vencimiento:  { n:'Vencimiento',  ico:'⏰' },
  recordatorio: { n:'Recordatorio', ico:'🔔' },
};

let EQ_GENTE = null;            // se lee una vez y se guarda
let _eqDia = null, _eqMes = null;

const eqSb    = () => GBAuth.client;
const eqISO   = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const eqHoy   = () => eqISO(new Date());
const eqDe    = s => new Date(s + 'T00:00:00');          // sin sorpresas de zona horaria
const eqSuma  = (s, n) => { const d = eqDe(s); d.setDate(d.getDate()+n); return eqISO(d); };
const eqLargo = s => { const d = eqDe(s); return EQ_DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + EQ_MESES[d.getMonth()]; };
const eqColor = i => EQ_COLORES[i % EQ_COLORES.length];
const eqIni   = n => String(n || '?').trim().slice(0,1).toUpperCase();
const eqCap   = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const eqComilla = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/* Una escritura bloqueada por las reglas de la base NO da error: devuelve 200
   y cero filas. Por eso todo lo que escribe pasa por acá. */
async function eqEscribir(consulta, queEs) {
  const { data, error } = await consulta;
  if (error) { alert('No se pudo ' + queEs + ': ' + error.message); return null; }
  if (!data || !data.length) {
    alert('No se pudo ' + queEs + '. Tu usuario no tiene permiso para esto.');
    return null;
  }
  return data;
}

async function eqGente(recargar) {
  if (EQ_GENTE && !recargar) return EQ_GENTE;
  const { data } = await eqSb().from('admin_equipo').select('*').eq('activo', true).order('orden');
  EQ_GENTE = data || [];
  return EQ_GENTE;
}

async function eqSelectGente(id, incluirTodos) {
  const g = await eqGente();
  return `<select id="${id}">${incluirTodos ? '<option value="">Todo el equipo</option>' : ''}` +
    g.map(p => `<option value="${p.id}">${eqEsc(p.nombre)}</option>`).join('') + '</select>';
}


/* ══════════ Tareas del equipo ══════════ */

function eqAplica(t, fecha) {
  const d = eqDe(fecha).getDay();
  const dow = d === 0 ? 7 : d;                            // 1=lunes … 7=domingo
  if (t.frecuencia === 'puntual') return t.fecha === fecha;
  if (t.frecuencia === 'semanal') return t.dia_semana === dow;
  if (t.frecuencia === 'habiles') return dow <= 5;
  return true;
}

async function eqTareas(fecha) {
  _eqDia = fecha || _eqDia || eqHoy();
  eqQ('cob').innerHTML = eqCabecera('Tareas del equipo', 'Qué tiene que hacer cada una y qué quedó hecho.') +
    `<div class="cb-paginado">
       <button class="cb-b" onclick="eqTareas('${eqSuma(_eqDia,-1)}')">‹</button>
       <b style="font-size:14px;min-width:210px;text-align:center">${eqEsc(eqLargo(_eqDia))}</b>
       <button class="cb-b" onclick="eqTareas('${eqSuma(_eqDia,1)}')">›</button>
       ${_eqDia !== eqHoy() ? `<button class="cb-b" onclick="eqTareas('${eqHoy()}')">Volver a hoy</button>` : ''}
       <span style="flex:1"></span>
       <button class="cb-b ok" onclick="eqFormTarea()">＋ Nueva tarea</button>
       <button class="cb-b" onclick="eqEditarEquipo()">👥 Editar equipo</button>
     </div>
     <div id="eq-form"></div>
     <div id="eq-lista"><div class="pv-vacio">Cargando…</div></div>`;
  eqPintarTareas();
}

async function eqPintarTareas() {
  try {
    const gente = await eqGente();
    if (!gente.length) {
      eqQ('eq-lista').innerHTML = `<div class="pv-vacio">Todavía no hay nadie cargado en el equipo.
        Tocá “Editar equipo” para agregar a la primera persona.</div>`;
      return;
    }
    const [rt, rh] = await Promise.all([
      eqSb().from('admin_tareas').select('*').eq('activa', true).order('created_at'),
      eqSb().from('admin_tareas_hechas').select('tarea_id').eq('fecha', _eqDia),
    ]);
    const hecho  = new Set((rh.data || []).map(h => h.tarea_id));
    const delDia = (rt.data || []).filter(t => eqAplica(t, _eqDia));

    const total = delDia.length, listas = delDia.filter(t => hecho.has(t.id)).length;
    const resumen = !total
      ? `<div class="pv-vacio">No hay tareas cargadas para este día.</div>`
      : `<div class="eq-barra"><div class="eq-barra-in" style="width:${Math.round(listas / total * 100)}%"></div></div>
         <p style="font-size:13px;color:var(--muted);margin:8px 0 0">
           ${listas} de ${total} hechas${listas === total ? ' — todo al día 🎉' : ''}</p>`;

    eqQ('eq-lista').innerHTML = resumen + '<div class="eq-gente">' + gente.map((p, i) => {
      const suyas = delDia.filter(t => t.persona_id === p.id);
      const ok = suyas.filter(t => hecho.has(t.id)).length;
      return `<section class="eq-persona">
        <header>
          <span class="eq-av" style="background:${eqColor(i)}">${eqEsc(eqIni(p.nombre))}</span>
          <div><b>${eqEsc(p.nombre)}</b><small>${eqEsc(p.puesto || '')}</small></div>
          <span class="cb-chip ${suyas.length && ok === suyas.length ? 'ok' : ''}">${ok}/${suyas.length}</span>
        </header>
        ${suyas.length ? suyas.map(t => `
          <label class="eq-t ${hecho.has(t.id) ? 'lista' : ''}">
            <input type="checkbox" ${hecho.has(t.id) ? 'checked' : ''} onchange="eqMarcar('${t.id}', this.checked)">
            <div><b>${eqEsc(t.titulo)}</b>
              ${t.descripcion ? `<small>${eqEsc(t.descripcion)}</small>` : ''}
              <small class="eq-freq">${eqEsc(EQ_FREQ[t.frecuencia] || t.frecuencia)}</small></div>
            <button class="eq-x" title="Sacar la tarea" onclick="event.preventDefault();eqBorrarTarea('${t.id}','${eqComilla(t.titulo)}')">✕</button>
          </label>`).join('')
          : '<div class="eq-nada">Sin tareas para este día.</div>'}
      </section>`;
    }).join('') + '</div>';
  } catch (e) { eqQ('eq-lista').innerHTML = eqErr(e.message); }
}

async function eqMarcar(id, marcada) {
  if (marcada) {
    const s = (await GBAuth.getSession()) || {};
    await eqEscribir(eqSb().from('admin_tareas_hechas')
      .insert({ tarea_id: id, fecha: _eqDia, quien: s.nombre || null }).select(), 'marcar la tarea');
  } else {
    await eqSb().from('admin_tareas_hechas').delete().eq('tarea_id', id).eq('fecha', _eqDia);
  }
  eqPintarTareas();
}

async function eqFormTarea() {
  const cont = eqQ('eq-form');
  if (cont.dataset.abierto === 'tarea') { cont.innerHTML = ''; cont.dataset.abierto = ''; return; }
  cont.dataset.abierto = 'tarea';
  cont.innerHTML = `<div class="eq-form">
    <h3>Nueva tarea</h3>
    <div class="eq-campos">
      <label>Qué hay que hacer<input type="text" id="t-tit" placeholder="Ej: conciliar la caja chica"></label>
      <label>Para quién${await eqSelectGente('t-per')}</label>
      <label>Cada cuánto<select id="t-fre" onchange="eqFreqCambio()">
        ${Object.keys(EQ_FREQ).map(k => `<option value="${k}">${EQ_FREQ[k]}</option>`).join('')}
      </select></label>
      <label id="t-dow-l" hidden>Qué día<select id="t-dow">
        ${[1,2,3,4,5,6,7].map(d => `<option value="${d}">${EQ_DIAS[d === 7 ? 0 : d]}</option>`).join('')}
      </select></label>
      <label id="t-fec-l" hidden>Qué fecha<input type="date" id="t-fec" value="${_eqDia}"></label>
      <label class="ancho">Detalle (opcional)<input type="text" id="t-des" placeholder="Aclaración, cómo se hace, con quién"></label>
    </div>
    <div class="pd-acts">
      <button class="cb-b ok" onclick="eqGuardarTarea()">Guardar</button>
      <button class="cb-b" onclick="eqFormTarea()">Cancelar</button>
    </div></div>`;
  eqQ('t-tit').focus();
}

function eqFreqCambio() {
  const f = eqQ('t-fre').value;
  eqQ('t-dow-l').hidden = f !== 'semanal';
  eqQ('t-fec-l').hidden = f !== 'puntual';
}

async function eqGuardarTarea() {
  const titulo = eqQ('t-tit').value.trim();
  if (!titulo) { alert('Poné qué hay que hacer.'); eqQ('t-tit').focus(); return; }
  const frecuencia = eqQ('t-fre').value;
  const s = (await GBAuth.getSession()) || {};
  const fila = {
    titulo, descripcion: eqQ('t-des').value.trim() || null,
    persona_id: eqQ('t-per').value, frecuencia,
    dia_semana: frecuencia === 'semanal' ? +eqQ('t-dow').value : null,
    fecha:      frecuencia === 'puntual' ? eqQ('t-fec').value : null,
    creado_por: s.nombre || null,
  };
  if (await eqEscribir(eqSb().from('admin_tareas').insert(fila).select(), 'guardar la tarea')) {
    eqQ('eq-form').innerHTML = ''; eqQ('eq-form').dataset.abierto = '';
    eqPintarTareas();
  }
}

async function eqBorrarTarea(id, titulo) {
  if (!confirm('¿Sacar “' + titulo + '” de la lista?\n\nLo que ya se marcó como hecho queda registrado.')) return;
  if (await eqEscribir(eqSb().from('admin_tareas').update({ activa: false }).eq('id', id).select(), 'sacar la tarea')) {
    eqPintarTareas();
  }
}


/* ══════════ El equipo ══════════ */

async function eqEditarEquipo(forzar) {
  const cont = eqQ('eq-form');
  if (cont.dataset.abierto === 'equipo' && !forzar) { cont.innerHTML = ''; cont.dataset.abierto = ''; return; }
  cont.dataset.abierto = 'equipo';
  const { data } = await eqSb().from('admin_equipo').select('*').order('orden');
  cont.innerHTML = `<div class="eq-form">
    <h3>El equipo</h3>
    <table class="cb-tabla" style="margin-top:10px">
      <thead><tr><th>Nombre</th><th>Puesto</th><th>Aparece en el tablero</th></tr></thead>
      <tbody>${(data || []).map(p => `<tr>
        <td><input type="text" value="${eqEsc(p.nombre)}" onchange="eqGuardarPersona('${p.id}',{nombre:this.value.trim()})"></td>
        <td><input type="text" value="${eqEsc(p.puesto || '')}" placeholder="Administración" onchange="eqGuardarPersona('${p.id}',{puesto:this.value.trim()||null})"></td>
        <td><label class="eq-sw"><input type="checkbox" ${p.activo ? 'checked' : ''} onchange="eqGuardarPersona('${p.id}',{activo:this.checked})"> ${p.activo ? 'Sí' : 'No'}</label></td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="eq-campos" style="margin-top:14px">
      <label>Agregar a alguien<input type="text" id="p-nom" placeholder="Nombre"></label>
      <label>Puesto<input type="text" id="p-pue" placeholder="Administración"></label>
    </div>
    <div class="pd-acts">
      <button class="cb-b ok" onclick="eqAgregarPersona()">Agregar</button>
      <button class="cb-b" onclick="eqEditarEquipo()">Cerrar</button>
    </div>
    <p style="font-size:12.5px;color:var(--muted);margin:12px 0 0">
      Sacar a alguien del tablero no borra nada: sus tareas y lo que hizo quedan guardados.</p>
  </div>`;
}

async function eqGuardarPersona(id, campos) {
  if (await eqEscribir(eqSb().from('admin_equipo').update(campos).eq('id', id).select(), 'guardar el cambio')) {
    await eqGente(true);
    eqEditarEquipo(true);
  }
}

async function eqAgregarPersona() {
  const nombre = eqQ('p-nom').value.trim();
  if (!nombre) { alert('Poné el nombre.'); eqQ('p-nom').focus(); return; }
  const { data } = await eqSb().from('admin_equipo').select('orden').order('orden', { ascending: false }).limit(1);
  const orden = ((data || [])[0] || {}).orden || 0;
  if (await eqEscribir(eqSb().from('admin_equipo')
        .insert({ nombre, puesto: eqQ('p-pue').value.trim() || null, orden: orden + 10 }).select(), 'agregar a la persona')) {
    await eqGente(true);
    eqEditarEquipo(true);
  }
}


/* ══════════ Agenda compartida ══════════ */

async function eqAgenda(mes) {
  const hoy = new Date();
  _eqMes = mes || _eqMes || eqISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const ini = eqDe(_eqMes);
  const anterior  = eqISO(new Date(ini.getFullYear(), ini.getMonth() - 1, 1));
  const siguiente = eqISO(new Date(ini.getFullYear(), ini.getMonth() + 1, 1));

  eqQ('cob').innerHTML = eqCabecera('Agenda del equipo', 'El calendario compartido: reuniones, vencimientos y recordatorios.') +
    `<div class="cb-paginado">
       <button class="cb-b" onclick="eqAgenda('${anterior}')">‹</button>
       <b style="font-size:14px;min-width:190px;text-align:center;text-transform:capitalize">${EQ_MESES[ini.getMonth()]} ${ini.getFullYear()}</b>
       <button class="cb-b" onclick="eqAgenda('${siguiente}')">›</button>
       <span style="flex:1"></span>
       <button class="cb-b ok" onclick="eqFormEvento()">＋ Agendar algo</button>
     </div>
     <div id="eq-form"></div>
     <div id="eq-cal"><div class="pv-vacio">Cargando…</div></div>`;
  eqPintarAgenda();
}

async function eqPintarAgenda() {
  try {
    const ini = eqDe(_eqMes);
    const finMes = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
    const [gente, re] = await Promise.all([
      eqGente(),
      eqSb().from('admin_agenda').select('*')
        .gte('fecha', _eqMes).lte('fecha', eqISO(finMes))
        .order('fecha').order('hora'),
    ]);
    const evs = re.data || [];
    const quien = {}; gente.forEach((p, i) => { quien[p.id] = { n: p.nombre, c: eqColor(i) }; });
    const porDia = {};
    evs.forEach(e => { (porDia[e.fecha] = porDia[e.fecha] || []).push(e); });

    // El calendario arranca el lunes de la semana en la que cae el día 1.
    const primer = ini.getDay() === 0 ? 7 : ini.getDay();
    const celdas = [];
    for (let i = 1; i < primer; i++) celdas.push(null);
    for (let d = 1; d <= finMes.getDate(); d++) celdas.push(eqISO(new Date(ini.getFullYear(), ini.getMonth(), d)));
    while (celdas.length % 7) celdas.push(null);

    const hoy = eqHoy();
    const proximos = evs.filter(e => e.fecha >= hoy).slice(0, 12);

    eqQ('eq-cal').innerHTML = `
      <div class="eq-cal">
        ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => `<div class="eq-cab">${d}</div>`).join('')}
        ${celdas.map(f => {
          if (!f) return '<div class="eq-celda vacia"></div>';
          const del = porDia[f] || [];
          return `<div class="eq-celda ${f === hoy ? 'hoy' : ''}" onclick="eqFormEvento('${f}')">
            <span class="eq-num">${eqDe(f).getDate()}</span>
            ${del.slice(0, 3).map(e => {
              const p = e.persona_id ? quien[e.persona_id] : null;
              return `<div class="eq-ev" style="border-left-color:${p ? p.c : '#9aa7b0'}" title="${eqEsc(e.titulo)}">
                ${(EQ_TIPOS[e.tipo] || EQ_TIPOS.evento).ico} ${e.hora ? eqEsc(String(e.hora).slice(0,5)) + ' ' : ''}${eqEsc(e.titulo)}</div>`;
            }).join('')}
            ${del.length > 3 ? `<div class="eq-mas">+${del.length - 3} más</div>` : ''}
          </div>`;
        }).join('')}
      </div>

      <h2 style="font-size:16px;margin:26px 0 0">Lo que viene</h2>
      ${proximos.length ? `<table class="cb-tabla">
        <thead><tr><th>Cuándo</th><th>Qué</th><th>Quién</th><th></th></tr></thead>
        <tbody>${proximos.map(e => {
          const p = e.persona_id ? quien[e.persona_id] : null;
          return `<tr>
            <td><b>${eqEsc(eqCap(eqLargo(e.fecha)))}</b>${e.hora ? ' · ' + eqEsc(String(e.hora).slice(0,5)) : ''}</td>
            <td>${(EQ_TIPOS[e.tipo] || EQ_TIPOS.evento).ico} <b>${eqEsc(e.titulo)}</b>
              ${e.detalle ? `<div style="color:var(--muted);font-size:12.5px">${eqEsc(e.detalle)}</div>` : ''}</td>
            <td>${p ? eqEsc(p.n) : 'Todo el equipo'}</td>
            <td><button class="cb-b danger" onclick="eqBorrarEvento('${e.id}','${eqComilla(e.titulo)}')">Quitar</button></td>
          </tr>`;
        }).join('')}</tbody></table>`
        : '<div class="pv-vacio">No hay nada agendado de acá en adelante este mes.</div>'}`;
  } catch (e) { eqQ('eq-cal').innerHTML = eqErr(e.message); }
}

async function eqFormEvento(fecha) {
  const cont = eqQ('eq-form');
  if (cont.dataset.abierto === 'evento' && !fecha) { cont.innerHTML = ''; cont.dataset.abierto = ''; return; }
  cont.dataset.abierto = 'evento';
  cont.innerHTML = `<div class="eq-form">
    <h3>Agendar</h3>
    <div class="eq-campos">
      <label>Qué<input type="text" id="e-tit" placeholder="Ej: vencimiento de IVA"></label>
      <label>Cuándo<input type="date" id="e-fec" value="${fecha || eqHoy()}"></label>
      <label>Hora (opcional)<input type="time" id="e-hor"></label>
      <label>Qué es<select id="e-tip">
        ${Object.keys(EQ_TIPOS).map(k => `<option value="${k}">${EQ_TIPOS[k].ico} ${EQ_TIPOS[k].n}</option>`).join('')}
      </select></label>
      <label>De quién${await eqSelectGente('e-per', true)}</label>
      <label class="ancho">Detalle (opcional)<input type="text" id="e-det" placeholder="Dónde, con quién, qué hay que llevar"></label>
    </div>
    <div class="pd-acts">
      <button class="cb-b ok" onclick="eqGuardarEvento()">Guardar</button>
      <button class="cb-b" onclick="eqFormEvento()">Cancelar</button>
    </div></div>`;
  eqQ('e-tit').focus();
}

async function eqGuardarEvento() {
  const titulo = eqQ('e-tit').value.trim();
  if (!titulo) { alert('Poné qué se agenda.'); eqQ('e-tit').focus(); return; }
  const s = (await GBAuth.getSession()) || {};
  const fila = {
    titulo, detalle: eqQ('e-det').value.trim() || null,
    fecha: eqQ('e-fec').value, hora: eqQ('e-hor').value || null,
    persona_id: eqQ('e-per').value || null, tipo: eqQ('e-tip').value,
    creado_por: s.nombre || null,
  };
  if (!fila.fecha) { alert('Poné la fecha.'); return; }
  if (await eqEscribir(eqSb().from('admin_agenda').insert(fila).select(), 'guardar')) {
    eqQ('eq-form').innerHTML = ''; eqQ('eq-form').dataset.abierto = '';
    eqAgenda(fila.fecha.slice(0, 8) + '01');
  }
}

async function eqBorrarEvento(id, titulo) {
  if (!confirm('¿Sacar “' + titulo + '” de la agenda?')) return;
  await eqSb().from('admin_agenda').delete().eq('id', id);
  eqPintarAgenda();
}
