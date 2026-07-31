// ─── Animación de celebración — GrandBar ────────────────────────────────────

// ⚙️ INTERRUPTOR GLOBAL de la animación de celebración.
//    false = NO se muestra en ninguna acción de la app (sigue todo funcionando, sin la animación).
//    true  = se vuelve a mostrar como antes.
//    Para REACTIVARLA: cambiar esta única constante a true y redeployar.
const MOSTRAR_CELEBRACION = false;

const _CEL_NOMBRES = ['Fernando']; // siempre Fernando
const _CEL_COLORS  = ['#CBB86A','#FFD700','#FFFFFF','#87CEEB','#1F447F','#E0C96B','#AAD4F5'];

function celebrarVenta(descripcion) {
  // Animación desactivada globalmente: salir sin mostrar nada (el resto de la acción sigue normal).
  if (!MOSTRAR_CELEBRACION) return;

  descripcion = descripcion || '¡Venta registrada!';

  // ── Crear overlay si no existe ──────────────────────────────────────────────
  if (!document.getElementById('_cel_ov')) {
    const st = document.createElement('style');
    st.textContent = `
      #_cel_ov {
        position:fixed;inset:0;z-index:99999;
        background:rgba(5,5,20,.85);
        display:flex;align-items:center;justify-content:center;
        flex-direction:column;padding:20px;
        animation:_celIn .35s ease both;
      }
      @keyframes _celIn{from{opacity:0}to{opacity:1}}
      #_cel_cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      #_cel_box{
        position:relative;z-index:1;text-align:center;
        display:flex;flex-direction:column;align-items:center;gap:12px;
        animation:_celPop .5s cubic-bezier(.34,1.56,.64,1) both;
      }
      @keyframes _celPop{from{transform:scale(.5) translateY(40px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
      #_cel_ico{font-size:72px;animation:_celRock .8s ease-in-out infinite alternate;filter:drop-shadow(0 0 18px #CBB86A)}
      @keyframes _celRock{from{transform:scale(1) rotate(-10deg)}to{transform:scale(1.15) rotate(10deg)}}
      #_cel_t1{font:bold clamp(18px,5vw,28px)/1.2 Georgia,serif;color:#FFD700;text-shadow:0 0 24px rgba(255,215,0,.7),0 2px 8px rgba(0,0,0,.9)}
      #_cel_t2{font-size:clamp(14px,4vw,18px);color:#fff;background:rgba(31,68,127,.75);border:1px solid rgba(203,184,106,.4);border-radius:24px;padding:7px 20px}
      #_cel_t3{font-size:clamp(13px,3.5vw,16px);color:#CBB86A;font-weight:700;max-width:300px}
      #_cel_btn{margin-top:6px;padding:10px 30px;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.4);border-radius:24px;color:#fff;font:600 14px system-ui;cursor:pointer;transition:background .2s}
      #_cel_btn:hover{background:rgba(255,255,255,.28)}
    `;
    document.head.appendChild(st);

    const ov = document.createElement('div');
    ov.id = '_cel_ov';
    ov.innerHTML = `
      <canvas id="_cel_cv"></canvas>
      <div id="_cel_box">
        <div id="_cel_ico">🏆</div>
        <div id="_cel_t1">FELICITACIONES POR<br>TU EXCELENTE VISITA!</div>
        <div id="_cel_t2"></div>
        <div id="_cel_t3"></div>
        <button id="_cel_btn" onclick="_celCerrar()">✕ Cerrar</button>
      </div>`;
    ov.addEventListener('click', function(e){ if(e.target===ov) _celCerrar(); });
    document.body.appendChild(ov);
  }

  // ── Rellenar contenido ──────────────────────────────────────────────────────
  document.getElementById('_cel_t2').textContent = `A FER LE GUSTA TU VENTA 👍`;
  document.getElementById('_cel_t3').textContent = descripcion;
  document.getElementById('_cel_ov').style.display = 'flex';

  // ── Fuegos artificiales ─────────────────────────────────────────────────────
  _celFireworks();

  // ── Sonido ──────────────────────────────────────────────────────────────────
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const now = ac.currentTime;
    [[261.6,0],[329.6,.07],[392,.14],[523.2,.22],[659.3,.32]].forEach(([f,t])=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,now+t);g.gain.linearRampToValueAtTime(.25,now+t+.04);
      g.gain.exponentialRampToValueAtTime(.001,now+t+.3);
      o.connect(g);g.connect(ac.destination);o.start(now+t);o.stop(now+t+.35);
    });
    [523.2,659.3,784,1046.5].forEach(f=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(.18,now+.42);g.gain.exponentialRampToValueAtTime(.001,now+1.8);
      o.connect(g);g.connect(ac.destination);o.start(now+.42);o.stop(now+2);
    });
    setTimeout(()=>{try{ac.close()}catch(e){}},2500);
  } catch(e){}

  // ── Auto-cierre ─────────────────────────────────────────────────────────────
  clearTimeout(window._celT);
  window._celT = setTimeout(_celCerrar, 4200);
}

function _celCerrar() {
  clearTimeout(window._celT);
  const ov = document.getElementById('_cel_ov');
  if (ov) ov.style.display = 'none';
  if (window._celAF) { cancelAnimationFrame(window._celAF); window._celAF = null; }
  clearTimeout(window._celBT);
}

function _celFireworks() {
  const canvas = document.getElementById('_cel_cv');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  let parts = [];

  function Particle(x, y, color) {
    const a = Math.random()*Math.PI*2, sp = Math.random()*10+4;
    this.x=x; this.y=y; this.vx=Math.cos(a)*sp; this.vy=Math.sin(a)*sp-Math.random()*3;
    this.alpha=1; this.decay=.015+Math.random()*.015;
    this.size=Math.random()*4+1.5; this.color=color; this.g=.2;
  }
  Particle.prototype.step=function(){
    this.vx*=.98; this.vy+=this.g; this.x+=this.vx; this.y+=this.vy;
    this.alpha-=this.decay; this.size*=.995;
  };
  Particle.prototype.draw=function(c){
    c.save(); c.globalAlpha=Math.max(0,this.alpha);
    c.fillStyle=this.color; c.shadowBlur=8; c.shadowColor=this.color;
    c.beginPath(); c.arc(this.x,this.y,this.size,0,Math.PI*2); c.fill();
    c.restore();
  };

  function burst(x,y){
    const c1=_CEL_COLORS[Math.floor(Math.random()*_CEL_COLORS.length)];
    const c2=_CEL_COLORS[Math.floor(Math.random()*_CEL_COLORS.length)];
    for(let i=0;i<80;i++) parts.push(new Particle(x,y,i%3===0?c2:c1));
  }

  function loop(){
    ctx.fillStyle='rgba(0,0,0,.13)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    parts=parts.filter(p=>p.alpha>.02);
    if(parts.length>500) parts.splice(0,parts.length-500);
    parts.forEach(p=>{p.step();p.draw(ctx);});
    window._celAF=requestAnimationFrame(loop);
  }

  ctx.clearRect(0,0,canvas.width,canvas.height); parts=[];
  if(window._celAF) cancelAnimationFrame(window._celAF);
  clearTimeout(window._celBT);

  // Primeras 2 explosiones inmediatas
  burst(canvas.width*.3, canvas.height*.25);
  burst(canvas.width*.7, canvas.height*.2);

  let n=0;
  function sched(){
    if(n++>18) return;
    burst(canvas.width*(.15+Math.random()*.7), canvas.height*(.1+Math.random()*.4));
    if(Math.random()>.5) burst(canvas.width*(.2+Math.random()*.6), canvas.height*(.15+Math.random()*.35));
    window._celBT=setTimeout(sched, 180+Math.random()*220);
  }
  sched(); loop();
}
