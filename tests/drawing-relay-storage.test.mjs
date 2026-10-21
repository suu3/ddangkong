import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {readFileSync} from 'node:fs';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/.test(s))s+='.ts';return next(s,c)},load(url,c,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,c)}});
const {createRoom}=await import('../src/entities/room/api/rooms.ts');
const {readSession}=await import('../src/entities/room/api/session.ts');
test('room creation survives blocked storage while server still receives creation request',async()=>{
 globalThis.window={localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}};
 process.env.NEXT_PUBLIC_REALTIME_API_URL='http://localhost:8787';let requests=0;
 globalThis.fetch=async(url,options)=>{
  requests++;assert.equal(new URL(url).pathname,'/rooms');
  const b=JSON.parse(options.body);assert.match(b.actorId,/^anon-/);
  return Response.json({room:{id:'storage-room',gameType:'drawing_relay',name:'방',maxCapacity:10,state:{revision:0,lastActor:null},createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()},token:'a'.repeat(64),actorId:b.actorId,role:'host'});
 };
 const room=await createRoom('drawing_relay',{revision:0,lastActor:null});
 assert.equal(room.id,'storage-room');assert.equal(requests,1);assert.equal(readSession(room.id).role,'host');
});
