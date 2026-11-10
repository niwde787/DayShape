import {getApp} from 'firebase/app';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {notificationConfig} from './notification-config.js';
const TOKEN_KEY='dayshape-notification-token';
let foregroundListening=false;
export async function notificationCall(name,data){
  if(!notificationConfig.enabled)throw Error('Notifications are being set up. No reminders are active yet.');
  try{return (await httpsCallable(getFunctions(getApp(),notificationConfig.region),name)(data)).data;}
  catch(error){if(['functions/not-found','functions/unavailable','functions/internal'].includes(error.code))throw Error('The reminder service is not available yet. Your app data is safe; no new reminder has been enabled.');throw error;}
}
export async function enableDevicePush(){
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('Push is unavailable here. On iPhone/iPad, add DayShape to the Home Screen and open that icon.');
  // This must be called directly from the Enable push button's user gesture.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Notifications were not enabled. You can change permission in your device settings.');
  const {getMessaging,getToken,isSupported}=await import('firebase/messaging');
  if(!await isSupported())throw Error('This browser does not support push notifications.');
  const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
  const token=await getToken(getMessaging(getApp()),{vapidKey:notificationConfig.vapidKey,serviceWorkerRegistration:registration});
  localStorage.setItem(TOKEN_KEY,token);await listenForForegroundPush(getApp());return token;
}
export async function detachDevicePush(){const token=localStorage.getItem(TOKEN_KEY);if(!token)return;await notificationCall('detachNotificationDevice',{token});localStorage.removeItem(TOKEN_KEY);}
export async function listenForForegroundPush(app){
  if(foregroundListening||!('Notification'in window)||Notification.permission!=='granted')return;
  const {getMessaging,isSupported,onMessage}=await import('firebase/messaging');if(!await isSupported())return;
  foregroundListening=true;
  onMessage(getMessaging(app),async payload=>{if(!payload.notification)return;const registration=await navigator.serviceWorker.ready;await registration.showNotification(payload.notification.title||'DayShape',{body:payload.notification.body||'An update is ready.',data:{url:new URL('./',location.href).href}});});
}
