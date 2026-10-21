import {test} from 'node:test';import assert from 'node:assert/strict';
import {safeRead,safeWrite,safeRemove} from '../src/shared/lib/browser-storage.ts';
test('shared panel storage operations remain optional in private browsing',()=>{
 globalThis.window={get localStorage(){throw Error('SecurityError')}};
 assert.equal(safeRead('room-lock'),null);assert.equal(safeWrite('room-lock','x'),false);assert.doesNotThrow(()=>safeRemove('room-lock'));
});
