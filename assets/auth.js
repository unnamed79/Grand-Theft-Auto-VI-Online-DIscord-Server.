(() => {
'use strict';
const button=document.querySelector('[data-signin]'),profile=document.querySelector('[data-profile]'),name=document.querySelector('[data-profile-name]'),avatar=document.querySelector('[data-avatar]'),message=document.querySelector('[data-auth-message]');
const note=t=>{message.textContent=t;};
if(!window.supabase){button.disabled=false;button.textContent='Retry sign-in';button.onclick=()=>location.reload();note('Account service could not load.');return;}
const client=window.supabase.createClient('https://pwahlfdudwhqmufxvddn.supabase.co','sb_publishable_UhKt0XQyQSZOXhJVpsTWKQ_k6SrXH7p',{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
function paint(session){
 const user=session?.user;if(user)note('');button.hidden=!!user;profile.hidden=!user;button.disabled=false;button.textContent='Sign in';
 if(user){const meta=user.user_metadata||{};name.textContent=meta.full_name||meta.name||'Discord member';let url;try{url=new URL(meta.avatar_url||meta.picture||'');}catch{}
 avatar.hidden=true;if(url&&url.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)){avatar.src=url.href;avatar.hidden=false;}avatar.onerror=()=>{avatar.hidden=true;};}
}
window.communityAuth={client,ready:client.auth.getSession().then(({data,error})=>{paint(data.session);if(error)note('Unable to restore your session. Please try sign-in.');return data.session;})};
client.auth.onAuthStateChange((_event,session)=>{paint(session);});
button.onclick=async()=>{button.disabled=true;note('Opening Discord…');const {error}=await client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:'https://unnamed79.github.io/Grand-Theft-Auto-VI-Online-DIscord-Server./reviews.html'}});if(error){button.disabled=false;note('Sign-in could not start. Please try again.');}};
document.querySelector('[data-signout]').onclick=async()=>{const {error}=await client.auth.signOut();note(error?'Could not sign out. Please try again.':'Signed out.');if(!error)profile.open=false;};
window.communityAuth.focusSignIn=()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});button.focus({preventScroll:true});button.classList.add('signin-highlight');setTimeout(()=>button.classList.remove('signin-highlight'),2000);note('Sign in here to publish your review.');};
window.communityAuth.ready.catch(()=>{button.disabled=false;button.textContent='Sign in';note('Account service is taking longer than expected.');});
})();