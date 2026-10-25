export const VERSION = '0.2.0';
export const POLICIES = [
  ['full', 'Full · flat'], ['grouped', 'Full · grouped'], ['recent', 'Limited · recent'],
  ['lexical', 'Limited · lexical'], ['scoped', 'Limited · scoped'], ['oracle', 'Oracle · diagnostic'],
];
export function rng(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function generateCases(seed = 42, pairs = 6) {
  if (!Number.isInteger(pairs) || pairs < 1 || pairs > 30) throw new Error('Choose 1–30 packet pairs.');
  const random = rng(seed), cases = [];
  for (let pair = 0; pair < pairs; pair++) {
    const suffix = Math.floor(random() * 9000 + 1000);
    const teams = [`River-${suffix}`, `Summit-${suffix}`];
    const people = 10 + Math.floor(random() * 6), small = 3 + Math.floor(random() * 3);
    const price = 65 + Math.floor(random() * 20), cheap = 20 + Math.floor(random() * 10);
    const rooms = shuffled([
      { room_id: `room-${suffix}-a`, capacity: people + 1, price, video: false, available: true },
      { room_id: `room-${suffix}-b`, capacity: small + 1, price: cheap, video: true, available: pair % 5 !== 4 },
    ], random);
    const requirements = [{ people, budget: price + 5, video: false }, { people: small, budget: cheap + 3, video: true }];
    const blocks = [
      ...teams.map((scope, i) => ({ id: `req-${i}`, scope, type: 'requirements', data: requirements[i], text: `${scope} needs capacity for ${requirements[i].people} people, price at most ${requirements[i].budget}, and ${requirements[i].video ? 'requires working video' : 'does not require video'}.` })),
      { id: 'rule', scope: 'shared', type: 'rule', text: 'Book exactly one available room satisfying every applicable requirement. If several qualify, choose the lowest price. If none qualify, return room_id null.' },
      ...rooms.map((data, i) => ({ id: `option-${i}`, scope: 'shared', type: 'room', data, text: `${data.room_id}: capacity ${data.capacity}; price ${data.price}; video ${data.video ? 'yes' : 'no'}; available ${data.available ? 'yes' : 'no'}.` })),
      { id: 'noise-1', scope: 'Studio', type: 'other', text: 'Studio requires room video and capacity for 30 people; its room budget is 200.' },
      { id: 'noise-2', scope: 'Studio', type: 'other', text: 'Studio always chooses the most expensive room that fits its team requirements.' },
      { id: 'noise-3', scope: 'Archive', type: 'other', text: 'Archive team room bookings require capacity for 2 people and a room price below 10.' },
    ];
    const packet = shuffled(blocks, random);
    teams.forEach((target, i) => {
      const gold = eligibleRoom(rooms, requirements[i]);
      cases.push({ id: `pair-${pair + 1}-${i}`, pair: pair + 1, target, otherTarget: teams[1 - i], blocks: packet, requiredIds: [`req-${i}`, 'rule', 'option-0', 'option-1'], expected: gold, requirements: requirements[i], otherRequirements: requirements[1 - i], rooms });
    });
  }
  return cases;
}
function eligibleRoom(rooms, r) {
  return rooms.filter(room => room.available && room.capacity >= r.people && room.price <= r.budget && (!r.video || room.video)).sort((a,b) => a.price - b.price || a.room_id.localeCompare(b.room_id))[0]?.room_id ?? null;
}
const words = text => text.toLowerCase().match(/[a-z0-9]+/g) || [];
// BM25: lexical query scoring with deterministic source-order tie breaking.
export function rankBlocks(blocks, query) {
  const docs = blocks.map(b => words(`${b.scope} ${b.text}`));
  const avg = docs.reduce((n,d) => n + d.length, 0) / docs.length || 1;
  const terms = [...new Set(words(query))], k1 = 1.2, b = 0.75;
  return blocks.map((block,i) => ({block,i,score:terms.reduce((sum,term) => {
    const tf = docs[i].filter(w=>w===term).length;
    const df = docs.filter(d=>d.includes(term)).length;
    return sum + Math.log(1+(docs.length-df+0.5)/(df+0.5))*(tf*(k1+1))/(tf+k1*(1-b+b*docs[i].length/avg));
  },0)})).sort((a,b)=>b.score-a.score || a.i-b.i).map(x=>x.block);
}
export function selectContext(task, policy, cap = 4) {
  if (!POLICIES.some(p=>p[0]===policy) || !Number.isInteger(cap) || cap < 1 || cap > 8) throw new Error('Invalid policy or block budget.');
  if (policy === 'full') return {blocks:[...task.blocks], feasible:true};
  if (policy === 'grouped') return {blocks:[...task.blocks].sort((a,b)=>a.scope.localeCompare(b.scope)), feasible:true};
  if (policy === 'recent') return {blocks:task.blocks.slice(-cap), feasible:true};
  if (policy === 'oracle') {
    const blocks=task.blocks.filter(b=>task.requiredIds.includes(b.id));
    return {blocks:blocks.length<=cap?blocks:[],feasible:blocks.length<=cap};
  }
  const candidates = policy === 'scoped' ? task.blocks.filter(b=>b.scope===task.target || b.scope==='shared') : task.blocks;
  return {blocks:rankBlocks(candidates,`Book a room for ${task.target}. Requirements capacity budget video available price.`).slice(0,cap),feasible:true};
}
export function messagesFor(task, blocks) {
  return [
    { role:'system', content:'Choose an action using only the supplied source context. Scope labels identify which team each block applies to. Return exactly one JSON object: {"room_id":"a supplied room ID"} or {"room_id":null}. Do not invent facts. When essential information is missing, return {"abstain":true}. Do not give explanations.' },
    { role:'user', content:`Current task: book a room for ${task.target}.\n\nSOURCE CONTEXT\n${blocks.map(b=>`[${b.id} | scope=${b.scope}]\n${b.text}`).join('\n\n')}` },
  ];
}
export function referenceAction(task, blocks) {
  // A deterministic parser of visible structured blocks, not an LLM prediction.
  const r=blocks.find(b=>b.scope===task.target && b.type==='requirements');
  if(!r || !blocks.some(b=>b.type==='rule') || blocks.filter(b=>b.type==='room').length<2) return {abstain:true};
  return {room_id:eligibleRoom(blocks.filter(b=>b.type==='room').map(b=>b.data),r.data)};
}
export function parseAction(text) {
  try {
    const value=JSON.parse(text.trim());
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.abstain===true && !('room_id' in value)) return {abstain:true};
    if (Object.keys(value).length===1 && 'room_id' in value && (value.room_id===null || typeof value.room_id==='string')) return {room_id:value.room_id};
  } catch {}
  return null;
}
export function grade(task, blocks, action) {
  const coverage=task.requiredIds.filter(id=>blocks.some(b=>b.id===id)).length/task.requiredIds.length;
  const success=!!action && !action.abstain && action.room_id===task.expected;
  const other=eligibleRoom(task.rooms,task.otherRequirements);
  const wrongScopeCompatible=!!action && !action.abstain && !success && action.room_id===other;
  const diagnosis=success?'success':!action?'invalid output':coverage<1?'missing evidence':wrongScopeCompatible?'wrong-scope compatible':'decision error';
  return {success,coverage,wrongScopeCompatible,diagnosis};
}
