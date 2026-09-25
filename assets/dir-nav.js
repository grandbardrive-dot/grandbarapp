// GrandBar Hub · sidebar compartido del Panel de Dirección (Fernando)
(function(){
  // Solo las pantallas que muestran datos reales. Las que eran maquetas (Ventas,
  // Compras, Administración, Marketing, Depósito, Desarrollo, Clientes,
  // Vendedores, Proveedores y Configuración) se sacaron del menú el 23/09/2026:
  // los archivos siguen en el repo, pero no se llega a ellos desde acá.
  var items=[
    {h:'direccion.html',l:'Inicio',i:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'},
    {h:'dir-cobranzas.html',l:'Cobranzas',i:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'},
    {h:'reportes.html',l:'Reportes',i:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'},
    {h:'dir-agenda.html',l:'Agenda',i:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'}
  ];
  var page=(location.pathname.split('/').pop()||'direccion.html').toLowerCase();
  if(page==='reportes-penaflor.html'||page==='reportes-campari.html') page='reportes.html'; // sub-páginas de Reportes
  var svg=function(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+p+'</svg>';};
  var nav=items.map(function(it){return '<a href="'+it.h+'" class="'+(it.h.toLowerCase()===page?'on':'')+'">'+svg(it.i)+' '+it.l+'</a>';}).join('');
  var el=document.getElementById('dsb'); if(!el) return;
  el.innerHTML='<div class="sb-logo">Grand<b>Bar</b><small>Distribuciones</small></div>'
    +'<nav class="sb-nav">'+nav+'</nav>'
    +'<div class="sb-foot"><div class="sb-me" id="dlogout" title="Cerrar sesión"><div class="av" id="dav">F</div><div><div class="t" id="dname">Fernando</div><div class="s">Director</div></div></div></div>';
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
