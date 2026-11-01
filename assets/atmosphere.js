(() => {
 'use strict';
 const motion=matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
 const cards=document.querySelectorAll('.hero-art,.feature-card,.platform-card,.callout,.policy-card');
 cards.forEach(card=>{
  card.classList.add('ambient-card');
  const light=document.createElement('span');light.className='card-light';light.setAttribute('aria-hidden','true');card.append(light);
  let frame=0,point=null;
  const clear=()=>{cancelAnimationFrame(frame);frame=0;point=null;['--art-x','--art-y','--logo-x','--logo-y'].forEach(name=>card.style.removeProperty(name));};
  card.addEventListener('pointermove',event=>{
   if(!motion.matches||document.documentElement.classList.contains('keyboard-navigation'))return;
   point={x:event.clientX,y:event.clientY};if(frame)return;
   frame=requestAnimationFrame(()=>{
    frame=0;if(!point)return;const box=card.getBoundingClientRect();
    const x=point.x-box.left,y=point.y-box.top;
    card.style.setProperty('--light-x',x+'px');card.style.setProperty('--light-y',y+'px');
    if(card.classList.contains('hero-art')){
     card.style.setProperty('--art-x',((.5-y/box.height)*4)+'deg');card.style.setProperty('--art-y',((x/box.width-.5)*4)+'deg');
     card.style.setProperty('--logo-x',((x/box.width-.5)*10)+'px');card.style.setProperty('--logo-y',((y/box.height-.5)*10)+'px');
    }
   });
  },{passive:true});
  card.addEventListener('pointerleave',clear);motion.addEventListener('change',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('keydown',clear);
 });
})();

