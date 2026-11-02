(() => {
'use strict';
const scene=document.querySelector('.cinema'); if(!scene)return;
const stage=scene.querySelector('.cinema-stage'), art=scene.querySelector('.cinema-art'), field=scene.querySelector('.cinema-motes');
const steps=[...scene.querySelectorAll('.cinema-progress i')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'), mobile=matchMedia('(max-width:740px)'), fine=matchMedia('(hover:hover) and (pointer:fine)');
const colors=[[60,95,225],[181,91,255],[255,101,187],[255,173,108]];
let frame=0,last=0,current=0,velocity=0,target=0,visible=true,width=0,height=0,time=0;
const mouse={x:-1000,y:-1000};
const dots=Array.from({length:mobile.matches?30:84},(_,i)=>{
 const el=document.createElement('i');field.append(el);
 return {el,x:((i*37.31)%100)/100,y:((i*23.71)%100)/100,dx:0,dy:0};
});
function measure(){
 const r=scene.getBoundingClientRect();width=stage.clientWidth;height=stage.clientHeight;
 target=Math.max(0,Math.min(1,-r.top/Math.max(1,scene.offsetHeight-innerHeight)));
 wake();
}
function render(now){
 frame=0;if(!visible||document.hidden)return;
 const dt=Math.min((now-(last||now))/1000,.032);last=now;time+=dt;
 if(reduced.matches){current=target;velocity=0;}
 else {velocity+=(target-current)*65*dt;velocity*=Math.exp(-16*dt);current+=velocity*dt;}
 const p=Math.max(0,Math.min(1,current)),scaled=p*3,index=Math.min(2,Math.floor(scaled)),mix=scaled-index;
 colors[index].forEach((v,i)=>scene.style.setProperty(['--scene-r','--scene-g','--scene-b'][i],Math.round(v+(colors[index+1][i]-v)*mix)));
 art.style.setProperty('--turn',(!reduced.matches&&!mobile.matches?-8+p*16:0)+'deg');
 art.style.setProperty('--lift',(!reduced.matches&&!mobile.matches?Math.sin(p*Math.PI)*-24:0)+'px');
 steps.forEach((s,i)=>s.classList.toggle('active',i===Math.min(3,Math.floor(p*4))));
 dots.forEach((d,i)=>{
  const x=d.x*width+(reduced.matches?0:Math.sin(time*.45+i)*22);
  const y=reduced.matches?d.y*height:((d.y*height-time*(12+i%14))%height+height)%height;
  const ax=x-mouse.x,ay=y-mouse.y,dist=Math.hypot(ax,ay),force=!reduced.matches&&fine.matches?Math.max(0,1-dist/150)*42:0;
  d.dx+=(ax/(dist||1)*force-d.dx)*.12;d.dy+=(ay/(dist||1)*force-d.dy)*.12;
  d.el.style.transform='translate3d('+(x+d.dx)+'px,'+(y+d.dy)+'px,0)';
 });
 if(!reduced.matches)frame=requestAnimationFrame(render);
}
function wake(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(render);}
scene.addEventListener('pointermove',e=>{
 if(!fine.matches||reduced.matches)return;
 const r=stage.getBoundingClientRect(),a=art.getBoundingClientRect();
 mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;
 art.classList.toggle('is-hovered',e.clientX>=a.left&&e.clientX<=a.right&&e.clientY>=a.top&&e.clientY<=a.bottom);
},{passive:true});
scene.addEventListener('pointerleave',()=>{mouse.x=mouse.y=-1000;art.classList.remove('is-hovered');});
function pause(){scene.classList.toggle('is-paused',!visible||document.hidden);last=0;if(!visible||document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();}
if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pause();}).observe(scene);
addEventListener('scroll',measure,{passive:true});addEventListener('resize',measure);
document.addEventListener('visibilitychange',pause);reduced.addEventListener('change',measure);measure();
})();