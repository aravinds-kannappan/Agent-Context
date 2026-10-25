import test from 'node:test';
import assert from 'node:assert/strict';
import {createOllamaClient, OLLAMA_OPTIONS} from '../dist/ollama-client.mjs';
const response = data => new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json'}});

test('hosted lab contacts browser loopback and retains model provenance', async () => {
  const calls=[];
  const client=createOllamaClient({fetchImpl: async(url,options)=>{
    calls.push({url,options});
    return response(url.endsWith('/tags') ? {models:[{name:'test-model',digest:'fixture-digest'}]} :
      {model:'test-model',message:{content:'{"room_id":null}'},prompt_eval_count:51,eval_count:8,done_reason:'stop'});
  }});
  await client.listModels();
  const messages=[{role:'system',content:'Return JSON'},{role:'user',content:'Choose a room'}];
  const result=await client.trial('test-model',messages);
  assert.equal(calls[0].url,'http://127.0.0.1:11434/api/tags');
  assert.equal(calls[1].url,'http://127.0.0.1:11434/api/chat');
  assert.deepEqual(JSON.parse(calls[1].options.body),{model:'test-model',messages,stream:false,format:'json',options:OLLAMA_OPTIONS});
  assert.equal(result.modelDigest,'fixture-digest');assert.equal(result.usage.input_tokens,51);
  assert.equal(result.doneReason,'stop');assert.deepEqual(result.settings,OLLAMA_OPTIONS);
});
test('local lab uses same-origin server routes',async()=>{
  const calls=[];
  const client=createOllamaClient({local:true,fetchImpl:async(url)=>{calls.push(url);return response(url==='/api/config'?{ready:true,models:[{name:'fixture'}]}:{output:'{}',settings:OLLAMA_OPTIONS});}});
  await client.listModels();await client.trial('fixture',[]);
  assert.deepEqual(calls,['/api/config','/api/trial']);
});
test('connection failures give setup guidance; malformed responses and model errors remain errors',async()=>{
  const client=createOllamaClient({fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
  await assert.rejects(client.listModels(),/OLLAMA_ORIGINS/);
  const html=createOllamaClient({fetchImpl:async()=>new Response('<html>not API</html>')});
  await assert.rejects(html.listModels(),/web page instead of model data/);
  const error=createOllamaClient({fetchImpl:async()=>response({error:'Model failed to load'})});
  await assert.rejects(error.trial('fixture',[]),/Model failed to load/);
  const noModel=createOllamaClient({fetchImpl:async()=>response({models:[]})});
  assert.deepEqual(await noModel.listModels(),[]);
});
