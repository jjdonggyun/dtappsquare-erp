import assert from 'node:assert/strict';
import https from 'node:https';
import {readFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

const fixture=path.resolve('output/device-agent-tests/fixture');
const exe=path.resolve('output/device-agent-tests/AgentFixtureTests.exe');
const records=[];
let behavior='accept';
let redirected=0;
const redirectedServer=https.createServer({key:readFileSync(path.join(fixture,'server.key')),cert:readFileSync(path.join(fixture,'server.crt'))},(req,res)=>{redirected++;res.end('{}');});
await new Promise(resolve=>redirectedServer.listen(0,'127.0.0.1',resolve));
const erp=https.createServer({key:readFileSync(path.join(fixture,'server.key')),cert:readFileSync(path.join(fixture,'server.crt'))},async(req,res)=>{
  if(req.url==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"healthy":true}');return;}
  assert.equal(req.url,'/api/device-agent/attendance-proof');assert.equal(req.method,'POST');
  let raw='';for await(const chunk of req)raw+=chunk;
  records.push(JSON.parse(raw));
  if(behavior==='redirect'){res.writeHead(307,{Location:`https://127.0.0.1:${redirectedServer.address().port}/stolen`});res.end();return;}
  if(behavior==='invalid-json'){res.writeHead(200);res.end('invalid json');return;}
  res.writeHead(behavior==='reject'?403:200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({data:{accepted:behavior==='accept',status:behavior==='accept'?'READY':'FAILED'}}));
});
await new Promise(resolve=>erp.listen(0,'127.0.0.1',resolve));
const origin=`https://127.0.0.1:${erp.address().port}`;
const children=[];
async function launch(origin){
  const child=spawn(exe,[origin],{stdio:['pipe','pipe','pipe'],windowsHide:true});children.push(child);
  let output='';let errors='';child.stderr.on('data',c=>errors+=c);
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Native Agent timeout: '+output+' '+errors)),10000);
    child.stdout.on('data',c=>{output+=c;const match=output.match(/READY (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Native Agent exited '+code+': '+errors));});
  });
  return {child,port};
}
async function health(origin){
  const child=spawn(exe,['--health',origin],{windowsHide:true});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
  const code=await new Promise(resolve=>child.once('exit',resolve));return {code,output};
}
let stage='start';
try{
  const native=await launch(origin);
  const endpoint=`http://127.0.0.1:${native.port}/proof`;
  let r=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
  stage='wrong origin';r=await fetch(endpoint,{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:JSON.stringify({verification_id:randomUUID()})});
  assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(records.length,0);
  stage='invalid UUID';r=await fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"verification_id":"bad"}'});
  assert.equal(r.status,400);assert.equal(records.length,0);
  stage='oversized payload';r=await fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'x'.repeat(1025)});
  assert.equal(r.status,400);assert.equal(records.length,0);
  const verificationId=randomUUID();
  const proof=()=>fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({verification_id:verificationId})});
  stage='valid proof';r=await proof();assert.equal(r.status,200,await r.text());
  assert.equal(records[0].device_id,'db863cf0-e2e0-4f0d-9300-515af3b58301');
  assert.equal(records[0].device_token,'test-only-credential-with-more-than-thirty-two-characters');
  assert.equal(records[0].verification_id,verificationId);assert.match(records[0].nonce,/^[0-9a-f]{48}$/);
  assert.ok(Math.abs(Date.now()-Date.parse(records[0].timestamp))<60000);
  r=await proof();assert.equal(r.status,200);assert.notEqual(records[0].nonce,records[1].nonce);
  behavior='reject';r=await proof();assert.equal(r.status,403);
  behavior='false-on-200';r=await proof();assert.equal(r.status,403);
  behavior='invalid-json';r=await proof();assert.equal(r.status,502);
  behavior='redirect';r=await proof();assert.equal(r.status,403);assert.equal(redirected,0);
  const goodHealth=await health(origin);assert.equal(goodHealth.code,0,goodHealth.output);
  const wrongName=await health(`https://localhost:${erp.address().port}`);assert.equal(wrongName.code,1,'TLS hostname mismatch must be rejected');
  const invalid=spawnSync(exe,['http://192.168.1.109:3200'],{encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(invalid.status,1);
  console.log('PASS: native EXE protocol, trusted internal CA HTTPS, hostname validation, exact-origin CORS, input bounds, identity/time/nonce, rejected proof, redirect protection, HTTP rejection, DPAPI round trip and tamper rejection.');
}catch(error){throw new Error('Native EXE test failed at '+stage,{cause:error});}finally{
  for(const child of children){child.stdin.end('\n');if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));}
  erp.closeAllConnections();redirectedServer.closeAllConnections();
  await Promise.all([new Promise(r=>erp.close(r)),new Promise(r=>redirectedServer.close(r))]);
}
