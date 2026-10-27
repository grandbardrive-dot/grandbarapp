/* ===========================================================
   GrandBar Hub — Presupuestos (Marketing)
   Buzón compartido de presupuestos de proveedores: foto, link,
   estado y condiciones (mínimo de compra, costos). Compartido
   entre Josefina, Nahuel, Sepúlveda y Fernando (tabla presupuestos
   en el HUB; ver presupuestos-setup.sql).
   Se usa desde mi-panel.html y presupuestos.html:
     GBPresupuestos.init({ sb, yo, mount:'#presupuestos-app' })
   =========================================================== */
(function(){
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ESTADOS = [
    ['consultado','Consultado','pz-consultado'],
    ['pedir','Por pedir','pz-pedir'],
    ['pedido','Pedido','pz-pedido'],
    ['aceptado','Aceptado','pz-aceptado'],
    ['rechazado','Rechazado','pz-rechazado'],
  ];
  const ESTLAB = Object.fromEntries(ESTADOS.map(e=>[e[0],e[1]]));
  const ESTCLS = Object.fromEntries(ESTADOS.map(e=>[e[0],e[2]]));
  // Cliente para subir fotos al bucket público de imágenes (proyecto Manual)
  let man=null;
  function manClient(){
    if(man) return man;
    man = window.supabase.createClient('https://fzaxwuuodseyyinveknn.supabase.co','sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk');
    return man;
  }
  async function subirFoto(file){
    const ext = (file.name.split('.').pop()||'jpg').toLowerCase();
    const path = 'presupuestos/'+Date.now()+'-'+Math.random().toString(36).slice(2,7)+'.'+ext;
    const c = manClient();
    const { error } = await c.storage.from('Activaciones').upload(path, file, { upsert:false, contentType:file.type });
    if(error) throw error;
    return c.storage.from('Activaciones').getPublicUrl(path).data.publicUrl;
  }

  const CSS = `
  .pz-form{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:14px}
  .pz-form .pz-head{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-weight:800;font-size:14px}
  .pz-form .pz-head .pz-x{margin-left:auto;border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;color:var(--muted)}
  .pz-row{display:grid;grid-template-columns:1fr;gap:10px}
  .pz-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .pz-lab{display:block;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:5px}
  .pz-in{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;color:var(--ink);background:#fff;outline:none}
  .pz-in:focus{border-color:var(--gold)}
  .pz-file{font-size:13px}
  .pz-prev{margin-top:8px}.pz-prev img{max-height:92px;border-radius:10px;border:1px solid var(--line)}
  .pz-msg{font-size:13px;margin:10px 0 0}
  .pz-filtros{display:flex;gap:7px;flex-wrap:wrap;margin:4px 0 14px}
  .pz-fb{border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:20px;padding:6px 13px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
  .pz-fb.on{background:var(--navy);border-color:var(--navy);color:#fff}
  .pz-fb .n{opacity:.6;margin-left:5px}
  .pz-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
  .pz-card{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
  .pz-card .pz-foto{display:block;width:100%;height:150px;object-fit:cover;background:var(--line2)}
  .pz-card .pz-nofoto{height:150px;display:grid;place-items:center;background:var(--line2);color:var(--muted);font-size:30px}
  .pz-card .pz-body{padding:13px 15px;display:flex;flex-direction:column;gap:9px;flex:1}
  .pz-card .pz-prov{font-weight:800;font-size:15.5px;line-height:1.25}
  .pz-pill{align-self:flex-start;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap}
  .pz-consultado{background:#e8f0f7;color:var(--blue)}
  .pz-pedir{background:var(--amber-s);color:#8a6a1e}
  .pz-pedido{background:var(--gold-s);color:var(--gold-d)}
  .pz-aceptado{background:var(--green-s);color:var(--green-d)}
  .pz-rechazado{background:var(--danger-s);color:var(--danger)}
  .pz-cond{font-size:13px;color:var(--ink);line-height:1.45}
  .pz-cond b{color:var(--muted);font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.03em;display:block;margin-top:2px}
  .pz-link{font-size:12.5px;font-weight:700;color:var(--gold-d);text-decoration:none;word-break:break-all}
  .pz-acts{display:flex;gap:6px;margin-top:auto;padding-top:4px;flex-wrap:wrap}
  .pz-mini{border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:11.5px;font-weight:700;color:var(--ink);cursor:pointer}
  .pz-mini:hover{border-color:var(--navy)} .pz-mini.del:hover{border-color:var(--danger);color:var(--danger)}
  .pz-selest{border:1px solid var(--line);border-radius:8px;padding:5px 8px;font:inherit;font-size:11.5px;font-weight:700;color:var(--ink);background:#fff;cursor:pointer}
  .pz-empty{text-align:center;color:var(--muted);font-size:13.5px;padding:26px 16px;background:#fff;border:1px dashed var(--line);border-radius:12px}
  @media (max-width:560px){ .pz-g2{grid-template-columns:1fr} }
  `;

  function init(opts){
    const sb = opts.sb, YO = opts.yo || 'GrandBar';
    const mount = typeof opts.mount==='string' ? document.querySelector(opts.mount) : opts.mount;
    if(!mount || !sb) return;
    if(!document.getElementById('pz-css')){ const st=document.createElement('style'); st.id='pz-css'; st.textContent=CSS; document.head.appendChild(st); }

    mount.innerHTML = `
      <div class="pz-form">
        <div class="pz-head"><span id="pz-ftit">＋ Nuevo presupuesto</span><button class="pz-x" id="pz-cancel" style="display:none">Cancelar</button></div>
        <div class="pz-row">
          <div><span class="pz-lab">Proveedor</span><input id="pz-prov" class="pz-in" type="text" placeholder="Ej: Distribuidora López"></div>
          <div class="pz-g2">
            <div><span class="pz-lab">Link al proveedor</span><input id="pz-link" class="pz-in" type="url" placeholder="https://…"></div>
            <div><span class="pz-lab">Estado</span><select id="pz-est" class="pz-in">${ESTADOS.map(e=>`<option value="${e[0]}">${e[1]}</option>`).join('')}</select></div>
          </div>
          <div>
            <span class="pz-lab">Foto del presupuesto / producto</span>
            <input id="pz-foto" class="pz-in pz-file" type="file" accept="image/*">
            <div class="pz-prev" id="pz-prev"></div>
          </div>
          <div class="pz-g2">
            <div><span class="pz-lab">Mínimo de compra</span><input id="pz-min" class="pz-in" type="text" placeholder="Ej: 6 cajas / $150.000"></div>
            <div><span class="pz-lab">Costos / condiciones</span><input id="pz-cos" class="pz-in" type="text" placeholder="Ej: $8.900 c/u + flete"></div>
          </div>
          <div><span class="pz-lab">Notas (opcional)</span><textarea id="pz-not" class="pz-in" rows="2" placeholder="Lo que te pasen cuando manden el presupuesto…" style="resize:vertical"></textarea></div>
        </div>
        <div class="pz-msg" id="pz-msg"></div>
        <button class="btn" id="pz-save" style="margin-top:12px">＋ Agregar presupuesto</button>
      </div>
      <div class="pz-filtros" id="pz-filtros"></div>
      <div class="pz-cards" id="pz-cards"><div class="pz-empty" style="grid-column:1/-1">Cargando…</div></div>
    `;

    const $ = id => mount.querySelector('#'+id);
    let LISTA=[], FILTRO='', EDIT=null, _file=null, _delFoto=false;

    function msg(t,c){ $('pz-msg').textContent=t||''; $('pz-msg').style.color=c||'var(--muted)'; }
    function resetForm(){
      EDIT=null; _file=null; _delFoto=false;
      $('pz-prov').value=''; $('pz-link').value=''; $('pz-est').value='consultado';
      $('pz-min').value=''; $('pz-cos').value=''; $('pz-not').value=''; $('pz-foto').value='';
      $('pz-prev').innerHTML=''; msg('');
      $('pz-ftit').textContent='＋ Nuevo presupuesto';
      $('pz-save').textContent='＋ Agregar presupuesto';
      $('pz-cancel').style.display='none';
    }

    $('pz-foto').addEventListener('change', e=>{
      _file = e.target.files[0]||null; _delFoto=false;
      if(_file){ $('pz-prev').innerHTML='<img src="'+URL.createObjectURL(_file)+'">'; }
      else if(EDIT && EDIT.foto_url){ $('pz-prev').innerHTML='<img src="'+esc(EDIT.foto_url)+'">'; }
      else $('pz-prev').innerHTML='';
    });
    $('pz-cancel').addEventListener('click', resetForm);
    $('pz-save').addEventListener('click', guardar);

    async function cargar(){
      try{
        const { data, error } = await sb.from('presupuestos').select('*').order('created_at',{ascending:false});
        if(error) throw error;
        LISTA = data||[]; render();
      }catch(e){ $('pz-cards').innerHTML='<div class="pz-empty" style="grid-column:1/-1">No se pudieron cargar los presupuestos.<br>'+esc(e.message||e)+'</div>'; }
    }

    function cuenta(k){ return k? LISTA.filter(p=>p.estado===k).length : LISTA.length; }
    function render(){
      const FS=[['','Todos'],...ESTADOS.map(e=>[e[0],e[1]])];
      $('pz-filtros').innerHTML=FS.map(([k,l])=>`<button class="pz-fb ${FILTRO===k?'on':''}" data-f="${k}">${l}<span class="n">${cuenta(k)}</span></button>`).join('');
      $('pz-filtros').querySelectorAll('.pz-fb').forEach(b=>b.onclick=()=>{ FILTRO=b.dataset.f; render(); });
      const lista = FILTRO? LISTA.filter(p=>p.estado===FILTRO) : LISTA;
      if(!lista.length){ $('pz-cards').innerHTML='<div class="pz-empty" style="grid-column:1/-1">'+(LISTA.length?'No hay presupuestos en este estado.':'Todavía no cargaste ningún presupuesto. Agregá el primero arriba.')+'</div>'; return; }
      $('pz-cards').innerHTML = lista.map(p=>{
        const foto = p.foto_url ? `<img class="pz-foto" src="${esc(p.foto_url)}" alt="">` : `<div class="pz-nofoto">🧾</div>`;
        const estSel = ESTADOS.map(e=>`<option value="${e[0]}" ${p.estado===e[0]?'selected':''}>${e[1]}</option>`).join('');
        const cond = [];
        if(p.minimo_compra) cond.push(`<div class="pz-cond"><b>Mínimo de compra</b>${esc(p.minimo_compra)}</div>`);
        if(p.costos)        cond.push(`<div class="pz-cond"><b>Costos / condiciones</b>${esc(p.costos)}</div>`);
        if(p.notas)         cond.push(`<div class="pz-cond"><b>Notas</b>${esc(p.notas)}</div>`);
        return `<div class="pz-card">
          ${p.link?`<a href="${esc(p.link)}" target="_blank" rel="noopener">${foto}</a>`:foto}
          <div class="pz-body">
            <div class="pz-prov">${esc(p.proveedor)}</div>
            <span class="pz-pill ${ESTCLS[p.estado]||'pz-consultado'}">${ESTLAB[p.estado]||esc(p.estado)}</span>
            ${p.link?`<a class="pz-link" href="${esc(p.link)}" target="_blank" rel="noopener">🔗 ${esc(p.link)}</a>`:''}
            ${cond.join('')}
            <div class="pz-acts">
              <select class="pz-selest" data-id="${p.id}">${estSel}</select>
              <button class="pz-mini" data-edit="${p.id}">✏ Editar</button>
              <button class="pz-mini del" data-del="${p.id}">🗑</button>
            </div>
          </div>
        </div>`;
      }).join('');
      $('pz-cards').querySelectorAll('.pz-selest').forEach(s=>s.onchange=()=>cambiarEstado(s.dataset.id,s.value));
      $('pz-cards').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editar(b.dataset.edit));
      $('pz-cards').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>borrar(b.dataset.del));
    }

    function editar(id){
      const p=LISTA.find(x=>x.id===id); if(!p) return;
      EDIT=p; _file=null; _delFoto=false;
      $('pz-prov').value=p.proveedor||''; $('pz-link').value=p.link||''; $('pz-est').value=p.estado||'consultado';
      $('pz-min').value=p.minimo_compra||''; $('pz-cos').value=p.costos||''; $('pz-not').value=p.notas||'';
      $('pz-foto').value=''; $('pz-prev').innerHTML = p.foto_url?('<img src="'+esc(p.foto_url)+'">'):'';
      $('pz-ftit').textContent='✏ Editar presupuesto';
      $('pz-save').textContent='Guardar cambios';
      $('pz-cancel').style.display='';
      mount.querySelector('.pz-form').scrollIntoView({behavior:'smooth',block:'center'});
      msg('');
    }

    async function cambiarEstado(id,estado){
      try{
        const { error } = await sb.from('presupuestos').update({ estado, updated_at:new Date().toISOString() }).eq('id',id);
        if(error) throw error;
        const p=LISTA.find(x=>x.id===id); if(p) p.estado=estado; render();
      }catch(e){ alert('No se pudo: '+(e.message||e)); }
    }

    async function guardar(){
      const prov=($('pz-prov').value||'').trim();
      if(!prov){ msg('Escribí el nombre del proveedor.','var(--danger)'); return; }
      $('pz-save').disabled=true; msg('Guardando…');
      try{
        let fotoUrl = EDIT? (EDIT.foto_url||null) : null;
        if(_file){ msg('Subiendo foto…'); fotoUrl = await subirFoto(_file); }
        const fila={
          proveedor:prov,
          link:($('pz-link').value||'').trim()||null,
          estado:$('pz-est').value,
          minimo_compra:($('pz-min').value||'').trim()||null,
          costos:($('pz-cos').value||'').trim()||null,
          notas:($('pz-not').value||'').trim()||null,
          foto_url:fotoUrl,
          updated_at:new Date().toISOString(),
        };
        if(EDIT){
          const { error } = await sb.from('presupuestos').update(fila).eq('id',EDIT.id);
          if(error) throw error;
          msg('✅ Cambios guardados.','var(--green-d)');
        }else{
          fila.creado_por=YO;
          const { error } = await sb.from('presupuestos').insert(fila);
          if(error) throw error;
          msg('✅ Presupuesto agregado.','var(--green-d)');
        }
        resetForm();
        setTimeout(()=>msg(''),1600);
        cargar();
      }catch(e){ msg('No se pudo: '+(e.message||e),'var(--danger)'); }
      finally{ $('pz-save').disabled=false; }
    }

    async function borrar(id){
      if(!confirm('¿Borrar este presupuesto?')) return;
      try{
        const { error } = await sb.from('presupuestos').delete().eq('id',id);
        if(error) throw error;
        LISTA=LISTA.filter(x=>x.id!==id); render();
      }catch(e){ alert('No se pudo: '+(e.message||e)); }
    }

    cargar();
  }

  window.GBPresupuestos = { init };
})();
