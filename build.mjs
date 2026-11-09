import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','style.css','app.js','domain.js','sync.js','icon.svg','manifest.webmanifest','sw.js'])await copyFile(file,'dist/'+file);
console.log('DayShape static build ready in dist/');
