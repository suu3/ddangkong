'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { EMPTY_ROOM, getRoomStore } from './store';
import { GameType } from '../../../shared/api/realtime-protocol';

const noopSubscribe = () => () => {};
const empty = () => EMPTY_ROOM;
export function useRoom<T>(roomId: string | null, expectedGame: GameType) {
  const store = useMemo(() => (roomId ? getRoomStore(roomId) : null), [roomId]);
  const model = useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getSnapshot ?? empty, empty);
  useEffect(() => store?.acquire(), [store]);
  const mismatch = Boolean(model.room && model.room.gameType !== expectedGame);
  return {
    ...model,
    state: mismatch ? null : ((model.room?.state as T | undefined) ?? null),
    status: mismatch ? ('error' as const) : model.status,
    error: mismatch ? 'GAME_TYPE_MISMATCH' : model.error,
    isHost: model.role === 'host',
    mutate: useMemo(
      () => (make: (current: T) => T | Omit<T, 'revision' | 'lastActor'>) => {
        if (!store || mismatch) return Promise.reject(new Error('NOT_CONNECTED'));
        return store.mutate<T>(make);
      },
      [store, mismatch]
    ),
    command: store?.command,
    updatePresence: store?.updatePresence,
    retry: store?.retry,
  };
}
