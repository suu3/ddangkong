import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
registerHooks({
 resolve(specifier,context,next) {
  if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',shortCircuit:true};
  if(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier))specifier+='.ts';
  return next(specifier,context);
 },
 load(url,context,next) {
  if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'transform'}),shortCircuit:true};
  return next(url,context);
 }
});
const {RoomDurableObject}=await import('../workers/realtime/src/index.ts');
const {createRelay,applyRelayCommand}=await import('../src/shared/lib/drawing-relay.ts');
class Storage {
 data=new Map();alarm=null;
 async get(k){return this.data.get(k)}
 async put(k,v){if(typeof k==='string')this.data.set(k,structuredClone(v));else for(const [key,val] of Object.entries(k))this.data.set(key,structuredClone(val));}
 async list({prefix}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)))}
 async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])this.data.delete(k)}
 async deleteAll(){this.data.clear()}
 async setAlarm(n){this.alarm=n}
}
function harness(){
 const storage=new Storage();const sockets=[];
 const ctx={storage,getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn()};
 return {storage,sockets,do:new RoomDurableObject(ctx,{})};
}
const socket=actor=>({readyState:1,events:[],attachment:{session:{actorId:actor,role:actor==='anon-player0000'?'host':'member'},presence:{cardIndex:null},connectedAt:Date.now()},deserializeAttachment(){return this.attachment},serializeAttachment(a){this.attachment=a},send(s){this.events.push(JSON.parse(s))},close(){this.readyState=3}});
async function setup(){
 const h=harness();const ids=Array.from({length:4},(_,i)=>`anon-player000${i}`);let s=createRelay(ids[0],Date.now());
 for(const id of ids){s=applyRelayCommand(s,id,{kind:'join',nickname:id},Date.now());s=applyRelayCommand(s,id,{kind:'ready',ready:true},Date.now());}
 s=applyRelayCommand(s,ids[0],{kind:'start'},Date.now());
 await h.storage.put('room',{id:crypto.randomUUID(),gameType:'drawing_relay',name:'방',maxCapacity:10,state:s,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),hostActorId:ids[0]});
 h.sockets.push(...ids.map(socket));return h;
}
let n=0;
async function send(h,i,action,revision=0){await h.do.webSocketMessage(h.sockets[i],JSON.stringify({v:1,type:'participant_command',requestId:`request-${n++}`,expectedRevision:revision,command:{kind:'drawing_relay.command',action}}));}
test('transport isolates draft replies, broadcasts personalised snapshots and accepts concurrent revision',async()=>{
 const h=await setup();let s=await h.storage.get('room');const id=s.state.gameId;
 await send(h,0,{kind:'draft',gameId:id,round:0,content:'SECRET-DRAFT'});
 assert.equal(h.sockets[0].events.at(-1).room.state.ownDraft,'SECRET-DRAFT');
 for(const ws of h.sockets.slice(1))assert.equal(JSON.stringify(ws.events).includes('SECRET-DRAFT'),false);
 const res=await h.do.fetch(new Request('https://internal/snapshot'));
 assert.equal(JSON.stringify(await res.json()).includes('SECRET-DRAFT'),false);
 for(let i=0;i<4;i++)await send(h,i,{kind:'submit',gameId:id,round:0,content:`SECRET-${i}`},0);
 const room=await h.storage.get('room');assert.equal(room.state.round,1);
 for(let i=0;i<4;i++){
  const state=h.sockets[i].events.at(-1).room.state;
  assert.equal(state.previousEntry.text,`SECRET-${(i+3)%4}`);
  assert.equal('chains' in state,false);assert.equal('drafts' in state,false);
 }
});
test('host cannot bypass gameplay with state_update; late join is denied',async()=>{
 const h=await setup();const room=await h.storage.get('room');
 await h.do.webSocketMessage(h.sockets[0],JSON.stringify({v:1,type:'state_update',requestId:'forge',expectedRevision:room.state.revision,state:{revision:room.state.revision,lastActor:null}}));
 assert.equal(h.sockets[0].events.at(-1).type,'error');
 const res=await h.do.fetch(new Request('https://internal/join',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));assert.equal(res.status,409);
});
test('deadline persisted and delivered without exposing all chains',async()=>{
 const h=await setup();const room=await h.storage.get('room');room.state.deadlineMs=Date.now()-1;await h.storage.put('room',room);
 await h.do.alarm();const next=await h.storage.get('room');assert.equal(next.state.round,1);
 assert.equal(next.state.chains[0][0].autoSubmitted,true);
 for(const ws of h.sockets)assert.equal('chains' in ws.events.at(-1).room.state,false);
});
