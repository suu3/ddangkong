'use client';
import {useEffect,useState} from 'react';
import MainButton from '@/components/button/MainButton';
import ResultMoment from '@/components/ResultMoment';
import type {RelayEntry,RelayPublicState} from '@/src/shared/lib/drawing-relay';
import {renderDrawing} from '../model/canvas';
import {wrapTextLines,textBlockHeight} from '../model/presentation';
import DrawingCanvas from './DrawingCanvas';
import styles from './drawing-relay.module.css';
export default function RelayResults({state,isHost,onRevealNext,onReset,busy}:{state:RelayPublicState;isHost:boolean;onRevealNext:()=>void;onReset:()=>void;busy:boolean}){
  const [image,setImage]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image);},[image]);
  const name=(actor:string)=>state.players.find(p=>p.actorId===actor)?.nickname??'참가자';
  async function save(chain:RelayEntry[],index:number){
    setMessage('');
    try{
      const sheet=document.createElement('canvas');sheet.width=720;
      const ctx=sheet.getContext('2d');if(!ctx)throw new Error('CANVAS');
      ctx.font='24px sans-serif';
      const blocks=chain.map(entry=>{
        const lines=entry.kind==='text'?wrapTextLines(entry.text||'전달된 문장이 없어요',650,text=>ctx.measureText(text).width):[];
        return {entry,lines,height:entry.kind==='drawing'?700:textBlockHeight(lines.length)};
      });
      sheet.height=100+blocks.reduce((sum,b)=>sum+b.height,0);
      ctx.fillStyle='#fff';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#3d3131';ctx.font='bold 28px sans-serif';ctx.fillText(`낙서 이어달리기 · ${index+1}번째 이야기`,24,55);
      let y=100;
      for(const {entry,lines,height} of blocks){
        ctx.fillStyle='#655049';ctx.font='18px sans-serif';ctx.fillText(`${name(entry.authorId)}${entry.autoSubmitted?' · 시간 종료':''}`,24,y+24);
        if(entry.kind==='drawing'){
          const paper=document.createElement('canvas');paper.width=640;paper.height=640;
          const pen=paper.getContext('2d');if(pen){renderDrawing(pen,entry.drawing,640);ctx.drawImage(paper,40,y+40);}
        }else{
          ctx.fillStyle='#3d3131';ctx.font='24px sans-serif';
          lines.forEach((line,i)=>ctx.fillText(line,24,y+65+i*30));
        }
        y+=height;
      }
      const blob=await new Promise<Blob>((resolve,reject)=>sheet.toBlob(b=>b?resolve(b):reject(new Error('PNG')),'image/png'));
      const url=URL.createObjectURL(blob);setImage(url);
      const a=document.createElement('a');a.href=url;a.download=`땅콩-낙서-${index+1}.png`;a.click();
      setMessage('저장이 안 되면 아래 이미지 보기를 눌러 길게 눌러 저장해 주세요.');
    }catch{setMessage('이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');}
  }
  return <>
    <ResultMoment label="우리의 낙서는 어디까지 갔을까?">이야기 펼쳐보기</ResultMoment>
    <p className={styles.hint}>처음의 문장이 어떻게 달라졌는지 한 장씩 확인해요.</p>
    {state.revealedChains.map((chain,i)=>chain.length>0&&<section key={i} className={styles.section}>
      <h2 className="text-lg font-bold">{i+1}번째 이야기</h2>
      {chain.map((entry,r)=><article className={styles.entry} key={r}>
        <p className={styles.entryLabel}>{r+1}. {name(entry.authorId)}{entry.autoSubmitted?' · 시간 종료로 전달':''}</p>
        {entry.kind==='text'?<p>{entry.text||'전달된 문장이 없어요'}</p>:<><DrawingCanvas value={entry.drawing} readOnly />{!entry.drawing.strokes.length&&<p className={styles.hint}>빈 종이가 전달됐어요.</p>}</>}
      </article>)}
      {chain.length===state.order.length&&<div className={styles.actions}><MainButton variant="outlined" onClick={()=>void save(chain,i)}>이야기 이미지 저장</MainButton></div>}
    </section>)}
    {state.phase==='reveal'&&<div className={styles.actions}>{isHost?<MainButton onClick={onRevealNext} disabled={busy}>다음 장 공개</MainButton>:<p className={styles.hint}>방장이 다음 장을 펼치고 있어요.</p>}</div>}
    {message&&<p role="status" className={styles.hint}>{message}</p>}
    {image&&<a className="mt-3 block underline" href={image} target="_blank" rel="noreferrer">저장할 이미지 보기</a>}
    {state.phase==='complete'&&isHost&&<div className={styles.actions}><MainButton onClick={onReset} disabled={busy}>한 판 더 하기</MainButton></div>}
  </>;
}
