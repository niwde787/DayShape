import {configured, friendlyError} from './cloud.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createAccountUI({cloud,getState,getLocal,modal,close,toast,exportData}) {
  let authMode='login';
  const button=(text,action,style='secondary full')=>`<button type="button" class="${style}" data-account="${action}">${text}</button>`;
  function show() {
    const state=getState();
    let body='';
    if(!configured) {
      body=`<div class="eyebrow">CLOUD SAVING IS NEXT</div><h2>One family. Every device.</h2><p>Firebase is ready to connect, but the app owner still needs to finish setup. Your existing profiles continue saving on this device.</p><a class="primary full" href="./firebase-setup.html" target="_blank" rel="noopener">View setup instructions ↗</a>`;
    } else if(!state.user) {
      body=`<div class="eyebrow">YOUR FAMILY, CONNECTED</div><h2>${authMode==='register'?'Create your parent account':'Welcome back.'}</h2><p>Sign in on any device to open your family’s profiles. Children can use a profile without an email account.</p><div class="segmented">${button('Sign in','login-tab',authMode==='login'?'selected':'')}${button('Create account','register-tab',authMode==='register'?'selected':'')}</div><form id="account-auth"><label>Email<input type="email" name="email" required autocomplete="email" maxlength="254"></label><label>Password<input type="password" name="password" required minlength="${authMode==='register'?10:1}" autocomplete="${authMode==='register'?'new-password':'current-password'}"></label>${authMode==='register'?'<p class="fine">Use at least 10 characters. We’ll send an email to verify your address.</p>':''}<p class="form-error" id="account-error" role="alert"></p><button class="primary full">${authMode==='register'?'Create account':'Sign in'} ↗</button></form>${button('Forgot your password?','reset','quiet full')}<p class="fine account-note">Use your own trusted device. Your session stays signed in until you sign out.</p>`;
    } else if(!state.user.emailVerified) {
      body=`<div class="eyebrow">ONE QUICK CHECK</div><h2>Check your inbox.</h2><p>Verify <strong>${esc(state.user.email)}</strong> using the email from DayShape, then come back here. This protects your family space.</p>${button('I’ve verified my email','verify','primary full')}${button('Send verification email again','resend')}${button('Sign out','logout','quiet full')}`;
    } else if(state.loading) {
      body='<h2>Opening your family space…</h2><p>Checking your account and saved profiles.</p>';
    } else if(!state.family) {
      body=`<div class="eyebrow">YOUR FAMILY’S SPACE</div><h2>Bring your days together.</h2><p>Signed in as ${esc(state.user.email)}.</p>${state.error?`<p class="form-error">${esc(state.error)}</p>${button('Try loading again','retry')}`:''}<form id="create-family"><label>Start a new family space<input name="name" placeholder="e.g. Our family" maxlength="60" required></label><button class="primary full">Create family space ↗</button></form><hr><form id="join-family"><label>Already invited? Enter your family code<input name="code" placeholder="Code shared by the family owner" required maxlength="128" autocomplete="off"></label><p class="fine">The owner must invite ${esc(state.user.email)} first. If your spouse already created a space, join theirs instead of creating another.</p><button class="secondary full">Join family</button></form>${button('Sign out','logout','quiet full')}`;
    } else {
      const owner=state.family.ownerId===state.user.uid;
      const local=getLocal();
      body=`<div class="eyebrow">YOUR FAMILY, CONNECTED</div><h2>${esc(state.family.name)}</h2><p>${esc(state.user.email)}<br>${owner?'Family owner':'Parent account'} · All family profiles are shared.</p><div class="storage-status">☁ <div><strong>${esc(state.status)}</strong><small>Changes sync while DayShape is open and online.</small></div></div>${button('Try sync again','sync','primary full')}${local.profiles.length?`<div class="import-panel"><h3>Bring your device profiles along</h3><p>${local.profiles.filter(p=>!p.deleted).length} local profile(s) are available on this device. Importing shares their activities and history with everyone in this family.</p>${button('Import this device’s profiles','import')}</div>`:''}${owner?`<hr><h3>Add another parent</h3><p class="fine">Invite their exact account email, then share the family code yourself. No invitation email is sent.</p><form id="invite-parent"><label>Parent’s email<input name="email" type="email" required maxlength="254" placeholder="parent@example.com"></label><button class="secondary full">Create invitation</button></form><label class="account-code">Family code<input readonly value="${esc(state.family.id)}" aria-label="Family code"></label>${button('Copy family code','copy-code','quiet full')}${button('Manage family access','manage','quiet full')}`:''}<hr>${button('Sign out of this device','logout','quiet full')}<p class="fine">Offline edits are kept in a private account-specific copy on this device. Signing out requires all edits to finish syncing.</p>`;
    }
    modal(`${body}<div id="account-message" role="status"></div><hr><h3>Keep a copy</h3><p class="fine">Download a backup of the profiles currently open.</p>${button('↓ Export backup','export')}`);
    bindForms();
  }
  async function run(action,{refresh=true}={}) {
    const dialog=document.querySelector('#modal');
    dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {await action();if(refresh)show();}
    catch(error){const target=document.querySelector('#account-error')||document.querySelector('#account-message');if(target){target.className='form-error';target.textContent=friendlyError(error);}else toast(friendlyError(error));}
    finally {dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  function bindForms() {
    const form=(id,handler)=>{const el=document.getElementById(id);if(el)el.onsubmit=e=>{e.preventDefault();const values=new FormData(el);run(()=>handler(values));};};
    form('account-auth',async f=>{if(authMode==='register')await cloud.register(f.get('email'),f.get('password'));else await cloud.login(f.get('email'),f.get('password'));});
    form('create-family',async f=>{await cloud.createFamily(f.get('name'));close();toast('Your family space is ready.');});
    form('join-family',async f=>{await cloud.joinFamily(f.get('code'));close();toast('You’re part of the family.');});
    form('invite-parent',async f=>{await cloud.invite(f.get('email'));toast('Invitation created for 7 days. Share your family code with them.');});
  }
  async function manage() {
    const {members,invites}=await cloud.accessList();
    modal(`<div class="eyebrow">FAMILY ACCESS</div><h2>Who shares this space?</h2><p>Removing a parent stops future cloud access. It cannot erase copies they previously downloaded.</p><div class="access-list">${members.map(m=>`<div><span>${esc(m.email)}<small>${esc(m.role)}</small></span>${m.uid!==getState().user.uid?`<button class="danger" data-remove-member="${esc(m.uid)}">Remove</button>`:''}</div>`).join('')}</div><h3>Pending invitations</h3><div class="access-list">${invites.length?invites.map(i=>`<div><span>${esc(i.email)}<small>${i.expiresAt.toMillis()>Date.now()?'Expires '+i.expiresAt.toDate().toLocaleDateString():'Expired'}</small></span><button class="danger" data-revoke-invite="${esc(i.id)}">Revoke</button></div>`).join(''):'<p>No pending invitations.</p>'}</div><div id="account-message" role="status"></div>${button('Back to account','back')}`);
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('button');if(!el)return;
    if(el.dataset.removeMember){run(async()=>{await cloud.removeMember(el.dataset.removeMember);await manage();},{refresh:false});return;}
    if(el.dataset.revokeInvite){run(async()=>{await cloud.revokeInvite(el.dataset.revokeInvite);await manage();},{refresh:false});return;}
    const action=el.dataset.account;if(!action)return;
    if(action==='login-tab'||action==='register-tab'){authMode=action==='login-tab'?'login':'register';show();}
    else if(action==='back')show();
    else if(action==='export')exportData();
    else if(action==='logout')run(()=>cloud.logout());
    else if(action==='verify')run(()=>cloud.refreshVerification());
    else if(action==='resend')run(async()=>{await cloud.resendVerification();toast('Verification email sent. Check your inbox and spam folder.');});
    else if(action==='retry')run(()=>cloud.loadAccount(cloud.user));
    else if(action==='sync')run(()=>cloud.flush());
    else if(action==='import')run(async()=>{cloud.importLocal(getLocal());toast('Device profiles imported. Cloud saving is in progress.');});
    else if(action==='copy-code')run(async()=>{await navigator.clipboard.writeText(getState().family.id);toast('Family code copied.');},{refresh:false});
    else if(action==='manage')run(manage,{refresh:false});
    else if(action==='reset') {
      const email=document.querySelector('#account-auth [name=email]');
      if(!email?.value||!email.checkValidity()){toast('Enter your email above, then tap Forgot your password.');return;}
      run(async()=>{await cloud.resetPassword(email.value);toast('If an account matches, you’ll receive a password reset email.');},{refresh:false});
    }
  });
  return {show};
}
