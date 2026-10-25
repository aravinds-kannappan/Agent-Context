import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCases,selectContext,messagesFor,referenceAction,parseAction,grade,POLICIES} from '../dist/experiment-core.mjs';

test('paired cases share source packets and have different target requirements',()=>{
  const cases=generateCases(42,6);
  assert.deepEqual(cases,generateCases(42,6));
  assert.notDeepEqual(cases,generateCases(43,6));
  assert.equal(cases.length,12);
  for(let i=0;i<cases.length;i+=2){assert.deepEqual(cases[i].blocks,cases[i+1].blocks);assert.notEqual(cases[i].target,cases[i+1].target);assert.notEqual(cases[i].expected,cases[i+1].expected);}
});
test('full and grouped retain identical evidence; bounded policies respect caps',()=>{
  for(const task of generateCases(7,10)) for(let cap=1;cap<=8;cap++){
    const full=selectContext(task,'full',cap).blocks;
    const grouped=selectContext(task,'grouped',cap).blocks;
    assert.deepEqual([...full].sort((a,b)=>a.id.localeCompare(b.id)),[...grouped].sort((a,b)=>a.id.localeCompare(b.id)));
    for(const [policy] of POLICIES.filter(p=>!['full','grouped'].includes(p[0])))assert.ok(selectContext(task,policy,cap).blocks.length<=cap);
    assert.equal(selectContext(task,'oracle',cap).feasible,cap>=4);
  }
});
test('oracle and scoped inputs are sufficient at four blocks; no gold leaks into prompts',()=>{
  for(const task of generateCases(14,30)){
    for(const policy of ['full','grouped','scoped','oracle']){
      const {blocks}=selectContext(task,policy,4),action=referenceAction(task,blocks);
      assert.equal(grade(task,blocks,action).success,true);
      assert.equal(grade(task,blocks,action).coverage,1);
      const messages=messagesFor(task,blocks);
      assert.equal(messages.length,2);
      assert.ok(!messages[1].content.includes('expected'));
      assert.ok(!messages[1].content.includes('requiredIds'));
    }
    const missing=task.blocks.filter(b=>b.id!==task.requiredIds[0]);
    assert.deepEqual(referenceAction(task,missing),{abstain:true});
    assert.equal(grade(task,missing,{abstain:true}).diagnosis,'missing evidence');
  }
});
test('grader separates malformed actions, wrong-scope patterns and successful infeasibility',()=>{
  const tasks=generateCases(42,6),task=tasks[0],other=tasks[1];
  assert.equal(grade(task,task.blocks,{room_id:other.expected}).wrongScopeCompatible,true);
  for(const value of ['null','[]','{"room_id":4}','answer: room-a','{"room_id":"a","extra":1}'])assert.equal(parseAction(value),null);
  assert.deepEqual(parseAction('{"room_id":null}'),{room_id:null});
  assert.deepEqual(parseAction('{"abstain":true}'),{abstain:true});
  assert.equal(grade(task,task.blocks,null).diagnosis,'invalid output');
  const infeasible=tasks.find(t=>t.expected===null);
  assert.ok(infeasible);assert.equal(grade(infeasible,infeasible.blocks,{room_id:null}).success,true);
  assert.throws(()=>generateCases(1,31));assert.throws(()=>selectContext(task,'fake',4));
});
