const fs=require('fs'),E=require('../dist/conjugation-engine.js'),input=JSON.parse(fs.readFileSync(0,'utf8')),engine=E.create(input.data);
for(const word of input.data.order){const entry=engine.get(word),evidence=input.evidence[word];if(!evidence||entry.blocked)continue;input.data.verbs[word].verified=E.rows.map((row,i)=>[0,1].map(n=>entry.forms[i][n].reduce((mask,form,p)=>mask|(evidence[i][n][p].includes(form)?1<<p:0),0)));}
process.stdout.write(JSON.stringify(input.data));
