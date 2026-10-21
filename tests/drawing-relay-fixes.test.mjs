import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSession,saveSession} from '../src/entities/room/api/session.ts';
import {shouldFlushDraft,wrapTextLines,textBlockHeight} from '../src/views/drawing-relay/model/presentation.ts';
test('blocked local storage retains room session in memory',()=>{
 globalThis.window={localStorage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}};
 const session={token:'a'.repeat(64),actorId:'anon-player0000',role:'host'};
 assert.doesNotThrow(()=>saveSession('storage-blocked',session));
 assert.deepEqual(readSession('storage-blocked'),session);
});
test('last edits are flushed immediately inside final autosave interval',()=>{
 assert.equal(shouldFlushDraft(10000,9400),true);
 assert.equal(shouldFlushDraft(10000,9900),true);
 assert.equal(shouldFlushDraft(10000,7000),false);
 assert.equal(shouldFlushDraft(10000,10000),false);
});
test('image text reserves height for newlines and measured wrapping',()=>{
 const measure=s=>s.length*10;
 assert.deepEqual(wrapTextLines('abc\ndef',30,measure),['abc','def']);
 const lines=wrapTextLines('a\n'.repeat(50),650,measure);
 assert.equal(lines.length,51);assert.ok(textBlockHeight(lines.length)>1500);
 assert.deepEqual(wrapTextLines('abcdefg',30,measure),['abc','def','g']);
});
