// Runs privately as the Firebase project owner. Never deploy this as a web app.
const DAYSHAPE_PROJECT = 'dayshape-630e7';
const DAYSHAPE_ROOT = 'https://firestore.googleapis.com/v1/projects/' + DAYSHAPE_PROJECT + '/databases/(default)/documents/';

function api_(url, method, payload, allowed) {
  const response = UrlFetchApp.fetch(url, {
    method: method || 'get', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    ...(payload === undefined ? {} : {payload: JSON.stringify(payload)}),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if ((allowed || []).includes(code)) return null;
  // Do not log response bodies: Auth lookup includes private account information.
  if (code < 200 || code >= 300) throw new Error('DayShape API request failed (HTTP ' + code + '). Check project permissions and API access.');
  return JSON.parse(response.getContentText() || '{}');
}
function decode_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode_);
  if ('mapValue' in v) return fields_(v.mapValue.fields || {});
  return null;
}
function fields_(fields) { return Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,decode_(v)])); }
function get_(path) { const d = api_(DAYSHAPE_ROOT + path, 'get', undefined, [404]); return d ? fields_(d.fields || {}) : null; }
function list_(path) {
  let token = '', result = [];
  do {
    const page = api_(DAYSHAPE_ROOT + path + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    result = result.concat((page.documents || []).map(d => ({id: d.name.split('/').pop(), ...fields_(d.fields || {})})));
    token = page.nextPageToken;
    if (result.length > 10000) throw new Error('Family deployment size limit reached. Review query strategy.');
  } while (token);
  return result;
}
function patch_(path, values, createOnly) {
  const fields = Object.fromEntries(Object.entries(values).map(([k,v]) => [k,typeof v === 'boolean' ? {booleanValue:v} : {stringValue:String(v)}]));
  return api_(DAYSHAPE_ROOT + path + (createOnly ? '?currentDocument.exists=false' : ''), 'patch', {fields}, createOnly ? [409,412] : []);
}
function account_(uid) {
  const result = api_('https://identitytoolkit.googleapis.com/v1/projects/' + DAYSHAPE_PROJECT + '/accounts:lookup','post',{localId:[uid]});
  const u = (result.users || []).find(u => u.localId === uid);
  // Return only fields the report needs; never persist the Auth response.
  return u ? {email:u.email,emailVerified:u.emailVerified===true,disabled:u.disabled===true} : null;
}
function recipient_(uid) {
  const p = get_('weeklyEmailPreferences/' + encodeURIComponent(uid));
  if (!p || !p.enabled || !/^[A-Za-z0-9_-]{1,128}$/.test(p.familyId)) return null;
  const u = account_(uid), link = get_('users/' + encodeURIComponent(uid));
  const member = get_('families/' + encodeURIComponent(p.familyId) + '/members/' + encodeURIComponent(uid));
  return DayShapeEmail.eligibleEmail(p,u,link,!!member) ? {preference:p,account:u} : null;
}
function data_(familyId) {
  const data = {profiles:[],activities:[],entries:[],goals:[],routines:[]};
  for (const row of list_('families/' + encodeURIComponent(familyId) + '/records')) {
    if (Object.prototype.hasOwnProperty.call(data,row.kind) && row.value) data[row.kind].push(row.value);
  }
  return data;
}

function sendMondayReports() {
  const window = DayShapeEmail.reportWindow(new Date());
  if (!window.due || !get_('deliveryServices/weeklyEmail')?.enabled) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    let failures = 0;
    for (const row of list_('weeklyEmailPreferences').filter(p => p.enabled)) {
      try {
        if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Daily email quota reached.');
        let r = recipient_(row.id); if (!r) continue;
        const report = DayShapeEmail.buildWeeklyEmail(data_(r.preference.familyId),window.start);
        if (!report) continue;
        const claim = 'weeklyEmailDeliveries/' + encodeURIComponent(row.id + '__' + window.start);
        if (get_(claim)) continue;
        // Recheck consent, membership and the current verified Auth address just before sending.
        const latest = recipient_(row.id);
        if (!latest || latest.preference.familyId !== r.preference.familyId || latest.account.email !== r.account.email) continue;
        if (!patch_(claim,{status:'attempted',week:window.start,attemptedAt:new Date().toISOString()},true)) continue;
        // Claim before submission prevents duplicate reports, including after a timeout or re-run.
        // An ambiguous failure is NOT automatically retried; it may result in one missed report.
        try {
          MailApp.sendEmail({to:latest.account.email,subject:report.subject,body:report.text,htmlBody:report.html,name:'DayShape'});
          patch_(claim,{status:'sent',week:window.start,sentAt:new Date().toISOString()});
        } catch (error) {
          patch_(claim,{status:'failed-or-unknown',week:window.start,checkedAt:new Date().toISOString()});
          throw new Error('Email submission failed or its result could not be confirmed.');
        }
      } catch (error) { failures++; console.warn('One weekly report could not be processed. Check delivery status and service permissions.'); }
    }
    if (failures) throw new Error(failures + ' weekly report(s) could not be processed. No private report content was logged.');
  } finally { lock.releaseLock(); }
}

// Run first: verifies API access without sending email or enabling the schedule.
function checkDayShapeConnection() {
  list_('weeklyEmailPreferences');
  api_('https://identitytoolkit.googleapis.com/v1/projects/' + DAYSHAPE_PROJECT + '/accounts:lookup','post',{localId:['dayshape-connection-probe']});
  console.log('DayShape connection works. Remaining recipient quota today: ' + MailApp.getRemainingDailyQuota());
}
// Run only after reviewing the sample report and opting in from DayShape.
function installMondayReports() {
  checkDayShapeConnection();
  for (const trigger of ScriptApp.getProjectTriggers()) if (trigger.getHandlerFunction() === 'sendMondayReports') ScriptApp.deleteTrigger(trigger);
  ScriptApp.newTrigger('sendMondayReports').timeBased().inTimezone('America/New_York').onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  patch_('deliveryServices/weeklyEmail',{enabled:true,provider:'google-apps-script',timezone:'America/New_York',configuredAt:new Date().toISOString()});
  console.log('Monday reports installed for approximately 9–10am Eastern. No email was sent by setup.');
}
function stopMondayReports() {
  patch_('deliveryServices/weeklyEmail',{enabled:false});
  for (const trigger of ScriptApp.getProjectTriggers()) if (trigger.getHandlerFunction() === 'sendMondayReports') ScriptApp.deleteTrigger(trigger);
}
