(() => {
 'use strict';
 let state=null,pending=null,notice,closeTimer,trigger;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('keyboard-navigation');
 function closeNotice(){
  if(!notice?.open)return;
  clearTimeout(closeTimer);notice.classList.add('is-closing');
  closeTimer=setTimeout(()=>{notice.close();notice.classList.remove('is-closing');trigger?.focus();},reduced()?0:180);
 }
 function showNotice(unavailable=false){
  if(!notice){
   notice=document.createElement('dialog');notice.className='recruitment-dialog';notice.setAttribute('aria-labelledby','recruitment-dialog-title');notice.setAttribute('aria-describedby','recruitment-dialog-copy');
   const x=document.createElement('button');x.type='button';x.className='recruitment-close';x.setAttribute('aria-label','Close recruitment notice');
   x.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';x.onclick=closeNotice;
   const title=document.createElement('h2');title.id='recruitment-dialog-title';
   const copy=document.createElement('p');copy.id='recruitment-dialog-copy';
   const link=document.createElement('a');link.href='https://discord.gg/NAFJHVsYta';link.target='_blank';link.rel='noopener noreferrer';link.className='button button-outline';link.textContent='Visit our Discord';
   notice.append(x,title,copy,link);document.body.append(notice);
   notice.addEventListener('cancel',e=>{e.preventDefault();closeNotice();});
   notice.addEventListener('click',e=>{if(e.target===notice){const r=notice.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeNotice();}});
  }
  notice.querySelector('h2').textContent=unavailable?'Recruitment status unavailable':'Staff application is disabled';
  notice.querySelector('p').textContent=unavailable?'We could not check recruitment availability. Please try again shortly. The application will remain hidden until we can confirm recruitment is open.':'Come back when the recruitment phase is open. Make sure you have the server announcements roles in our Discord server to be notified when an announcement has been made.';
  clearTimeout(closeTimer);notice.classList.remove('is-closing');
  if(!notice.open){trigger=document.activeElement;notice.showModal();notice.querySelector('button').focus();}
 }
 function paint(){
  document.querySelectorAll('[data-recruitment-link]').forEach(link=>{
   const staff=link.dataset.recruitmentManage!==undefined;
   link.dataset.recruitmentState=state?(state.accepting?'open':'closed'):'unknown';
   link.textContent=staff?'Staff applications · Manage':state?(state.accepting?'Apply to be staff · Open':'Staff applications · Closed'):'Staff applications · Checking';
  });
  let manage=document.querySelector('[data-recruitment-manage]');
  if(state?.staff&&!manage){manage=document.createElement('a');manage.href='./applications.html';manage.dataset.recruitmentLink='';manage.dataset.recruitmentManage='';const menu=document.querySelector('.profile-menu');if(menu){menu.append(manage);paint();}}
  if(!state?.staff)manage?.remove();
 }
 async function refresh(){
  if(pending)return pending;
  pending=(async()=>{
   try{const auth=window.communityAuth;if(!auth)throw new Error('Unavailable');await auth.ready;
    const result=await auth.client.rpc('recruitment',{action:'status',payload:{}});if(result.error||typeof result.data?.accepting!=='boolean')throw new Error('Unavailable');
    state=result.data;paint();window.dispatchEvent(new CustomEvent('recruitment-status',{detail:state}));return state;
   }catch{state=null;paint();window.dispatchEvent(new CustomEvent('recruitment-status',{detail:null}));return null;}
   finally{pending=null;}
  })();return pending;
 }
 const link=document.createElement('a');link.href='./applications.html';link.dataset.recruitmentLink='';document.querySelector('.primary-nav')?.append(link);
 if(location.pathname.endsWith('/community.html')){const clone=link.cloneNode(true);clone.className='button button-outline';document.querySelector('.page-intro .utility-row')?.append(clone);}
 document.addEventListener('click',async e=>{
  const link=e.target.closest('a');if(!link||new URL(link.href,location.href).pathname.split('/').pop()!=='applications.html')return;
  e.preventDefault();const current=await refresh();
  if(current&&(current.accepting||current.staff)){location.href=link.href;}else showNotice(!current);
 });
 window.recruitmentUI={refresh,showNotice};
 window.addEventListener('recruitment-notice',()=>showNotice());
 window.addEventListener('recruitment-refresh',refresh);
 window.addEventListener('community-agreement-change',()=>{state=null;paint();refresh();});
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 setInterval(()=>{if(!document.hidden)refresh();},30000);
 paint();refresh();
})();

