(() => {
'use strict';
const status=document.querySelector('#review-status'), list=document.querySelector('#reviews-list'), form=document.querySelector('#review-form');
if(!window.communityAuth){status.textContent='Login service could not load. Please refresh or try again later.';return;}
const client=window.communityAuth.client;
let user=null,staff=false,editing=null,rows=[],page=0;
const say=message=>{status.textContent=message;};
const text=(tag,value,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;};
function reset(){editing=null;form.reset();document.querySelector('#submit-review').textContent='Publish review';document.querySelector('#cancel-edit').hidden=true;}
function voteControls(review, votes){
 const group=document.createElement('div');
 group.className='utility-row';
 group.setAttribute('role','group');
 group.setAttribute('aria-label','Votes for review by '+review.display_name);
 const score=text('span',String(votes?.score || 0),'small-print');
 score.setAttribute('aria-live','polite');
 let mine=Number(votes?.mine || 0);
 function button(direction,label){
  const control=text('button',label,'button button-small');
  control.type='button';
  control.dataset.direction=String(direction);
  control.onclick=async()=>{
   if(!user){window.communityAuth.focusSignIn();return;}
   const choice=mine===direction?0:direction;
   const buttons=group.querySelectorAll('button');
   buttons.forEach(b=>b.disabled=true);
   try{
    if(choice && !await window.communityAuth.ensureAgreement())return;
    const result=await client.rpc('set_review_vote',{target:review.id,choice});
    if(result.error)throw result.error;
    const latest=await client.rpc('review_scores',{ids:[review.id]});
    if(latest.error){await load();return;}
    mine=Number(latest.data[0]?.mine || 0);
    score.textContent=String(latest.data[0]?.score || 0);
    paint();
   }catch{say('Could not confirm your vote. Refresh and try again.');}
   finally{buttons.forEach(b=>b.disabled=false);}
  };
  return control;
 }
 function paint(){
  group.querySelectorAll('button').forEach(b=>{
   const active=mine===Number(b.dataset.direction);
   b.setAttribute('aria-pressed',String(active));
   b.classList.toggle('button-primary',active);
   b.classList.toggle('button-outline',!active);
   b.title=active?'Remove your vote':b.textContent;
  });
 }
 group.append(button(1,'↑ Upvote'),score,button(-1,'↓ Downvote'));
 paint();
 return group;
}
let loadVersion=0;
async function load(){
 const version=++loadVersion;
 const {data,error}=await client.from('website_reviews').select('id,author_id,display_name,rating,body,created_at,updated_at,staff_edited').order('created_at',{ascending:false}).range(page*20,page*20+19);
 if(error){say('Unable to load reviews. Please try again.');return;}
 const totals=data.length?await client.rpc('review_scores',{ids:data.map(r=>r.id)}):{data:[]};
 if(version!==loadVersion)return;
 const votes=new Map((totals.data || []).map(v=>[v.review_id,v]));
 rows=data;list.replaceChildren();
 if(!data.length)list.append(text('p','No reviews on this page yet. Share your experience with the website.'));
 data.forEach(r=>{
 const card=document.createElement('article');card.className='policy-card review-card';
 card.append(text('h3',r.display_name),text('p','★'.repeat(r.rating)+'☆'.repeat(5-r.rating),'review-stars'),text('p',r.body,'review-body'));
 card.append(text('p',new Date(r.created_at).toLocaleDateString()+(r.staff_edited?' · Edited by staff':r.updated_at!==r.created_at?' · Edited':''),'small-print'));
 card.append(totals.error?text('p','Voting is temporarily unavailable.','small-print'):voteControls(r,votes.get(r.id)));
 if(user&&(user.id===r.author_id||staff)){
 const actions=document.createElement('div');actions.className='utility-row';
 const edit=text('button','Edit','button button-outline');edit.type='button';edit.onclick=()=>{editing=r.id;form.elements.body.value=r.body;form.querySelector('[name="rating"][value="'+r.rating+'"]').checked=true;document.querySelector('#submit-review').textContent='Save changes';document.querySelector('#cancel-edit').hidden=false;form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});form.elements.body.focus();};
 const del=text('button','Delete','button button-outline');del.type='button';del.onclick=async()=>{if(!confirm('Delete this review? This cannot be undone.'))return;del.disabled=true;const result=await client.from('website_reviews').delete().eq('id',r.id).select('id');if(result.error||!result.data.length){say('Could not delete this review. Your access may have changed.');del.disabled=false;return;}reset();say('Review deleted.');await load();};
 actions.append(edit,del);card.append(actions);
 }
 const report=document.createElement('a');report.className='text-link';report.href='https://discord.gg/NAFJHVsYta';report.target='_blank';report.rel='noopener noreferrer';report.textContent='Report to staff';card.append(report,text('p','Review reference: '+r.id,'small-print'));
 list.append(card);
 });
 document.querySelector('#previous-page').disabled=page===0;
 document.querySelector('#next-page').disabled=data.length<20;
 document.querySelector('#page-number').textContent='Page '+(page+1);
}
async function auth(){
 await window.communityAuth.ready;const result=await client.auth.getSession();user=result.data.session?.user||null;
 staff=false;
 if(user){const p=await client.rpc('review_permissions');staff=p.data===true;}
 form.hidden=false;
 document.querySelector('#account-status').textContent=user?(staff?'Signed in · Community staff':'Signed in with Discord'):'Sign in with Discord to write a review.';
 await load();
}
document.querySelector('#cancel-edit').onclick=reset;
form.addEventListener('focusin',async e=>{await window.communityAuth.ready;if(!user&&e.target.matches('textarea,input,button'))window.communityAuth.focusSignIn();});
document.querySelector('#previous-page').onclick=()=>{page=Math.max(0,page-1);load();};
document.querySelector('#next-page').onclick=()=>{page++;load();};
form.onsubmit=async e=>{
 e.preventDefault();if(!user){window.communityAuth.focusSignIn();return;}if(!await window.communityAuth.ensureAgreement())return;
 const button=document.querySelector('#submit-review');button.disabled=true;
 try{
 const payload={rating:Number(new FormData(form).get('rating')),body:form.elements.body.value.trim()};
 let result;
 if(editing)result=await client.from('website_reviews').update(payload).eq('id',editing).select('id');
 else result=await client.from('website_reviews').insert(payload).select('id');
 if(result.error){say(result.error.code==='42501'?'Please review your account agreement or contact the operator about guardian approval.':result.error.code==='23505'?'You already have a review. Find it below and choose Edit.':result.error.message.includes('30 seconds')?'Please wait 30 seconds between submissions or edits.':'Could not save your review. Check your sign-in and try again.');return;}
 if(!result.data.length){say('Review was not saved. Your access may have changed.');return;}
 reset();page=0;say('Your review is published.');await load();
 }catch{say('Connection interrupted. Please try again.');}finally{button.disabled=false;}
};
client.auth.onAuthStateChange(()=>{setTimeout(()=>auth(),0);});
auth().then(()=>{if(location.search.includes('code=')||location.hash)history.replaceState(null,'',location.pathname);}).catch(()=>say('Unable to connect to the login service. Please refresh.'));
})();