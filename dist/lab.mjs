import { VERSION, POLICIES, generateCases, selectContext, messagesFor, referenceAction, parseAction, grade, rng, shuffled } from './experiment-core.mjs';
import {createOllamaClient} from './ollama-client.mjs';
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const client = createOllamaClient({local});
const $ = selector => document.querySelector(selector);
let run = null, controller = null, busy = false, models = [], connectionReady = false;
function updateSize() {
  $('#cap-label').textContent = `${$('#cap').value} source blocks`;
  const size = Number($('#pairs').value) * 2 * POLICIES.length * Number($('#repeats').value);
  $('#run-size').textContent = `${size} trials · six policies`;
  $('#progress').max = size;
}
for(const id of ['#pairs','#repeats','#cap']) $(id).addEventListener('input',updateSize);
function syncControls() {
  const isModel = $('#engine').value === 'ollama';
  $('#model-settings').hidden = !isModel;
  $('#setup').hidden = !isModel;
  $('#try-demo').hidden = !isModel;
  $('#model').disabled = busy || !connectionReady;
  $('#run').disabled = busy || (isModel && (!connectionReady || !$('#model').value));
  $('#run').textContent = busy ? 'Running…' : !isModel ? 'Run the demo' : connectionReady ? 'Run comparison' : 'Connect a model to run';
  $('#mode-notice').textContent = isModel
    ? 'Model experiment. Every trial sends a fresh input to your Ollama connection.'
    : 'Demo only. A simple rule-based program makes the decisions here. These scores are not AI model results.';
  $('#try-demo').disabled = busy;
}
async function refreshModels() {
  if (busy) return;
  const previous = $('#model').value;
  connectionReady = false; models = []; syncControls();
  $('#refresh-models').disabled = true;
  $('#connection-dot').dataset.state = 'checking';
  $('#connection').textContent = 'Looking for Ollama…';
  try {
    models = await client.listModels();
    connectionReady = models.length > 0;
    $('#connection').textContent = connectionReady
      ? `Connected. ${models.length} model${models.length === 1 ? '' : 's'} available.`
      : 'Ollama is running, but no models are installed. Download a model in Ollama, then reconnect.';
    $('#connection-dot').dataset.state = connectionReady ? 'ready' : 'error';
    if (!connectionReady) $('#setup').open = true;
  } catch(error) {
    $('#connection').textContent = error.message;
    $('#connection-dot').dataset.state = 'error';
    $('#setup').open = true;
  }
  $('#model').replaceChildren();
  if (!models.length) $('#model').add(new Option('No model connected', ''));
  for (const model of models) $('#model').add(new Option(model.name, model.name));
  if (models.some(model => model.name === previous)) $('#model').value = previous;
  $('#refresh-models').disabled = false;
  $('#refresh-models').textContent = connectionReady ? 'Refresh connection' : 'Connect Ollama';
  syncControls();
}
$('#refresh-models').addEventListener('click', refreshModels);
$('#model').addEventListener('change', syncControls);
$('#engine').addEventListener('change', syncControls);
$('#setup-link').addEventListener('click', () => { $('#setup').open = true; });
$('#try-demo').addEventListener('click', () => {
  $('#engine').value = 'reference'; syncControls(); $('#run-form').requestSubmit();
});
const origin = location.origin;
$('#allowed-origin').textContent = origin;
$('#origin-command').textContent = `launchctl setenv OLLAMA_ORIGINS "${origin}"`;
$('#hosted-setup').hidden = local;
if (local) $('#connection-help').textContent = 'The local lab server connects to Ollama for you. No browser permission or origin command is needed.';
$('#copy-origin').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#origin-command').textContent); $('#copy-origin').textContent = 'Copied'; }
  catch { $('#copy-origin').textContent = 'Select the command above to copy it'; }
});
function renderSummary() {
  $('#completed').textContent=run.rows.length;
  $('#progress').value=run.rows.length;
  $('#elapsed').textContent=`${Math.round((Date.now()-run.started)/1000)}s`;
  const usage=run.rows.filter(r=>r.usage?.input_tokens!=null);
  $('#input-tokens').textContent=usage.length?usage.reduce((n,r)=>n+r.usage.input_tokens,0).toLocaleString():'—';
  $('#summary').replaceChildren();
  for(const [id,name] of POLICIES){
    const rows=run.rows.filter(r=>r.policy===id), eligible=rows.filter(r=>!r.skipped), evaluated=eligible.filter(r=>!r.error);
    const rate=eligible.length?`${Math.round(100*eligible.filter(r=>r.success).length/eligible.length)}% (${eligible.filter(r=>r.success).length}/${eligible.length})`:'—';
    const coverage=evaluated.length?`${Math.round(100*evaluated.reduce((n,r)=>n+r.coverage,0)/evaluated.length)}%`:'—';
    const tr=document.createElement('tr');
    for(const value of [name,rate,coverage,String(evaluated.filter(r=>r.wrongScopeCompatible).length),`${rows.filter(r=>r.skipped).length} / ${rows.filter(r=>r.error).length}`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    $('#summary').append(tr);
  }
  $('#export').disabled=!run.rows.length;
}
function finishSummary() {
  if(run.config.engine==='reference') {$('#interpretation').textContent='These are reference-solver checks, not findings about a language model. Missing-block failures show why evidence coverage needs its own measurement. Next: connect Ollama, run the same packets, and inspect where model behavior differs.';return;}
  if(run.state!=='completed') {$('#interpretation').textContent='This run is incomplete. Inspect the saved errors or stopped trials before comparing policies; a partial run is not balanced.';return;}
  const errors=run.rows.filter(r=>r.error).length;
  const missed=run.rows.filter(r=>!r.success&&!r.skipped&&!r.error&&r.coverage<1).length;
  const scope=run.rows.filter(r=>r.wrongScopeCompatible&&r.coverage===1).length;
  const oracle=run.rows.filter(r=>r.policy==='oracle'&&!r.skipped&&!r.error&&!r.success).length;
  $('#interpretation').textContent=errors?`${errors} provider errors occurred. Resolve those before comparing success rates.`:oracle?`${oracle} oracle trial(s) failed despite complete annotated evidence. Inspect outputs, task validity, and decision complexity before optimizing selection.`:scope?`${scope} complete-evidence trial(s) matched the other task’s action. Next test: identical evidence grouped versus interleaved by scope.`:missed?`${missed} failed trial(s) omitted annotated evidence. Next test: restore that evidence at matched input length before attributing the failure to reasoning.`:'No clear failure mechanism emerged in this pilot. Inspect task difficulty, use more held-out packets, and test uncertainty before choosing a winning policy.';
}
$('#run-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy || !$('#run-form').reportValidity())return;
  const engine=$('#engine').value;
  if(engine==='ollama'&&(!connectionReady||!$('#model').value)){ $('#status').textContent='Connect local Ollama and select an installed model before running.';$('#setup').open=true;return; }
  const config={engine,model:engine==='ollama'?$('#model').value:'deterministic-reference',transport:engine==='ollama'?client.transport:'reference',seed:Number($('#seed').value),pairs:Number($('#pairs').value),cap:Number($('#cap').value),repeats:Number($('#repeats').value),budgetUnit:'source blocks',temperature:0,maxOutputTokens:512};
  const tasks=generateCases(config.seed,config.pairs), schedule=[];
  for(let repetition=0;repetition<config.repeats;repetition++) for(const task of tasks) for(const [policy] of POLICIES) schedule.push({task,policy,repetition});
  const ordered=shuffled(schedule,rng(config.seed^0x53ac));
  run={version:VERSION,started:Date.now(),state:'running',config,rows:[],total:ordered.length};
  busy=true;controller=new AbortController();
  $('#run-kind').textContent=engine==='reference'?'Demo · not model results':`Ollama · ${config.model}`;
  $('#run-title').textContent='Waiting for the first answer…';
  $('#status').textContent=engine==='reference'?'Running the demo…':'Ollama may need a moment to load your model. You can stop at any time.';
  $('#progress').value=0; $('#completed').textContent='0'; $('#input-tokens').textContent='—'; $('#elapsed').textContent='0s';
  $('#export').disabled=true; $('#summary').replaceChildren();
  const clock=setInterval(()=>{ $('#elapsed').textContent=`${Math.round((Date.now()-run.started)/1000)}s`; },1000);
  $('#trial').replaceChildren();$('#trial-output').textContent='Select a completed trial to inspect it.';
  $('#interpretation').textContent='Wait until the run completes before interpreting policy differences.';
  for(const element of $('#run-form').elements)element.disabled=true;$('#stop').disabled=false;$('#refresh-models').disabled=true;syncControls();
  try {
    for(const {task,policy,repetition} of ordered){
      if(controller.signal.aborted)break;
      const selection=selectContext(task,policy,config.cap),messages=messagesFor(task,selection.blocks);
      const start=performance.now();let row={taskId:task.id,pair:task.pair,target:task.target,policy,repetition,blockIds:selection.blocks.map(b=>b.id),messages,expected:task.expected};
      if(!selection.feasible)row={...row,skipped:true,reason:'Minimal sufficient evidence exceeds block budget.'};
      else {
        try {
          let output,usage=null,model=config.model,modelDigest=null,settings=null,doneReason=null;
          if(engine==='reference'){await new Promise(resolve=>setTimeout(resolve,25));if(controller.signal.aborted)break;output=JSON.stringify(referenceAction(task,selection.blocks));}
          else {
            const data=await client.trial(config.model,messages,controller.signal);
            ({output,usage,model,modelDigest,settings,doneReason}=data);
          }
          const truncated=doneReason==='length';
          const action=truncated?null:parseAction(output);
          row={...row,output,action,usage,model,modelDigest,settings,doneReason,truncated,...grade(task,selection.blocks,action)};
          if(truncated)row.diagnosis='output limit reached';
        } catch(error) {
          if(controller.signal.aborted)break;
          row={...row,error:error.message,success:false,diagnosis:'provider error'};
          // Preserve the failed trial, then stop. Never silently retry or mask outages.
        }
      }
      row.latencyMs=Math.round(performance.now()-start);run.rows.push(row);
      $('#trial').add(new Option(`${task.id} · ${POLICIES.find(p=>p[0]===policy)[1]} · ${row.skipped?'skipped':row.diagnosis}`,String(run.rows.length-1)));
      $('#run-title').textContent='Comparing the answers';
      $('#status').textContent=`${run.rows.length} of ${run.total} trials finished.`;renderSummary();
      if(row.error){run.state='error';$('#status').textContent=`Run stopped: ${row.error}`;break;}
    }
    if(run.state!=='error')run.state=controller.signal.aborted?'stopped':'completed';
  } finally {
    clearInterval(clock);busy=false;run.finished=Date.now();
    $('#run-title').textContent=run.state==='completed'?'Comparison complete':run.state==='stopped'?'Run stopped':'Connection needs attention';
    if(run.state==='completed')$('#status').textContent=`Completed ${run.rows.length} trials. Export results to keep them; this page does not save them automatically.`;
    if(run.state==='stopped')$('#status').textContent=`Stopped after ${run.rows.length} completed trials. Partial results can be exported.`;
    for(const element of $('#run-form').elements)element.disabled=false;$('#stop').disabled=true;$('#model').disabled=!connectionReady;$('#refresh-models').disabled=false;syncControls();
    renderSummary();finishSummary();if(run.rows.length)$('#trial-output').textContent=JSON.stringify(run.rows[0],null,2);
  }
});
$('#stop').addEventListener('click',()=>controller?.abort());
$('#trial').addEventListener('change',()=>{$('#trial-output').textContent=JSON.stringify(run.rows[Number($('#trial').value)],null,2);});
$('#export').addEventListener('click',()=>{
  if(!run)return;const blob=new Blob([JSON.stringify(run,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`context-${run.config.engine}-${run.config.seed}-${run.started}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
updateSize();syncControls();
if(local)refreshModels();
