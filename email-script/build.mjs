import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {buildWeeklyEmail} from '../weekly-email.js';
await build({entryPoints:['weekly-email.js'],bundle:true,format:'iife',globalName:'DayShapeEmail',platform:'neutral',target:'es2020',outfile:'email-script/Report.gs'});
console.log('Apps Script Report.gs updated. Upload it alongside Code.gs and appsscript.json.');
const example={profiles:[{id:'sample',name:'Alex (sample)',timeTargets:{screenMinutes:600}}],activities:[{id:'practice',profileId:'sample',name:'Practice',category:'move'},{id:'games',profileId:'sample',name:'Video games',category:'play',screenTime:true}],goals:[{id:'goal',profileId:'sample',activityId:'practice',week:'2026-11-09',direction:'min',minutes:180}],routines:[],entries:[{id:'e1',profileId:'sample',activityId:'practice',date:'2026-11-10',minutes:120,kind:'actual'},{id:'e2',profileId:'sample',activityId:'games',date:'2026-11-11',minutes:120,kind:'actual'}]};
await writeFile('email-script/sample-report.html',buildWeeklyEmail(example,'2026-11-09').html);
