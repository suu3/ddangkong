interface RouletteResultState {
  step: number;
  resultIndex: number | null;
  orderState: { total: readonly string[] };
}

export function rouletteResult(current: RouletteResultState, random: () => number = Math.random): number | null {
  if (current.step !== 2 || current.resultIndex !== null || current.orderState.total.length === 0) {
    return current.resultIndex;
  }
  return Math.floor(random() * current.orderState.total.length);
}
