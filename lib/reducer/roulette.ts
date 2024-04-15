export interface RouletteState {
  angle: number;
  total: String[];
}

/**
 * Sound State는 전체 음소거 상태를 제어한다.
 */
export interface allMuteState {
  isAllMuted: boolean;
}

export type RouletteActionType = 'ADD_ITEM';

export interface RouletteAction {
  type: RouletteActionType;
  payload: string[];
}

export type SoundActionType = 'UNMUTE_SOUND' | 'MUTE_SOUND';

export interface SoundAction {
  type: SoundActionType;
}

/**
 * @description boom은 항상 total 보다 작거나 같아야 한다.
 */

export function rouletteReducer(state: RouletteState, action: RouletteAction) {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        total: [...action.payload],
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
