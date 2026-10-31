(() => {
'use strict';
const button=document.querySelector('[data-signin]');
if(!button)return;
const profile=document.querySelector('[data-profile]'),name=document.querySelector('[data-profile-name]'),avatar=document.querySelector('[data-avatar]'),message=document.querySelector('[data-auth-message]');
const VERSION='2026-10-31.1',PENDING='community-agreement-pending',DISMISSED='community-agreement-dismissed';
const note=t=>{message.textContent=t;};
const read=k=>{try{return JSON.parse(sessionStorage.getItem(k));}catch{return null;}};
const remove=k=>{try{sessionStorage.removeItem(k);}catch{}};
const save=(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
if(!window.supabase){button.disabled=false;button.textContent='Retry sign-in';button.onclick=()=>location.reload();note('Account service could not load.');return;}
const client=window.supabase.createClient('https://pwahlfdudwhqmufxvddn.supabase.co','sb_publishable_UhKt0XQyQSZOXhJVpsTWKQ_k6SrXH7p',{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,agreement=null,syncId=0,working=false,dialog;
const notify=()=>window.dispatchEvent(new Event('community-agreement-change'));
function paint(session){
 user=session?.user||null;button.hidden=!!user;profile.hidden=!user;button.disabled=false;button.textContent='Sign in';
 if(user){const meta=user.user_metadata||{};name.textContent=meta.full_name||meta.name||'Discord member';let url;try{url=new URL(meta.avatar_url||meta.picture||'');}catch{}
 avatar.hidden=true;if(url&&url.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)){avatar.src=url.href;avatar.hidden=false;}avatar.onerror=()=>{avatar.hidden=true;};}
}
function buildDialog(){
 if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.className='agreement-dialog';dialog.setAttribute('aria-labelledby','agreement-title');
 // Static, developer-authored markup only. User and provider values are assigned with textContent.
 dialog.innerHTML=`<form id="community-agreement-form"><p class="eyebrow">YOUR ACCOUNT / YOUR CHOICE</p><h2 id="agreement-title">Before you join.</h2><p>Operated by <strong>unnamed</strong>, Muscat, Oman. Signing in is free and authorises no payment or Patreon subscription.</p><p>Discord and Supabase handle login. Account information may include your Discord ID, display name, avatar and email. We never receive your Discord password. Published reviews, ratings and display names are public.</p><p class="small-print" data-agreement-record></p><fieldset><legend>Choose your account route</legend><label class="agreement-choice"><input type="radio" name="age_group" value="adult" required> I am 18 or older and can consent for myself.</label><label class="agreement-choice"><input type="radio" name="age_group" value="guardian" required> I need guardian approval, including if I am under 18.</label></fieldset><section data-guardian-fields hidden><p>A guardian must complete verification and give approval <strong>before Discord sign-in</strong>. <a class="text-link" href="./guardian.html" target="_blank" rel="noopener">Read the guardian process ↗</a></p><label for="guardian-code">Private approval code</label><input id="guardian-code" name="guardian_code" autocomplete="off" spellcheck="false" maxlength="64" placeholder="Code provided after guardian verification"><p class="small-print" data-guardian-status>Ask your guardian to contact the operator. Do not submit identity documents here.</p></section><label class="agreement-choice"><input type="checkbox" name="eligibility_confirmed" required> I meet Discord’s minimum age for my country. Any required guardian approval has been completed.</label><label class="agreement-choice"><input type="checkbox" name="terms_agreed" required> <span>I agree to the <a href="./legal/2026-10-31.1/terms.html" target="_blank" rel="noopener">Terms of Service ↗</a> and <a href="./legal/2026-10-31.1/rules.html" target="_blank" rel="noopener">Community Rules ↗</a>.</span></label><label class="agreement-choice"><input type="checkbox" name="privacy_acknowledged" required> <span>I acknowledge the <a href="./legal/2026-10-31.1/privacy.html" target="_blank" rel="noopener">Privacy Policy ↗</a> and <a href="./legal/2026-10-31.1/cookies.html" target="_blank" rel="noopener">Storage Policy ↗</a>.</span></label><label class="agreement-choice"><input type="checkbox" name="processing_consented" required> I consent to the described account data processing for login, reviews, moderation and security. If I need a guardian, their recorded approval also covers this processing.</label><label class="agreement-choice"><input type="checkbox" name="transfer_consented" required> I consent to the described processing outside Oman by the service providers, including the Supabase project hosted in Germany. If I need a guardian, their recorded approval also covers these transfers.</label><p class="small-print">You can browse without an account. Use Account &amp; privacy to withdraw this consent and stop new posts or edits. You can still delete your reviews. Contact the operator to request account deletion or exercise privacy rights. Withdrawal does not undo earlier lawful processing. <a href="mailto:gta6onlinediscord@gmail.com">Contact the operator</a>.</p><p data-agreement-error role="status" aria-live="polite"></p><div class="utility-row"><button class="button button-primary" type="submit" data-agreement-submit disabled>Continue with Discord</button><button class="button button-outline" type="button" data-agreement-cancel>Keep browsing</button></div><section class="agreement-manage" data-agreement-manage hidden><h3>Your account choices</h3><p>Withdrawing stops new reviews and edits immediately. Existing public reviews remain until deleted. Account deletion can be requested from the operator.</p><button class="button button-outline" type="button" data-agreement-withdraw>Withdraw account consent</button></section></form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form');
 function update(){
  const guardian=form.elements.age_group.value==='guardian';
  dialog.querySelector('[data-guardian-fields]').hidden=!guardian;
  form.elements.guardian_code.required=guardian&&!(user&&agreement?.guardian_approved&&agreement?.age_group==='guardian');
  dialog.querySelector('[data-guardian-status]').textContent=user&&agreement?.guardian_approved?'A current guardian approval is recorded for this Discord account.':'Ask your guardian to contact the operator. Do not submit identity documents here.';
  dialog.querySelector('[data-agreement-submit]').disabled=working||!form.checkValidity();
 }
 form.addEventListener('input',update);form.addEventListener('change',update);
 const dismiss=()=>{if(working)return;remove(PENDING);save(DISMISSED,user?.id||'visitor');dialog.close();};
 dialog.querySelector('[data-agreement-cancel]').onclick=dismiss;
 dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
 form.onsubmit=async e=>{
  e.preventDefault();if(working||!form.reportValidity())return;working=true;update();
  const error=dialog.querySelector('[data-agreement-error]');error.textContent='Checking your choices…';
  const payload={policy_version:VERSION,age_group:form.elements.age_group.value,guardian_code:form.elements.guardian_code.value.trim()||null};
  for(const key of ['terms_agreed','privacy_acknowledged','processing_consented','transfer_consented','eligibility_confirmed'])payload[key]=form.elements[key].checked;
  try{
   if(user){
    const result=await client.rpc('accept_agreement',payload);
    if(result.error)throw new Error(result.error.message);
    agreement=result.data;remove(DISMISSED);remove(PENDING);dialog.close();note('Your agreement has been saved.');notify();
   }else{
    if(payload.age_group==='guardian'){
     const checked=await client.rpc('check_guardian_code',{code:payload.guardian_code||''});
     if(checked.error||checked.data!==true)throw new Error('This approval code is invalid, expired or withdrawn. Ask your guardian to contact the operator before signing in.');
    }
    if(!save(PENDING,{payload,at:Date.now()}))throw new Error('Your browser must allow temporary session storage to complete sign-in.');
    const result=await client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:'https://unnamed79.github.io/Grand-Theft-Auto-VI-Online-DIscord-Server./reviews.html'}});
    if(result.error){remove(PENDING);throw new Error('Discord sign-in could not start. Please try again.');}
    error.textContent='Opening Discord…';
   }
  }catch(err){error.textContent=err.message||'Unable to save your choices. Please try again.';}
  finally{working=false;update();}
 };
 dialog.querySelector('[data-agreement-withdraw]').onclick=async()=>{
  if(working||!confirm('Withdraw account consent? New reviews and edits will stop. Existing reviews stay public until deleted; you can still delete your own.'))return;
  working=true;update();
  try{const result=await client.rpc('withdraw_agreement');if(result.error)throw result.error;agreement=null;save(DISMISSED,user?.id);dialog.close();note('Consent withdrawn. You can still browse and delete your reviews.');notify();}
  catch{dialog.querySelector('[data-agreement-error]').textContent='Could not withdraw consent. Please retry or contact the operator.';}
  finally{working=false;update();}
 };
 dialog.update=update;return dialog;
}
function showAgreement(manage=false){
 const d=buildDialog(),form=d.querySelector('form');if(d.open)return;
 form.reset();d.querySelector('[data-agreement-error]').textContent='';
 const adult=form.querySelector('[value="adult"]');adult.disabled=agreement?.age_group==='guardian';
 if(agreement?.age_group)form.elements.age_group.value=agreement.age_group;
 d.querySelector('[data-agreement-submit]').textContent=user?'Save agreement':'Continue with Discord';
 d.querySelector('[data-agreement-manage]').hidden=!user||!manage;
 d.querySelector('[data-agreement-withdraw]').disabled=!agreement?.accepted;
 d.querySelector('[data-agreement-record]').textContent=agreement?.accepted?`Accepted version ${agreement.version} · ${new Date(agreement.accepted_at).toLocaleDateString()}`:`Agreement version ${VERSION}. Your choices will be recorded after successful Discord sign-in.`;
 d.update();d.showModal();
}
async function syncAgreement(session,initial=false){
 const id=++syncId;paint(session);agreement=null;if(!user){notify();return;}
 const actor=user.id;
 const pending=initial?read(PENDING):null;
 let pendingError='';
 if(pending){
  remove(PENDING);
  if(pending.payload?.policy_version===VERSION&&Date.now()-pending.at>=0&&Date.now()-pending.at<20*60*1000){
   const result=await client.rpc('accept_agreement',pending.payload);
   if(result.error)pendingError='Your agreement could not be saved. Please review it again. Guardian codes must match this Discord account.';
  }
 }
 const result=await client.rpc('agreement_status');
 if(id!==syncId||user?.id!==actor)return;
 if(result.error){note('Could not check your agreement. Please retry from Account & privacy.');notify();return;}
 agreement=result.data;notify();
 if(pendingError)note(pendingError);
 if(!agreement.accepted&&!agreement.withdrawn&&read(DISMISSED)!==actor&&location.pathname.endsWith('/reviews.html'))showAgreement();
}
const ready=client.auth.getSession().then(async({data,error})=>{if(error)throw error;await syncAgreement(data.session,true);return data.session;});
window.communityAuth={client,ready,ensureAgreement:async()=>{
 await ready;if(!user){window.communityAuth.focusSignIn();return false;}
 const result=await client.rpc('agreement_status');agreement=result.error?null:result.data;
 if(result.error){note('Could not check your agreement. Please try again.');return false;}
 if(!agreement?.accepted){showAgreement();return false;}return true;
}};
client.auth.onAuthStateChange((event,session)=>{paint(session);if(event==='SIGNED_OUT'){agreement=null;remove(PENDING);remove(DISMISSED);if(dialog?.open)dialog.close();notify();}else if(event==='SIGNED_IN'){setTimeout(()=>ready.then(()=>syncAgreement(session)).catch(()=>{}),0);}});
button.onclick=()=>showAgreement();
const manage=document.createElement('button');manage.type='button';manage.className='button button-outline';manage.textContent='Account & privacy';manage.onclick=async()=>{profile.open=false;const result=await client.rpc('agreement_status');agreement=result.error?null:result.data;showAgreement(true);};profile.querySelector('.profile-menu').append(manage);
document.querySelector('[data-signout]').onclick=async()=>{const {error}=await client.auth.signOut();note(error?'Could not sign out. Please try again.':'Signed out.');if(!error)profile.open=false;};
window.communityAuth.focusSignIn=()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});button.focus({preventScroll:true});button.classList.add('signin-highlight');setTimeout(()=>button.classList.remove('signin-highlight'),2000);note('Sign in here to publish your review.');};
ready.catch(()=>{button.disabled=false;button.textContent='Sign in';note('Account service is taking longer than expected. Please refresh to retry.');});
})();

