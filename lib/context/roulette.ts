import React from 'react';
import { RouletteAction, RouletteActionType, RouletteState, SoundActionType, allMuteState } from '../reducer/roulette';

export const initialRouletteState: RouletteState = {
  angle: 0,
  total: [],
};

export const initialallMuteState: allMuteState = {
  isAllMuted: true,
};

export const RouletteContext = React.createContext<{
  orderState: RouletteState;
  allMuteState?: allMuteState;
  handleOrder: (action: RouletteAction) => void;
  handleAllMute?: (type: SoundActionType) => void;
}>({
  orderState: initialRouletteState,
  allMuteState: initialallMuteState,
  handleOrder: () => {},
  handleAllMute: () => {},
});
