import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT||4873);
const ollama=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const allowedHosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function getModels(){
  const response=await fetch(`${ollama}/api/tags`,{signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('Ollama model list unavailable.');
  const data=await response.json();return (data.models||[]).map(m=>({name:m.name,digest:m.digest}));
}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>100000)throw new Error('Request too large.');}return JSON.parse(text);}
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!allowedHosts.has(req.headers.host)){json(res,403,{error:'Local host required.'});return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{json(res,400,{error:'Invalid path.'});return;}
  if(pathname==='/api/config'&&req.method==='GET'){
    try{const models=await getModels();json(res,200,{ready:models.length>0,models,message:models.length?'Connected to local Ollama.':'Ollama is running, but no models are installed. Install a model, then refresh.'});}
    catch{json(res,200,{ready:false,models:[],message:'The lab server is running. Start Ollama at its configured local address, then refresh.'});}return;
  }
  if(pathname==='/api/trial'&&req.method==='POST'){
    const origin=req.headers.origin;
    if(!origin||!new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]).has(origin)){json(res,403,{error:'Open the lab on this local server.'});return;}
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    const timer=setTimeout(()=>controller.abort(),120000);
    try{
      const payload=await body(req),models=await getModels();
      if(!models.some(m=>m.name===payload.model))throw new Error('Choose an installed Ollama model.');
      if(!Array.isArray(payload.messages)||payload.messages.length!==2||payload.messages[0]?.role!=='system'||payload.messages[1]?.role!=='user'||payload.messages.some(m=>typeof m.content!=='string'||m.content.length>30000))throw new Error('Invalid trial input.');
      const response=await fetch(`${ollama}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:payload.model,messages:payload.messages,stream:false,format:'json',options:{temperature:0,num_predict:512,num_ctx:8192}})});
      if(!response.ok)throw new Error(`Ollama returned HTTP ${response.status}.`);
      const data=await response.json();if(data.error)throw new Error(String(data.error));
      if(typeof data.message?.content!=='string')throw new Error('Ollama returned no answer text.');
      json(res,200,{output:data.message.content,model:data.model,modelDigest:models.find(m=>m.name===payload.model)?.digest,usage:{input_tokens:data.prompt_eval_count??null,output_tokens:data.eval_count??null},doneReason:data.done_reason??null,settings:{temperature:0,num_predict:512,num_ctx:8192}});
    }catch(error){if(!res.destroyed)json(res,502,{error:error.name==='AbortError'?'Model request stopped or exceeded the two-minute timeout.':error.message});}
    finally{clearTimeout(timer);}return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed.'});return;}
  if(pathname.startsWith('/api/')){json(res,404,{error:'API route not found.'});return;}
  const filename=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!filename.startsWith(root+path.sep)){json(res,403,{error:'Invalid path.'});return;}
  try{const data=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);}
  catch{json(res,404,{error:'Not found.'});}
});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}/lab.html`;
  console.log(`Context lab: ${url}\nGuide: http://127.0.0.1:${port}/\nOllama connection: ${ollama}`);
  if(process.argv.includes('--open')){
    const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';
    const args=process.platform==='win32'?['/c','start','',url]:[url];
    const child=spawn(command,args,{stdio:'ignore'});child.on('error',()=>console.log('Open the lab URL above in your browser.'));child.unref();
  }
});
