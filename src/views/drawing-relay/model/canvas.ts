import type { Drawing, Stroke } from '../../../shared/lib/drawing-relay';
export function normalisePoint(x: number, y: number, rect: {left:number;top:number;width:number;height:number}): [number,number] {
  const clamp = (n:number) => Math.round(Math.max(0,Math.min(1,n))*1000)/1000;
  return [clamp((x-rect.left)/rect.width),clamp((y-rect.top)/rect.height)];
}
export function extendDrawing(value: Drawing, stroke: Stroke, newStroke: boolean): Drawing | null {
  const strokes = newStroke ? [...value.strokes,stroke] : value.strokes.map((s,i)=>i===value.strokes.length-1?{...s,points:[...s.points,...stroke.points]}:s);
  if(strokes.length>120 || strokes.reduce((n,s)=>n+s.points.length,0)>2000 || new TextEncoder().encode(JSON.stringify({strokes})).length>48*1024)return null;
  return {strokes};
}
export function renderDrawing(ctx: CanvasRenderingContext2D, value: Drawing, size: number) {
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);
  for(const stroke of value.strokes){
    const color=stroke.tool==='eraser'?'#ffffff':stroke.color;
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=stroke.width*size;ctx.lineCap='round';ctx.lineJoin='round';
    if(stroke.points.length===1){ctx.beginPath();ctx.arc(stroke.points[0][0]*size,stroke.points[0][1]*size,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
    else {ctx.beginPath();stroke.points.forEach(([x,y],i)=>i===0?ctx.moveTo(x*size,y*size):ctx.lineTo(x*size,y*size));ctx.stroke();}
  }
}
