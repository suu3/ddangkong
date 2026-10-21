'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createRoom, hasRealtimeConfig, roomErrorMessage, useRoom } from '@/src/entities/room';
import { entryKind, validateDrawing, type RelayCommand, type RelayContent, type RelayPublicState } from '@/src/shared/lib/drawing-relay';
import {shouldFlushDraft} from './presentation';
export function useDrawingRelayView(){
  const params=useSearchParams();const router=useRouter();const roomId=params.get('roomId');
  const live=useRoom<RelayPublicState>(roomId,'drawing_relay');
  const state=live.state;
  const [entered,setEntered]=useState(false);
  const [nickname,setNickname]=useState('');
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [clock,setClock]=useState(()=>Date.now());
  const [offset,setOffset]=useState(0);
  const [draftState,setDraftState]=useState<{key:string;content:RelayContent}|null>(null);
  const storageKey=state&&live.actorId!=='guest'?`drawing-relay:${roomId}:${state.gameId}:${state.round}:${live.actorId}`:'';
  const draft:RelayContent=draftState?.key===storageKey?draftState!.content:state?.ownDraft??(entryKind(state?.round??0)==='text'?'':{strokes:[]});
  const latest=useRef({key:storageKey,content:draft});
  const command=useCallback(async(action:RelayCommand)=>{
    if(!live.command||live.status!=='connected')throw new Error('NOT_CONNECTED');
    await live.command({kind:'drawing_relay.command',action});
  },[live.command,live.status]);
  const perform=useCallback(async(action:RelayCommand)=>{
    setError(null);setBusy(true);
    try{await command(action);}catch(e){setError(roomErrorMessage(e instanceof Error?e.message:null));}finally{setBusy(false);}
  },[command]);
  useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(state?.serverNow)setOffset(Date.now()-state.serverNow);},[state?.serverNow]);
  useEffect(()=>{
    if(!storageKey||!state||state.phase!=='playing'||live.status!=='connected')return;
    let content:RelayContent=state.ownDraft??(entryKind(state.round)==='text'?'':{strokes:[]});
    try{
      const stored=window.localStorage.getItem(storageKey);
      if(stored){const saved:unknown=JSON.parse(stored);content=entryKind(state.round)==='text'?(typeof saved==='string'&&saved.length<=100?saved:content):validateDrawing(saved);}
    }catch{/* Continue with the server draft when storage is unavailable. */}
    latest.current={key:storageKey,content};setDraftState({key:storageKey,content});
    // Hydrate once per turn/reconnect, never overwrite edits with draft acknowledgements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey,live.status]);
  const setDraft=useCallback((content:RelayContent)=>{
    latest.current={key:storageKey,content};setDraftState({key:storageKey,content});
    try{localStorage.setItem(storageKey,JSON.stringify(content));}catch{/* Server autosave remains available. */}
    if(state?.phase==='playing'&&state.deadlineMs!==null&&shouldFlushDraft(state.deadlineMs,Date.now()-offset))
      void command({kind:'draft',gameId:state.gameId,round:state.round,content}).catch(()=>{});
  },[storageKey,state?.phase,state?.deadlineMs,state?.gameId,state?.round,command,offset]);
  useEffect(()=>{
    if(!state||state.phase!=='playing'||state.ownSubmitted||live.status!=='connected')return;
    const gameId=state.gameId,round=state.round;let pending=false,lastSent='';let disposed=false;
    const save=()=>{
      if(disposed||pending||latest.current.key!==storageKey)return;
      const content=latest.current.content,serialised=JSON.stringify(content);
      if(serialised===lastSent)return;
      pending=true;
      void command({kind:'draft',gameId,round,content}).then(()=>{lastSent=serialised;}).catch(()=>{}).finally(()=>{pending=false;});
    };
    const t=setInterval(save,800);
    const deadlineFlush=setTimeout(save,Math.max(0,(state.deadlineMs??0)-(Date.now()-offset)-250));
    window.addEventListener('pagehide',save);
    return()=>{disposed=true;clearInterval(t);clearTimeout(deadlineFlush);window.removeEventListener('pagehide',save);};
  },[state?.gameId,state?.round,state?.phase,state?.ownSubmitted,state?.deadlineMs,live.status,storageKey,command,offset]);
  async function handleCreateRoom(){
    const room=await createRoom('drawing_relay',{revision:0,lastActor:null},{name:'낙서 이어달리기 방',maxCapacity:10});
    router.replace(`/drawing-relay?roomId=${encodeURIComponent(room.id)}`);
  }
  const me=state?.players.find(p=>p.actorId===live.actorId);
  const remainingMs=Math.max(0,(state?.deadlineMs??0)-(clock-offset));
  return {roomId,live,state,entered,setEntered,nickname,setNickname,error,busy,perform,draft,setDraft,storageKey,me,remainingMs,handleCreateRoom,
    configured:hasRealtimeConfig(),
    submit:()=>state?perform({kind:'submit',gameId:state.gameId,round:state.round,content:latest.current.key===storageKey?latest.current.content:draft}):Promise.resolve(),
  };
}
