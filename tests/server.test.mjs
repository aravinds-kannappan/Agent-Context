import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('local server serves the lab, proxies isolated requests, and enforces origin',async(t)=>{
  const calls=[];
  const fake=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'test-model',digest:'test-digest'}]}));return;}
    let body='';for await(const chunk of req)body+=chunk;
    calls.push(JSON.parse(body));res.end(JSON.stringify({model:'test-model',message:{content:'{"room_id":null}'},prompt_eval_count:123,eval_count:7,done_reason:'stop'}));
  });
  fake.listen(0,'127.0.0.1');await once(fake,'listening');
  const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),OLLAMA_URL:`http://127.0.0.1:${fake.address().port}`},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');fake.closeAllConnections();await new Promise(resolve=>fake.close(resolve));});
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Server startup timed out')),5000).unref())]);
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${base}/lab.html`)).status,200);
  const config=await(await fetch(`${base}/api/config`)).json();assert.equal(config.ready,true);assert.equal(config.models[0].name,'test-model');
  const payload={model:'test-model',messages:[{role:'system',content:'Return JSON'},{role:'user',content:'Choose a room'}]};
  const options={method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(payload)};
  const response=await fetch(`${base}/api/trial`,options),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.output,'{"room_id":null}');assert.equal(data.usage.input_tokens,123);assert.equal(data.modelDigest,'test-digest');
  assert.equal(calls.length,1);assert.deepEqual(calls[0].messages,payload.messages);assert.equal(calls[0].stream,false);assert.equal(calls[0].options.temperature,0);
  const denied=await fetch(`${base}/api/trial`,{...options,headers:{...options.headers,Origin:'https://unrelated.example'}});assert.equal(denied.status,403);assert.equal(calls.length,1);
  const unknown=await fetch(`${base}/api/trial`,{...options,body:JSON.stringify({...payload,model:'missing'})});assert.equal(unknown.status,502);assert.equal(calls.length,1);
});
