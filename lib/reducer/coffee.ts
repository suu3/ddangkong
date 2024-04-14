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

export type CoffeeActionType = 'INCREASE_BOOM' | 'DECREASE_BOOM' | 'INCREASE_TOTAL' | 'DECREASE_TOTAL';

export interface CoffeeAction {
  type: CoffeeActionType;
}

export type SoundActionType = 'UNMUTE_SOUND' | 'MUTE_SOUND';

export interface SoundAction {
  type: SoundActionType;
}

/**
 * @description boom은 항상 total 보다 작거나 같아야 한다.
 */

export function coffeeReducer(state: CoffeeState, action: CoffeeAction) {
  switch (action.type) {
    case 'INCREASE_BOOM':
      return {
        ...state,
        boom: Math.min(state.total, state.boom + 1),
      };
    case 'DECREASE_BOOM':
      return {
        ...state,
        boom: state.boom - 1,
      };
    case 'INCREASE_TOTAL':
      return {
        ...state,
        total: state.total + 1,
      };
    case 'DECREASE_TOTAL':
      return {
        ...state,
        boom: Math.min(state.total - 1, state.boom),
        total: state.total - 1,
      };
  }
}

export function soundReducer(state: allMuteState, action: SoundAction) {
  switch (action.type) {
    case 'UNMUTE_SOUND':
      return { ...state, isAllMuted: false };
    case 'MUTE_SOUND':
      return { ...state, isAllMuted: true };
  }
}
