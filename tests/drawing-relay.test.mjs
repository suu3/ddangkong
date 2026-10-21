import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignedActor, entryKind, roundDurationMs, validateDrawing, createRelay, applyRelayCommand, advanceRelayDeadline, projectRelay } from '../src/shared/lib/drawing-relay.ts';
const ids = Array.from({length: 10}, (_,i)=>`anon-player000${i}`);
const command = (s, actor, action, now=1000) => applyRelayCommand(s, actor, action, now);
function lobby(n=4) {
 let s=createRelay(ids[0], 0);
 for(let i=0;i<n;i++) {
  s=command(s,ids[i],{kind:'join',nickname:`참가자${i}`});
  s=command(s,ids[i],{kind:'ready',ready:true});
 }
 return s;
}
const start=n=>command(lobby(n),ids[0],{kind:'start'});
for(const n of [4,5,10]) test(`${n} players contribute exactly once per chain`,()=>{
 const order=ids.slice(0,n);
 for(let c=0;c<n;c++) assert.equal(new Set(order.map((_,r)=>assignedActor(order,c,r))).size,n);
 let s=start(n);
 for(let r=0;r<n;r++) {
  assert.equal(entryKind(r), r%2?'drawing':'text');
  assert.equal(roundDurationMs(r),r%2?60000:30000);
  for(const actor of order) s=command(s,actor,{kind:'submit',gameId:s.gameId,round:r,content:r%2?{strokes:[]}:`비밀-${actor}-${r}`});
 }
 assert.equal(s.phase,'reveal');
 for(const chain of s.chains) assert.equal(new Set(chain.map(e=>e.authorId)).size,n);
 assert.equal(JSON.stringify(projectRelay(s,ids[0],1000)).includes('비밀-'),false);
 for(let i=0;i<n*n;i++)s=command(s,ids[0],{kind:'reveal-next'});
 assert.equal(s.phase,'complete');
 assert.equal(projectRelay(s,ids[1],1000).revealedChains.flat().length,n*n);
 s=command(s,ids[0],{kind:'reset'});
 assert.equal(s.phase,'lobby');assert.equal(s.chains.length,0);assert.equal(s.players.some(p=>p.ready),false);
});
test('private drafts, previous-only projection and duplicate submissions',()=>{
 let s=start(4);const id=s.gameId;
 s=command(s,ids[0],{kind:'draft',gameId:id,round:0,content:'秘密草稿'});
 for(const actor of [null,ids[1],ids[2]]) assert.equal(JSON.stringify(projectRelay(s,actor,1000)).includes('秘密'),false);
 assert.equal(projectRelay(s,ids[0],1000).ownDraft,'秘密草稿');
 s=command(s,ids[0],{kind:'submit',gameId:id,round:0,content:'最初の秘密'});
 s=command(s,ids[0],{kind:'submit',gameId:id,round:0,content:'rewrite'});
 assert.equal(s.chains[0][0].text,'最初の秘密');
 for(const actor of ids.slice(1,4))s=command(s,actor,{kind:'submit',gameId:id,round:0,content:actor});
 assert.equal(projectRelay(s,ids[1],1000).previousEntry.text,'最初の秘密');
 assert.equal(JSON.stringify(projectRelay(s,ids[0],1000)).includes('最初の秘密'),false);
 assert.throws(()=>command(s,ids[0],{kind:'submit',gameId:id,round:0,content:'old'}),/STALE_TURN/);
});
test('server timeout saves draft once and grants next turn full duration',()=>{
 let s=start(4);s=command(s,ids[0],{kind:'draft',gameId:s.gameId,round:0,content:'saved'});
 const deadline=s.deadlineMs;s=advanceRelayDeadline(s,deadline+5000);
 assert.equal(s.chains[0][0].text,'saved');assert.equal(s.chains[0][0].autoSubmitted,true);
 assert.equal(s.deadlineMs,deadline+5000+60000);
 assert.equal(advanceRelayDeadline(s,deadline+5000).round,1);
});
test('server rejects invalid membership, phase and host commands',()=>{
 assert.throws(()=>command(lobby(3),ids[0],{kind:'start'}),/NOT_READY/);
 let s=start(4);
 assert.throws(()=>command(s,ids[4],{kind:'join',nickname:'late'}),/GAME_STARTED/);
 for(const kind of ['start','reset','reveal-next'])assert.throws(()=>command(s,ids[1],{kind}),/HOST_PERMISSION/);
 assert.throws(()=>command(s,ids[4],{kind:'submit',gameId:s.gameId,round:0,content:'x'}),/NOT_A_PLAYER/);
 assert.throws(()=>command(s,ids[0],{kind:'submit',gameId:s.gameId,round:0,content:'a'.repeat(101)}),/INVALID_CONTENT/);
 assert.throws(()=>command(s,ids[0],{kind:'submit',gameId:s.gameId,round:0,content:'late'},s.deadlineMs),/TURN_EXPIRED/);
});
test('validates bounded drawing payloads and strips untrusted fields',()=>{
 const stroke={tool:'pen',color:'#3d3131',width:0.012,points:[[0,0],[1,1]]};
 assert.deepEqual(validateDrawing({strokes:[stroke],evil:'secret'}),{strokes:[stroke]});
 for(const input of [null,{url:'https://bad'}, {strokes:Array(121).fill(stroke)}, {strokes:[{...stroke,points:Array(2001).fill([0,0])}]}, {strokes:[{...stroke,color:'red'}]}, {strokes:[{...stroke,points:[[Infinity,0]]}]}, {strokes:[{...stroke,points:[[2,0]]}]}])assert.throws(()=>validateDrawing(input),/INVALID_DRAWING/);
});
