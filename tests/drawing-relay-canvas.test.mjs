import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalisePoint, extendDrawing, renderDrawing} from '../src/views/drawing-relay/model/canvas.ts';
test('normalised touch positions survive resize and clamp at boundaries',()=>{
 assert.deepEqual(normalisePoint(60,70,{left:10,top:20,width:100,height:100}),[0.5,0.5]);
 assert.deepEqual(normalisePoint(110,120,{left:10,top:20,width:200,height:200}),[0.5,0.5]);
 assert.deepEqual(normalisePoint(-5,1000,{left:0,top:0,width:100,height:100}),[0,1]);
});
test('drawing limits preserve prior work and undo is by whole stroke',()=>{
 const stroke={tool:'pen',color:'#3d3131',width:0.012,points:[[0,0]]};
 assert.equal(extendDrawing({strokes:Array(120).fill(stroke)},stroke,true),null);
 const d=extendDrawing({strokes:[]},stroke,true);assert.equal(d.strokes.length,1);
 const moved=extendDrawing(d,{...stroke,points:[[0.5,0.5]]},false);assert.equal(moved.strokes[0].points.length,2);
 assert.equal(d.strokes[0].points.length,1);
});
test('renderer paints a dot and erases with the paper colour',()=>{
 const calls=[];const ctx=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:(_,key,value)=>{calls.push([key,value]);return true}});
 renderDrawing(ctx,{strokes:[{tool:'eraser',color:'#3d3131',width:0.012,points:[[0.5,0.5]]}]},640);
 assert.ok(calls.some(([key,value])=>key==='fillStyle'&&value==='#ffffff'));
 assert.ok(calls.some(([key,x])=>key==='arc'&&x===320));
});
