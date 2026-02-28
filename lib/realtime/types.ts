import { initialCoffeeState } from '@/lib/context/coffee';
import { initialRouletteState } from '@/lib/context/roulette';

export interface CoffeeRealtimeState {
  step: number;
  orderState: typeof initialCoffeeState;
  resultBoom?: string;
}

export interface RouletteSpinPlan {
  initialSpeed: number;
  deceleration: number;
  spinTime: number;
}

export interface RouletteRealtimeState {
  step: number;
  orderState: typeof initialRouletteState;
  spinPlan?: RouletteSpinPlan;
}
