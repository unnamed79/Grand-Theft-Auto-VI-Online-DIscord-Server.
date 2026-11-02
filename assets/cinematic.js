(() => {
 'use strict';
 const scene=document.querySelector('.cinema');if(!scene)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:740px)');
 const art=scene.querySelector('.cinema-art'),dots=scene.querySelector('.cinema-motes'),steps=[...scene.querySelectorAll('.cinema-progress i')];
 for(let i=0;i<(mobile.matches?16:42);i++){const dot=document.createElement('i');dot.style.setProperty('--x',((i*37)%100)+'%');dot.style.setProperty('--y',((i*23)%100)+'%');dot.style.setProperty('--delay',(-i*.7)+'s');dots.append(dot);}
 const colors=[[60,95,225],[181,91,255],[255,101,187],[255,173,108]];
 let frame=0;
 function render(){frame=0;const rect=scene.getBoundingClientRect(),p=Math.max(0,Math.min(1,-rect.top/Math.max(1,scene.offsetHeight-innerHeight))),scaled=p*3,index=Math.min(2,Math.floor(scaled)),mix=scaled-index;
 colors[index].forEach((v,i)=>scene.style.setProperty(['--scene-r','--scene-g','--scene-b'][i],Math.round(v+(colors[index+1][i]-v)*mix)));
 if(!reduced.matches&&!mobile.matches){art.style.setProperty('--turn',(-8+p*16)+'deg');art.style.setProperty('--lift',(Math.sin(p*Math.PI)*-24)+'px');}
 steps.forEach((s,i)=>s.classList.toggle('active',i===Math.min(3,Math.floor(p*4))));}
 const update=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(render);};
 addEventListener('scroll',update,{passive:true});addEventListener('resize',update);reduced.addEventListener('change',update);
 let visible=true;const pause=()=>{scene.classList.toggle('is-paused',!visible||document.hidden);if(visible)update();};
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pause();}).observe(scene);
 document.addEventListener('visibilitychange',pause);render();
})();