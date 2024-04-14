import React from 'react';
import { CoffeeActionType, CoffeeState, SoundActionType, allMuteState } from '../reducer/coffee';

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
