import {initializeApp} from 'firebase/app';
import {getMessaging,isSupported} from 'firebase/messaging/sw';
import {firebaseConfig} from './firebase-config.js';
import './sw.js';
// FCM handles background notifications and opens its same-origin fcmOptions link.
isSupported().then(supported=>{if(supported)getMessaging(initializeApp(firebaseConfig));}).catch(()=>{});
