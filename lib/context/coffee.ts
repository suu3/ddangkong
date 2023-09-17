import React from 'react';
import { CoffeeActionType, SoundActionType } from '../reducer/coffee';

export interface CoffeeState {
  boom: number;
  total: number;
}

/**
 * Sound State는 전체 음소거 상태를 제어한다.
 */
export interface allMuteState {
  isAllMuted: boolean;
}

export const initialCoffeeState: CoffeeState = {
  boom: 0,
  total: 0,
};

export const initialallMuteState: allMuteState = {
  isAllMuted: true,
};

export const CoffeeContext = React.createContext<{
  orderState: CoffeeState;
  allMuteState: allMuteState;
  handleOrder: (type: CoffeeActionType) => void;
  handleAllMute: (type: SoundActionType) => void;
}>({
  orderState: initialCoffeeState,
  allMuteState: initialallMuteState,
  handleOrder: () => {},
  handleAllMute: () => {},
});
