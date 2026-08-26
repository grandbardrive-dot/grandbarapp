// GrandBar Hub · sidebar compartido del Panel de Dirección (Fernando)
(function(){
  var items=[
    {h:'direccion.html',l:'Inicio',i:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'},
    {h:'ventas.html',l:'Ventas',i:'<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>'},
    {h:'compras.html',l:'Compras',i:'<path d="M6 2 3 6v14h18V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>'},
    {h:'administracion.html',l:'Administración',i:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'},
    {h:'marketing.html',l:'Marketing',i:'<path d="M3 11l18-8-8 18-2-8z"/>'},
    {h:'deposito.html',l:'Depósito',i:'<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/>'},
    {h:'desarrollo.html',l:'Desarrollo',i:'<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>'},
    {h:'reportes.html',l:'Reportes',i:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'},
    {h:'reportes-penaflor.html',l:'Peñaflor',i:'<path d="M8 3h8l-1 7a3 3 0 0 1-6 0z"/><path d="M12 13v6M8 21h8"/>'},
    {h:'dir-clientes.html',l:'Clientes',i:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'},
    {h:'leads-asignar.html',l:'Leads',i:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'},
    {h:'dir-vendedores.html',l:'Vendedores',i:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 3.5a3 3 0 0 1 0 6"/>'},
    {h:'proveedores.html',l:'Proveedores',i:'<circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/><path d="M20 7h-9M14 17H5"/>'},
    {h:'dir-agenda.html',l:'Agenda',i:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'},
    {h:'configuracion.html',l:'Configuración',i:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 3.6 15a2 2 0 1 1 0-4A1.6 1.6 0 0 0 5 8"/>'}
  ];
  var page=(location.pathname.split('/').pop()||'direccion.html').toLowerCase();
  var svg=function(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+p+'</svg>';};
  var nav=items.map(function(it){return '<a href="'+it.h+'" class="'+(it.h.toLowerCase()===page?'on':'')+'">'+svg(it.i)+' '+it.l+'</a>';}).join('');
  var el=document.getElementById('dsb'); if(!el) return;
  el.innerHTML='<div class="sb-logo">Grand<b>Bar</b><small>Distribuciones</small></div>'
    +'<nav class="sb-nav">'+nav+'</nav>'
    +'<div class="sb-foot"><div class="sb-me" id="dlogout" title="Cerrar sesión"><div class="av" id="dav">F</div><div><div class="t" id="dname">Fernando</div><div class="s">Director</div></div></div>'
    +'<div class="sb-ia">'+svg('<path d="M12 3l2 5 5 .5-4 3.5 1 5-4-2.5L8 17l1-5-4-3.5 5-.5z"/>')+'<div><div class="t">IA Asistente</div><div class="s">Preguntale a la IA</div></div></div></div>';
  if(window.supabase){
    var HUB={url:"https://xqhyemccbwmzxqzkrtwa.supabase.co",key:"sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc"};
    var c=supabase.createClient(HUB.url,HUB.key);
    c.auth.getSession().then(function(r){
      var s=r.data.session; if(!s){ location.href='index.html'; return; }
      c.from('usuarios').select('nombre').eq('id',s.user.id).maybeSingle().then(function(u){
        var n=(u.data&&u.data.nombre)?u.data.nombre:'Fernando';
        var f=n.split(/\s+/)[0];
        document.getElementById('dname').textContent=f;
        document.getElementById('dav').textContent=(n.trim()[0]||'F').toUpperCase();
        var g=document.getElementById('dgreet'); if(g) g.textContent='Buen día, '+f+' 👋';
      });
      var lo=document.getElementById('dlogout'); if(lo) lo.onclick=function(){ if(confirm('¿Cerrar sesión?')){ c.auth.signOut().finally(function(){location.href='index.html';}); } };
    });
  }
})();
