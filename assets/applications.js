(() => {
'use strict';
const $=id=>document.getElementById(id),form=$('staff-application-form'),dialog=$('application-options');
const langs={"coding":["Python","JavaScript","Java","C++","C","Rust"],"markup":["Markdown","HTML","XML","SVG","LaTeX"]},durations=["1–3 months","3–6 months","6 months–1 year","2 years","2.5 years","3 years","3.5 years","4+ years"],questions=[["username","What is your Discord username?",true,false],["age","How old are you?",true,false],["timezone","What timezone do you live in?",true,false],["availability","Which hours of the day can you moderate? Use your timezone.",true,false],["motivation","Why do you want to become a moderator in this server specifically?",true,true],["rules","What would you do if someone violated the rules, such as speaking in a different language or posting NSFW content?",true,true],["skills","Which skills could benefit our moderation team? Why should we choose you specifically?",true,true],["experience","Do you have prior Discord staff experience? Which servers have you moderated, or do you still moderate, and for how long?",true,true],["other_code","Other coding languages and how long you have used them",false,false],["other_markup","Other markup languages and how long you have used them",false,false],["ielts","Have you taken the IELTS exam? If so, what was your score?",false,false]];
let auth,state,session,offset=0,loading=false,identityGeneration=0,refreshId=0,closedNotified=false;
const questionNodes=Array.from(form.childNodes),submitButton=$('submit-application');
function hideForm(){form.hidden=true;form.inert=true;questionNodes.forEach(node=>node.remove());}
function showForm(){form.append(...questionNodes);form.inert=false;form.hidden=false;}
function unavailable(){hideForm();$('application-entry').hidden=true;say('application-status','Unable to confirm recruitment availability. Please try again shortly.');}
function closedNotice(){if(closedNotified)return;closedNotified=true;window.dispatchEvent(new Event('recruitment-notice'));}
const say=(id,text)=>{$(id).textContent=text;};
async function rpc(action,payload={}){const r=await auth.client.rpc('recruitment',{action,payload});if(r.error)throw new Error(r.error.message);return r.data;}
function clearPrivate(){form.append(...questionNodes);form.reset();hideForm();$('application-responses').hidden=true;$('response-list').replaceChildren();$('application-staff').hidden=true;$('application-receipt').hidden=true;if(dialog.open)dialog.close();}
async function refresh(){
 const generation=identityGeneration,request=++refreshId;
 const who=await auth.client.auth.getSession();const next=await rpc('status').catch(error=>{unavailable();throw error;});
 if(generation!==identityGeneration||request!==refreshId)return;
 session=who.data.session;state=next;
 $('application-staff').hidden=!state.staff;
 $('application-closed').hidden=state.accepting;
 say('closed-message',state.closed_message);
 $('application-entry').hidden=!state.accepting||!!state.own;
 $('application-receipt').hidden=!state.own;
 if(state.own)say('receipt-text','Submitted '+new Date(state.own.submitted_at).toLocaleString()+'. Automatically expires '+new Date(state.own.expires_at).toLocaleString()+'. Only authorized website staff can read it.');
 if(!state.accepting||state.own||!session)hideForm();
 if(!state.accepting&&!state.staff)closedNotice();else closedNotified=false;
 window.dispatchEvent(new Event('recruitment-refresh'));
 say('application-status',state.accepting?'Recruitment is open · Round '+state.round:'Recruitment is closed');
 say('application-eligibility',!session?'Sign in with Discord to continue.':state.needs_guardian&&!state.guardian_approved?'Ask your guardian to arrange recruitment-specific approval with the operator before filling in answers.':'Your application is private. Review the recruitment notice before continuing.');
 $('application-start').textContent=session?'Continue to application':'Sign in to apply';
}
$('application-start').onclick=async()=>{
 try{
  if(!session){auth.focusSignIn();return;}
  if(!await auth.ensureAgreement())return;
  await refresh();
  if(!state.accepting||state.own||!session)return;
  const route=$('application-age-route').value;
  if(!route){say('application-eligibility','Choose your age / consent route first.');$('application-age-route').focus();return;}
  if((route==='guardian'||state.needs_guardian)&&!state.guardian_approved){say('application-eligibility','A verified guardian must approve recruitment processing before you provide answers. Contact the operator through the support server linked in the notice.');$('recruitment-notice').open=true;return;}
  showForm();$('application-username').focus();
 }catch(e){say('application-status',e.message);}
};
form.addEventListener('change',e=>{
 if(e.target.name==='age'&&Number(e.target.value)<18&&!state?.guardian_approved){
  form.reset();hideForm();$('application-age-route').value='guardian';
  say('application-eligibility','Applicants aged 16–17 need verified guardian recruitment approval first. Applicants under 16 cannot apply.');
  $('application-age-route').focus();
 }
});
document.querySelectorAll('[data-clear-grid]').forEach(b=>b.onclick=()=>form.querySelectorAll('input[name^="'+b.dataset.clearGrid+'_"]').forEach(i=>i.checked=false));
form.onsubmit=async e=>{
 e.preventDefault();if(loading||!form.reportValidity())return;loading=true;submitButton.disabled=true;
 try{
  if(!await auth.ensureAgreement())return;
  const f=new FormData(form),answers={};
  for(const [key] of questions)answers[key]=String(f.get(key)||'').trim();
  answers.english=String(f.get('english')||'');
  for(const kind of Object.keys(langs)){answers[kind]={};langs[kind].forEach((language,index)=>{const v=f.get(kind+'_'+index);if(v!==null)answers[kind][language]=Number(v);});}
  await rpc('submit',{answers,round:state.round,consent:f.has('application_consent'),notice_version:'recruitment-2026-11-01'});
  form.reset();form.hidden=true;await refresh();$('application-receipt').scrollIntoView({block:'center',behavior:'smooth'});
 }catch(e){say('application-submit-status',e.message);await refresh().catch(unavailable);}
 finally{loading=false;submitButton.disabled=false;}
};
$('withdraw-application').onclick=async()=>{
 if(!state?.own||!confirm('Delete your submitted application? Staff will no longer be able to review it.'))return;
 try{await rpc('withdraw',{id:state.own.id});await refresh();say('application-status','Your application has been deleted.');}catch(e){say('application-status',e.message);}
};
$('published-options').onclick=async()=>{
 try{await refresh();if(!state.staff)return;const f=$('published-form');f.elements.accepting.checked=state.accepting;f.elements.closed_message.value=state.closed_message;f.elements.new_round.checked=false;f.elements.new_round.disabled=state.accepting;say('published-status','');dialog.showModal();}catch(e){say('application-status',e.message);}
};
$('cancel-published').onclick=()=>dialog.close();
$('published-form').onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type=submit]');if(b.disabled)return;
 if(f.elements.new_round.checked&&!confirm('Start a new recruitment round? Previous applicants may submit again. Existing responses keep their original 90-day expiry.'))return;
 b.disabled=true;
 try{await rpc('settings',{revision:state.revision,accepting:f.elements.accepting.checked,closed_message:f.elements.closed_message.value.trim(),new_round:f.elements.new_round.checked});dialog.close();await refresh();}
 catch(e){say('published-status',e.message);}finally{b.disabled=false;}
};
$('copy-application-link').onclick=async()=>{try{await navigator.clipboard.writeText(new URL('./applications.html',location.href).href);say('published-status','Responder link copied.');}catch{say('published-status','Copy this link: '+new URL('./applications.html',location.href).href);}};
async function guardian(approved){
 const f=$('recruitment-guardian-form');if(!f.reportValidity())return;
 if(approved&&!f.elements.verified.checked){say('guardian-recruitment-status','Verify guardian authority and explicit recruitment permission before recording approval.');return;}
 if(!approved&&!confirm('Revoke recruitment permission and delete this member’s applications?'))return;
 try{await rpc('guardian',{discord_id:f.elements.discord_id.value,verified:f.elements.verified.checked,approved});say('guardian-recruitment-status',approved?'Recruitment approval recorded for 90 days.':'Approval revoked and applications deleted.');f.reset();}catch(e){say('guardian-recruitment-status',e.message);}
}
$('recruitment-guardian-form').onsubmit=e=>{e.preventDefault();guardian(true);};
$('revoke-recruitment-guardian').onclick=()=>guardian(false);
function element(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
async function responses(){
 try{
  const generation=identityGeneration;const rows=await rpc('responses',{offset});if(generation!==identityGeneration)return;$('response-list').replaceChildren();
  for(const row of rows){
   const card=element('details','');card.className='application-response';
   card.append(element('summary',(row.answers.username||'Applicant')+' · Round '+row.round+' · '+new Date(row.submitted_at).toLocaleDateString()));
   const dl=document.createElement('dl');
   for(const [key,label] of questions){dl.append(element('dt',label),element('dd',row.answers[key]||'Not provided'));}
   for(const kind of Object.keys(langs)){dl.append(element('dt',kind==='coding'?'Coding experience':'Markup experience'),element('dd',Object.entries(row.answers[kind]||{}).map(([k,v])=>k+': '+durations[v]).join('\n')||'Not provided'));}
   dl.append(element('dt','English proficiency'),element('dd',row.answers.english),element('dt','Expires'),element('dd',new Date(row.expires_at).toLocaleString()));
   const del=element('button','Delete application');del.type='button';del.className='button button-outline';
   del.onclick=async()=>{if(!confirm('Permanently delete this application?'))return;try{await rpc('delete',{id:row.id});await responses();}catch(e){say('responses-status',e.message);}};
   card.append(dl,del);$('response-list').append(card);
  }
  $('application-responses').hidden=false;$('responses-prev').disabled=offset===0;$('responses-next').disabled=rows.length<50;
  say('response-page','Page '+(offset/50+1));say('responses-status',rows.length?'Applications are private.':'No unexpired applications on this page.');
 }catch(e){$('response-list').replaceChildren();say('responses-status',e.message);}
}
$('view-applications').onclick=async()=>{offset=0;await responses();$('application-responses').scrollIntoView({block:'start',behavior:'smooth'});};
$('responses-prev').onclick=()=>{offset=Math.max(0,offset-50);responses();};$('responses-next').onclick=()=>{offset+=50;responses();};
async function init(){
 auth=window.communityAuth;if(!auth)throw new Error('Account service could not load. Please refresh to retry.');
 await auth.ready;await refresh();
 auth.client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){identityGeneration++;clearPrivate();}if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>refresh().catch(e=>say('application-status',e.message)),0);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hideForm();else refresh().catch(unavailable);});
 window.addEventListener('focus',()=>refresh().catch(unavailable));
 setInterval(()=>{if(!document.hidden)refresh().catch(unavailable);},30000);
}
hideForm();
window.addEventListener('recruitment-status',e=>{if(!e.detail){unavailable();return;}if(!e.detail.accepting){hideForm();$('application-entry').hidden=true;$('application-closed').hidden=false;say('closed-message',e.detail.closed_message);if(!e.detail.staff)closedNotice();}});
init().catch(unavailable);
})();