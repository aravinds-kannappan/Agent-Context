import { VERSION, POLICIES, generateCases, selectContext, messagesFor, referenceAction, parseAction, grade, rng, shuffled } from './experiment-core.mjs';
const $ = selector => document.querySelector(selector);
let run = null, controller = null, busy = false, models = [], connectionReady = false;
function updateSize() {
  $('#cap-label').textContent = `${$('#cap').value} source blocks`;
  const size = Number($('#pairs').value) * 2 * POLICIES.length * Number($('#repeats').value);
  $('#run-size').textContent = `${size} trials · six policies`;
  $('#progress').max = size;
}
for(const id of ['#pairs','#repeats','#cap']) $(id).addEventListener('input',updateSize);
async function refreshModels() {
  connectionReady = false; models = [];
  $('#connection').textContent='Checking the local lab server…';
  try {
    const response=await fetch('/api/config',{signal:AbortSignal.timeout(5000)});
    if(!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Local server not available.');
    const data=await response.json();models=data.models||[];connectionReady=!!data.ready;
    $('#connection').textContent=data.message;
  } catch { $('#connection').textContent='Real trials need the local lab server. See “Connect local Ollama” below.'; }
  $('#model').replaceChildren();
  if(!models.length) $('#model').add(new Option('No installed model connected',''));
  for(const model of models) $('#model').add(new Option(model.name,model.name));
  $('#model').disabled=!connectionReady;
}
$('#refresh-models').addEventListener('click',refreshModels);
$('#engine').addEventListener('change',()=>{
  const local=$('#engine').value==='ollama';$('#model-settings').hidden=!local;
  $('#mode-notice').textContent=local?'Real model mode uses your local Ollama installation. Each trial makes one fresh model call; no conversation history is carried forward.':'Test mode uses a deterministic reference solver. Its scores validate the setup; they are not AI model performance.';
  if(local){refreshModels();$('#setup').open=true;}
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
  const config={engine,model:engine==='ollama'?$('#model').value:'deterministic-reference',seed:Number($('#seed').value),pairs:Number($('#pairs').value),cap:Number($('#cap').value),repeats:Number($('#repeats').value),budgetUnit:'source blocks',temperature:0,maxOutputTokens:512};
  const tasks=generateCases(config.seed,config.pairs), schedule=[];
  for(let repetition=0;repetition<config.repeats;repetition++) for(const task of tasks) for(const [policy] of POLICIES) schedule.push({task,policy,repetition});
  const ordered=shuffled(schedule,rng(config.seed^0x53ac));
  run={version:VERSION,started:Date.now(),state:'running',config,rows:[],total:ordered.length};
  busy=true;controller=new AbortController();
  $('#run-kind').textContent=engine==='reference'?'REFERENCE SOLVER · NOT MODEL RESULTS':'LOCAL OLLAMA · MODEL TRIALS';
  $('#run-title').textContent='Comparison in progress';
  $('#trial').replaceChildren();$('#trial-output').textContent='Select a completed trial to inspect it.';
  $('#interpretation').textContent='Wait until the run completes before interpreting policy differences.';
  for(const element of $('#run-form').elements)element.disabled=true;$('#stop').disabled=false;$('#refresh-models').disabled=true;
  try {
    for(const {task,policy,repetition} of ordered){
      if(controller.signal.aborted)break;
      const selection=selectContext(task,policy,config.cap),messages=messagesFor(task,selection.blocks);
      const start=performance.now();let row={taskId:task.id,pair:task.pair,target:task.target,policy,repetition,blockIds:selection.blocks.map(b=>b.id),messages,expected:task.expected};
      if(!selection.feasible)row={...row,skipped:true,reason:'Minimal sufficient evidence exceeds block budget.'};
      else {
        try {
          let output,usage=null,model=config.model;
          if(engine==='reference'){await new Promise(resolve=>setTimeout(resolve,25));if(controller.signal.aborted)break;output=JSON.stringify(referenceAction(task,selection.blocks));}
          else {
            const response=await fetch('/api/trial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages}),signal:controller.signal});
            const data=await response.json();if(!response.ok)throw new Error(data.error||'Model request failed.');output=data.output;usage=data.usage;model=data.model;
          }
          const action=parseAction(output);row={...row,output,action,usage,model,...grade(task,selection.blocks,action)};
        } catch(error) {
          if(controller.signal.aborted)break;
          row={...row,error:error.message,success:false,diagnosis:'provider error'};
          // Preserve the failed trial, then stop. Never silently retry or mask outages.
        }
      }
      row.latencyMs=Math.round(performance.now()-start);run.rows.push(row);
      $('#trial').add(new Option(`${task.id} · ${POLICIES.find(p=>p[0]===policy)[1]} · ${row.skipped?'skipped':row.diagnosis}`,String(run.rows.length-1)));
      $('#status').textContent=`${run.rows.length} of ${run.total} trials completed.`;renderSummary();
      if(row.error){run.state='error';$('#status').textContent=`Run stopped: ${row.error}`;break;}
    }
    if(run.state!=='error')run.state=controller.signal.aborted?'stopped':'completed';
  } finally {
    busy=false;run.finished=Date.now();
    $('#run-title').textContent=run.state==='completed'?'Comparison complete':run.state==='stopped'?'Run stopped':'Connection needs attention';
    if(run.state==='completed')$('#status').textContent=`Completed ${run.rows.length} trials. Export results to keep them; this page does not save them automatically.`;
    if(run.state==='stopped')$('#status').textContent=`Stopped after ${run.rows.length} completed trials. Partial results can be exported.`;
    for(const element of $('#run-form').elements)element.disabled=false;$('#stop').disabled=true;$('#model').disabled=!connectionReady;$('#refresh-models').disabled=false;
    renderSummary();finishSummary();if(run.rows.length)$('#trial-output').textContent=JSON.stringify(run.rows[0],null,2);
  }
});
$('#stop').addEventListener('click',()=>controller?.abort());
$('#trial').addEventListener('change',()=>{$('#trial-output').textContent=JSON.stringify(run.rows[Number($('#trial').value)],null,2);});
$('#export').addEventListener('click',()=>{
  if(!run)return;const blob=new Blob([JSON.stringify(run,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`context-${run.config.engine}-${run.config.seed}-${run.started}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
updateSize();
