import { CoffeeState } from '../context/coffee';

export type CoffeeActionType = 'increaseBoom' | 'decreaseBoom' | 'increaseTotal' | 'decreaseTotal';

export interface CoffeeAction {
  type: CoffeeActionType;
}

/**
 * @description boom은 항상 total 보다 작거나 같아야 한다.
 */

export function coffeeReducer(state: CoffeeState, action: CoffeeAction) {
  switch (action.type) {
    case 'increaseBoom':
      return {
        ...state,
        boom: Math.min(state.total, state.boom + 1),
      };
    case 'decreaseBoom':
      return {
        ...state,
        boom: state.boom - 1,
      };
    case 'increaseTotal':
      return {
        ...state,
        total: state.total + 1,
      };
    case 'decreaseTotal':
      return {
        ...state,
        boom: Math.min(state.total - 1, state.boom),
        total: state.total - 1,
      };
  }
}
