import {initializeApp} from 'firebase/app';
import {detachDevicePush,listenForForegroundPush} from './notification-client.js';
import {getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload} from 'firebase/auth';
import {getFirestore, doc, collection, getDocFromServer, onSnapshot, setDoc, deleteDoc,
  runTransaction, serverTimestamp, Timestamp} from 'firebase/firestore';
import {firebaseConfig} from './firebase-config.js';
import {CloudStore, emptyData, collections, clean} from './cloud-store.js';

export const configured = ['apiKey','authDomain','projectId','appId'].every(k => typeof firebaseConfig[k] === 'string' && firebaseConfig[k].trim());
export function friendlyError(error) {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already uses this email. Sign in or reset your password.',
    'auth/weak-password': 'Choose a stronger password with at least 10 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'An internet connection is needed for this account action.',
    'auth/operation-not-allowed': 'Enable Email/Password sign-in in the Firebase console.',
    'auth/invalid-api-key': 'Firebase setup needs a valid web app API key.',
    'auth/unauthorized-domain': 'Add this app’s domain to Firebase Authentication’s authorized domains.',
    'permission-denied': 'Cloud access was denied. Check your family membership and the deployed Firebase rules.',
    'unavailable': 'Cloud is unavailable. Your queued changes remain saved on this device.',
    'resource-exhausted': 'Cloud usage limit reached. Your changes remain queued on this device.',
  };
  return messages[error.code] || error.message || 'Something went wrong. Please try again.';
}

export class FamilyCloud {
  constructor({onState, onData, onStatus}) {
    this.onState=onState; this.onData=onData; this.onStatus=onStatus;
    this.user=null; this.family=null; this.store=null; this.generation=0;
    this.ready=false; this.flushing=false;
  }
  start() {
    if (!configured) return;
    this.app=initializeApp(firebaseConfig);
    listenForForegroundPush(this.app).catch(()=>{});
    this.auth=getAuth(this.app);
    // The durable, account-scoped outbox lives in CloudStore. Firestore uses its
    // default memory cache to avoid leaving a second private cache after sign-out.
    this.db=getFirestore(this.app);
    onAuthStateChanged(this.auth, user => this.loadAccount(user));
    window.addEventListener('online',()=>{if(this.user?.emailVerified&&!this.family)this.loadAccount(this.user);else this.flush();});
    window.addEventListener('offline',()=>this.reportStatus());
  }
  async loadAccount(user) {
    const generation=++this.generation;
    this.unsubscribe?.(); this.unsubscribeMember?.(); this.unsubscribeUser?.();
    this.user=user; this.family=null; this.store=null; this.ready=false; this.flushing=false;
    this.onState({user, family:null, loading:!!user?.emailVerified});
    if (!user?.emailVerified) return;
    const localKey=`dayshape-family:${firebaseConfig.projectId}:${user.uid}`;
    try {
      const snapshot=await getDocFromServer(doc(this.db,'users',user.uid));
      if(generation!==this.generation)return;
      const id=snapshot.data()?.familyId;
      if(!id){this.onState({user,family:null,loading:false});this.watchUser(generation);return;}
      localStorage.setItem(localKey,id);
      await this.attachFamily(id,generation);
    } catch(error) {
      if(generation!==this.generation)return;
      const id=localStorage.getItem(localKey);
      if(id && (error.code==='unavailable'||!navigator.onLine)) {
        await this.attachFamily(id,generation,true);
      } else this.onState({user,family:null,loading:false,error:friendlyError(error)});
    }
  }
  watchUser(generation) {
    this.unsubscribeUser=onSnapshot(doc(this.db,'users',this.user.uid), snapshot=>{
      if(generation===this.generation && snapshot.data()?.familyId)this.loadAccount(this.user);
    },error=>{if(generation===this.generation)this.onStatus(friendlyError(error));});
  }
  async attachFamily(id,generation,offline=false) {
    try {
      let name='Your family', ownerId=id;
      if(!offline){
        const [family,member]=await Promise.all([getDocFromServer(doc(this.db,'families',id)),getDocFromServer(doc(this.db,'families',id,'members',this.user.uid))]);
        if(!family.exists()||!member.exists())throw Error('This account is no longer a member of that family.');
        name=family.data().name; ownerId=family.data().ownerId;
      }
      if(generation!==this.generation)return;
      this.family={id,name,ownerId};
      this.store=new CloudStore(localStorage,`dayshape-cloud:${firebaseConfig.projectId}:${this.user.uid}:${id}`);
      this.onState({user:this.user,family:this.family,loading:false});
      this.onData(clean(this.store.data));this.reportStatus();
      this.unsubscribeMember=onSnapshot(doc(this.db,'families',id,'members',this.user.uid), member=>{
        if(generation!==this.generation||member.metadata.fromCache)return;
        if(!member.exists())this.denyAccess('Your family access has ended. Sign out and contact the family owner.');
      },error=>{if(generation===this.generation)this.denyAccess(friendlyError(error));});
      this.unsubscribe=onSnapshot(collection(this.db,'families',id,'records'),{includeMetadataChanges:true},snapshot=>{
        if(generation!==this.generation)return;
        // An empty initial memory-cache snapshot is not authoritative.
        if(snapshot.metadata.fromCache&&!this.ready)return;
        try {
          const remote=emptyData();
          for(const item of snapshot.docs){const row=item.data();if(collections.includes(row.kind))remote[row.kind].push(row.value);}
          this.ready=true;
          this.onData(clean(this.store.receive(remote)));this.reportStatus();this.flush();
        } catch(error){this.onStatus(friendlyError(error));}
      },error=>{if(generation===this.generation)this.denyAccess(friendlyError(error));});
    } catch(error) {
      if(generation===this.generation)this.onState({user:this.user,family:null,loading:false,error:friendlyError(error)});
    }
  }
  denyAccess(message) {
    this.generation++; this.unsubscribe?.();this.unsubscribeMember?.();this.unsubscribeUser?.();
    this.family=null;this.store=null;this.ready=false;this.flushing=false;
    this.onData(emptyData());this.onState({user:this.user,family:null,loading:false,error:message});
  }
  reportStatus() {
    if(!this.store)return;
    const count=Object.keys(this.store.pending).length;
    this.onStatus(!navigator.onLine ? `Offline · ${count?'changes waiting to sync':'saved copy'}` : count ? `${count} change${count===1?'':'s'} waiting to sync` : this.ready?'Saved to cloud':'Connecting to your family…');
  }
  save(data) {
    if(!this.store)throw Error('Open your family space before saving.');
    this.store.edit(data); this.reportStatus();this.flush();
  }
  async flush() {
    if(this.flushing||!this.ready||!this.store||!navigator.onLine)return;
    this.flushing=true;
    const generation=this.generation, store=this.store, familyId=this.family.id, userId=this.user.uid;
    try {
      for(const [key,row] of Object.entries(store.pending)) {
        if(generation!==this.generation)return;
        await setDoc(doc(this.db,'families',familyId,'records',key),{kind:row.kind,value:clean(row.value),writerId:userId,savedAt:serverTimestamp()});
        if(generation!==this.generation)return;
        store.acknowledge(key,row.token);
      }
      this.reportStatus();
    } catch(error) {if(generation===this.generation)this.onStatus(friendlyError(error));}
    finally {if(generation===this.generation)this.flushing=false;}
  }
  async register(email,password) {
    const credential=await createUserWithEmailAndPassword(this.auth,email.trim(),password);
    await sendEmailVerification(credential.user);
  }
  login(email,password){return signInWithEmailAndPassword(this.auth,email.trim(),password);}
  resetPassword(email){return sendPasswordResetEmail(this.auth,email.trim());}
  resendVerification(){return sendEmailVerification(this.auth.currentUser);}
  async refreshVerification(){await reload(this.auth.currentUser);await this.auth.currentUser.getIdToken(true);await this.loadAccount(this.auth.currentUser);}
  async logout() {
    if(this.store&&Object.keys(this.store.pending).length)throw Error('Some changes are still waiting to sync. Reconnect and wait for “Saved to cloud” before signing out.');
    const key=this.store?.key;
    await detachDevicePush();
    await signOut(this.auth);
    if(key)localStorage.removeItem(key);
  }
  async createFamily(name) {
    if(!this.user?.emailVerified)throw Error('Verify your email first.');
    if(!name.trim())throw Error('Enter a family name.');
    const id=this.user.uid;
    await runTransaction(this.db,async tx=>{
      const userRef=doc(this.db,'users',id),familyRef=doc(this.db,'families',id);
      const [u,f]=await Promise.all([tx.get(userRef),tx.get(familyRef)]);
      if(u.exists()||f.exists())throw Error('This account already has a family. Reload to open it.');
      tx.set(familyRef,{name:name.trim(),ownerId:id,createdAt:serverTimestamp()});
      tx.set(doc(this.db,'families',id,'members',id),{uid:id,role:'owner',email:this.user.email.toLowerCase()});
      tx.set(userRef,{familyId:id});
    });
    await this.loadAccount(this.user);
  }
  async invite(email) {
    if(this.family?.ownerId!==this.user.uid)throw Error('Only the family owner can invite another parent.');
    email=email.trim().toLowerCase();
    if(!/^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(email))throw Error('Enter a valid email address.');
    await setDoc(doc(this.db,'families',this.family.id,'invites',email),{email,role:'parent',expiresAt:Timestamp.fromMillis(Date.now()+7*24*60*60*1000)});
  }
  async joinFamily(id) {
    id=id.trim();
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('Enter the family code shared by the family owner.');
    const email=this.user.email.toLowerCase(),uid=this.user.uid;
    await runTransaction(this.db,async tx=>{
      const userRef=doc(this.db,'users',uid),inviteRef=doc(this.db,'families',id,'invites',email);
      const [u,invite]=await Promise.all([tx.get(userRef),tx.get(inviteRef)]);
      if(u.exists())throw Error('This account already belongs to a family.');
      if(!invite.exists()||invite.data().expiresAt.toMillis()<=Date.now())throw Error('No active invitation matches this email and family code. Ask the owner to invite you again.');
      tx.set(doc(this.db,'families',id,'members',uid),{uid,email,role:'parent'});
      tx.set(userRef,{familyId:id});
      tx.delete(inviteRef);
    });
    await this.loadAccount(this.user);
  }
  async accessList() {
    const {getDocs}=await import('firebase/firestore');
    const id=this.family.id;
    const [members,invites]=await Promise.all([getDocs(collection(this.db,'families',id,'members')),getDocs(collection(this.db,'families',id,'invites'))]);
    return {members:members.docs.map(x=>({id:x.id,...x.data()})),invites:invites.docs.map(x=>({id:x.id,...x.data()}))};
  }
  revokeInvite(email){return deleteDoc(doc(this.db,'families',this.family.id,'invites',email));}
  removeMember(uid){return deleteDoc(doc(this.db,'families',this.family.id,'members',uid));}
  importLocal(local){if(!this.ready)throw Error('Wait for your family’s cloud records to load before importing.');this.onData(clean(this.store.importLocal(local)));this.reportStatus();this.flush();}
}
