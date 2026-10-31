(() => {
'use strict';
const status=document.querySelector('#review-status'), list=document.querySelector('#reviews-list'), form=document.querySelector('#review-form');
if(!window.communityAuth){status.textContent='Login service could not load. Please refresh or try again later.';return;}
const client=window.communityAuth.client;
let user=null,staff=false,editing=null,rows=[],page=0;
const say=message=>{status.textContent=message;};
const text=(tag,value,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;};
function reset(){editing=null;form.reset();document.querySelector('#submit-review').textContent='Publish review';document.querySelector('#cancel-edit').hidden=true;}
async function load(){
 const {data,error}=await client.from('website_reviews').select('id,author_id,display_name,rating,body,created_at,updated_at,staff_edited').order('created_at',{ascending:false}).range(page*20,page*20+19);
 if(error){say('Unable to load reviews. Please try again.');return;}
 rows=data;list.replaceChildren();
 if(!data.length)list.append(text('p','No reviews on this page yet. Share your experience with the website.'));
 data.forEach(r=>{
 const card=document.createElement('article');card.className='policy-card review-card';
 card.append(text('h3',r.display_name),text('p','★'.repeat(r.rating)+'☆'.repeat(5-r.rating),'review-stars'),text('p',r.body,'review-body'));
 card.append(text('p',new Date(r.created_at).toLocaleDateString()+(r.staff_edited?' · Edited by staff':r.updated_at!==r.created_at?' · Edited':''),'small-print'));
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
 e.preventDefault();if(!user){window.communityAuth.focusSignIn();return;}
 const button=document.querySelector('#submit-review');button.disabled=true;
 try{
 const payload={rating:Number(new FormData(form).get('rating')),body:form.elements.body.value.trim()};
 let result;
 if(editing)result=await client.from('website_reviews').update(payload).eq('id',editing).select('id');
 else result=await client.from('website_reviews').insert(payload).select('id');
 if(result.error){say(result.error.code==='23505'?'You already have a review. Find it below and choose Edit.':result.error.message.includes('30 seconds')?'Please wait 30 seconds between submissions or edits.':'Could not save your review. Check your sign-in and try again.');return;}
 if(!result.data.length){say('Review was not saved. Your access may have changed.');return;}
 reset();page=0;say('Your review is published.');await load();
 }catch{say('Connection interrupted. Please try again.');}finally{button.disabled=false;}
};
client.auth.onAuthStateChange(()=>{setTimeout(()=>auth(),0);});
auth().then(()=>{if(location.search.includes('code=')||location.hash)history.replaceState(null,'',location.pathname);}).catch(()=>say('Unable to connect to the login service. Please refresh.'));
})();