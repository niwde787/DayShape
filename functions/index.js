import {initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {getAuth} from 'firebase-admin/auth';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret} from 'firebase-functions/params';
import {createHash} from 'node:crypto';
import {validateRecipient,dueMessages} from './logic.js';
initializeApp();const db=getFirestore(),smsSecret=defineSecret('DAYSHAPE_SMS_CONFIG');
const options={region:'us-central1',maxInstances:2,secrets:[smsSecret]};
const hash=value=>createHash('sha256').update(value).digest('hex');
const smsConfig=()=>{try{return JSON.parse(smsSecret.value()||'{}');}catch{return {};}};
const smsReady=()=>{const c=smsConfig();return !!(c.accountSid&&c.authToken&&c.verifyServiceSid&&c.messagingServiceSid);};
const phone=value=>{if(typeof value!=='string'||!/^\+[1-9]\d{7,14}$/.test(value))throw new HttpsError('invalid-argument','Use a phone number with country code, e.g. +15551234567.');return value;};
async function authorize(request){
  if(!request.auth?.token.email_verified)throw new HttpsError('unauthenticated','Sign in with a verified parent account.');
  const uid=request.auth.uid,u=await db.doc(`users/${uid}`).get(),familyId=u.data()?.familyId;
  if(!familyId||!(await db.doc(`families/${familyId}/members/${uid}`).get()).exists)throw new HttpsError('permission-denied','Family membership is required.');
  return {uid,familyId};
}
async function requireProfile(familyId,id){if(typeof id!=='string'||!id||id.includes('/')||id.length>160)throw new HttpsError('invalid-argument','Choose a profile.');const p=await db.doc(`families/${familyId}/records/profiles__${id}`).get();if(!p.exists||p.data().value.deleted)throw new HttpsError('not-found','Profile no longer exists.');}
async function rate(uid,action,max){const ref=db.doc(`notificationRateLimits/${hash(uid+action+new Date().toISOString().slice(0,10))}`);await db.runTransaction(async tx=>{const s=await tx.get(ref),count=s.data()?.count||0;if(count>=max)throw new HttpsError('resource-exhausted','Daily verification limit reached. Try again tomorrow.');tx.set(ref,{count:count+1,updatedAt:FieldValue.serverTimestamp()});});}
async function twilio(url,body){const c=smsConfig();const response=await fetch(url,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(c.accountSid+':'+c.authToken).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok){const error=new Error('SMS provider could not complete this request.');error.providerCode=result.code;throw error;}return result;}
export const notificationSettings=onCall(options,async request=>{
  const {uid,familyId}=await authorize(request),input=request.data||{},profileId=input.profileId;
  await requireProfile(familyId,profileId);
  if(input.action==='list'){const result=await db.collection('notificationRecipients').where('uid','==',uid).get();return {smsReady:smsReady(),recipients:result.docs.filter(d=>d.data().profileId===profileId&&d.data().familyId===familyId).map(d=>{const r=d.data();return {id:d.id,label:r.label,recipientType:r.recipientType,midweek:r.midweek,weekly:r.weekly,flags:r.flags,hour:r.hour,timezone:r.timezone,push:!!r.pushToken,sms:!!r.sms,phoneLast4:r.phone?.slice(-4)||''};})};}
  if(input.action==='remove'){const ref=db.doc(`notificationRecipients/${String(input.id).replace(/[^a-zA-Z0-9_-]/g,'')}`),r=await ref.get();if(!r.exists||r.data().uid!==uid||r.data().familyId!==familyId||r.data().profileId!==profileId)throw new HttpsError('permission-denied','This recipient is not yours to manage.');await ref.delete();return {removed:true};}
  if(input.action!=='save')throw new HttpsError('invalid-argument','Unknown action.');
  let settings;try{settings=validateRecipient(input);}catch(e){throw new HttpsError('invalid-argument',e.message);}
  if(input.consent!==true)throw new HttpsError('failed-precondition','Confirm recipient consent, including guardian approval for a child.');
  if(typeof input.recipientId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(input.recipientId))throw new HttpsError('invalid-argument','Invalid recipient identifier.');
  const pushToken=typeof input.pushToken==='string'&&input.pushToken.length>20&&input.pushToken.length<4096?input.pushToken:null;
  const sms=input.sms===true;let number=null;
  if(sms){if(!smsReady())throw new HttpsError('failed-precondition','SMS setup is not complete.');number=phone(input.phone);const proof=await db.doc(`notificationPhoneProofs/${hash(uid+number)}`).get();if(!proof.exists||Date.now()-proof.data().verifiedAt.toMillis()>30*86400000)throw new HttpsError('failed-precondition','Verify this phone number first.');}
  if(!pushToken&&!sms)throw new HttpsError('invalid-argument','Enable push or verified SMS for this recipient.');
  const id=hash(uid+profileId+input.recipientId),own=await db.collection('notificationRecipients').where('uid','==',uid).get();if(own.size>=20&&!own.docs.some(d=>d.id===id))throw new HttpsError('resource-exhausted','Up to 20 reminder recipients are supported per parent account.');
  // A browser push token belongs to the currently signed-in account only.
  if(pushToken){const previous=await db.collection('notificationRecipients').where('pushToken','==',pushToken).get();for(const doc of previous.docs)if(doc.data().uid!==uid)await doc.ref.update({pushToken:null});}
  // Replace this device's existing recipient for this profile instead of duplicating pushes.
  if(pushToken)for(const d of own.docs)if(d.id!==id&&d.data().profileId===profileId&&d.data().pushToken===pushToken)await d.ref.update({pushToken:null});
  await db.doc(`notificationRecipients/${id}`).set({...settings,uid,familyId,profileId,pushToken,sms,phone:number,consentVersion:1,consentAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return {saved:true};
});
export const verifyNotificationPhone=onCall(options,async request=>{
  const {uid}=await authorize(request),input=request.data||{};if(!smsReady())throw new HttpsError('failed-precondition','SMS setup is not complete.');
  const number=phone(input.phone),c=smsConfig(),ref=db.doc(`notificationPhoneProofs/${hash(uid+number)}`);
  try{
    if(input.action==='send'){if(input.consent!==true)throw new HttpsError('failed-precondition','Get permission to send a verification text first.');await rate(uid,'send',5);await rate(hash(number),'phone-send',5);await rate('project','send',30);await twilio(`https://verify.twilio.com/v2/Services/${c.verifyServiceSid}/Verifications`,{To:number,Channel:'sms'});return {sent:true};}
    if(input.action!=='check'||!/^\d{4,10}$/.test(input.code||''))throw new HttpsError('invalid-argument','Enter the verification code.');
    await rate(uid,'check',15);const result=await twilio(`https://verify.twilio.com/v2/Services/${c.verifyServiceSid}/VerificationCheck`,{To:number,Code:input.code});
    if(result.status!=='approved')throw new HttpsError('invalid-argument','The verification code was not accepted.');await ref.set({uid,verifiedAt:FieldValue.serverTimestamp()});return {verified:true};
  }catch(e){if(e instanceof HttpsError)throw e;throw new HttpsError('unavailable','The SMS provider could not complete verification. Check the number or try later.');}
});
export const detachNotificationDevice=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.');const token=request.data?.token;if(typeof token!=='string')return {removed:true};
  const docs=await db.collection('notificationRecipients').where('pushToken','==',token).get();for(const d of docs.docs)if(d.data().uid===request.auth.uid)await d.ref.update({pushToken:null});return {removed:true};
});
export const deliverDayShapeReminders=onSchedule({...options,schedule:'every 15 minutes',timeZone:'UTC',timeoutSeconds:300,retryCount:0},async()=>{
  const recipients=await db.collection('notificationRecipients').get(),now=new Date(),families=new Map(),accounts=new Map();
  for(const doc of recipients.docs){const r=doc.data();
    try{
      if(!accounts.has(r.uid))accounts.set(r.uid,await getAuth().getUser(r.uid));const account=accounts.get(r.uid);if(account.disabled||!account.emailVerified)continue;
      if(!(await db.doc(`families/${r.familyId}/members/${r.uid}`).get()).exists)continue;
      const user=await db.doc(`users/${r.uid}`).get();if(user.data()?.familyId!==r.familyId)continue;
      if(!families.has(r.familyId)){const snapshot=await db.collection(`families/${r.familyId}/records`).get();families.set(r.familyId,snapshot.docs.map(d=>d.data()));}
      for(const message of dueMessages(r,families.get(r.familyId),now))for(const channel of ['push','sms']){
        if(channel==='push'&&!r.pushToken||channel==='sms'&&(!r.sms||!smsReady()))continue;
        const latest=await doc.ref.get();if(!latest.exists)continue;const fresh=latest.data();if(channel==='push'&&fresh.pushToken!==r.pushToken||channel==='sms'&&(!fresh.sms||fresh.phone!==r.phone))continue;
        const destination=channel==='push'?r.pushToken:r.phone;
        const delivery=db.doc(`notificationDeliveries/${hash(r.familyId+r.profileId+destination+message.key+channel)}`);
        const claimed=await db.runTransaction(async tx=>{if((await tx.get(delivery)).exists)return false;tx.create(delivery,{recipientId:doc.id,channel,state:'attempted',createdAt:FieldValue.serverTimestamp()});return true;});if(!claimed)continue;
        try{
          if(channel==='push')await getMessaging().send({token:r.pushToken,notification:{title:message.title,body:message.body},webpush:{fcmOptions:{link:'https://niwde787.github.io/DayShape/'},headers:{TTL:'3600'},notification:{tag:message.key,icon:'https://niwde787.github.io/DayShape/icon.svg'}}});
          else {const c=smsConfig();await twilio(`https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`,{To:r.phone,MessagingServiceSid:c.messagingServiceSid,Body:`${message.title}. ${message.body} Open DayShape for details. Reply STOP to unsubscribe.`});}
          await delivery.update({state:'sent'});
        }catch(error){await delivery.update({state:'failed',code:String(error.providerCode||error.code||'delivery-error').slice(0,100)});if(error.providerCode===21610)await doc.ref.update({sms:false});if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code))await doc.ref.update({pushToken:null});}
      }
    }catch{console.warn('Reminder evaluation failed',doc.id);}
  }
});
