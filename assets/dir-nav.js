// GrandBar Hub · sidebar compartido del Panel de Dirección (Fernando)
(function(){
  // Solo las pantallas que muestran datos reales. Las que eran maquetas (Ventas,
  // Compras, Administración, Marketing, Depósito, Desarrollo, Clientes,
  // Vendedores, Proveedores y Configuración) se sacaron del menú el 23/09/2026:
  // los archivos siguen en el repo, pero no se llega a ellos desde acá.
  var items=[
    {h:'direccion.html',l:'Inicio',i:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'},
    // Ventas y margen desde CUBO (14/10/2026), se actualiza cada 20 minutos.
    {h:'dir-ventas.html',l:'Ventas',i:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'},
    // Reporte diario (18/11/2026): unidades y clientes con compra de cada vendedor, por equipo.
    {h:'dir-reporte.html',l:'Reporte diario',i:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M3 14.5h18"/>'},
    // Comparativo (19/11/2026): el mes contra el mismo mes del año anterior (clientes, líneas, proveedores, artículos).
    {h:'dir-comparativo.html',l:'Comparativo',i:'<path d="M4 20V9M9 20V4M15 20v-7M20 20V11"/><path d="M2 20h20"/>'},
    // Diagnóstico de ventas (24/11/2026): CCC y botellas por vendedor, mes vs mes anterior y año anterior.
    {h:'dir-diagnostico.html',l:'Diagnóstico de ventas',i:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'},
    {h:'dir-cobranzas.html',l:'Cobranzas',i:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'},
    // Presupuestos e Incentivos (20/11/2026): estaban solo en el menú del Inicio (direccion.html),
    // y al pasar a cualquier otra pantalla desaparecían. Mismo orden que ese menú.
    {h:'dir-presupuestos.html',l:'Presupuestos',i:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>'},
    {h:'reportes.html',l:'Reportes',i:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'},
    {h:'supervisor-incentivos.html',l:'Incentivos',i:'<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5L7 22l5-3 5 3-1.5-9.5"/>'},
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
