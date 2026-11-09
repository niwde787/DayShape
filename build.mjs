import {mkdir,copyFile} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','style.css','icon.svg','manifest.webmanifest','sw.js','firebase-setup.html','firestore.rules'])await copyFile(file,'dist/'+file);
await build({entryPoints:['app.js'],bundle:true,format:'esm',platform:'browser',target:['safari16','chrome110'],outfile:'dist/app.js',minify:true});
console.log('DayShape static build ready in dist/');
