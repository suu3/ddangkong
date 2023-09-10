import React from 'react';

export interface CoffeeState {
  boom: number;
  total: number;
}

export const initialCoffeeState: CoffeeState = {
  boom: 0,
  total: 0,
};

export const CoffeContext = React.createContext<{
  orderState: CoffeeState;
  // orderDispatch: React.Dispatch<CoffeeAction>;
}>({
  orderState: initialCoffeeState,
  // orderDispatch: () => {},
});
