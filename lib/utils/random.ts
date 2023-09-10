export function getLottery(total: number, boom: number): number[] {
  if (boom > total) {
    throw new Error('Count should be less than or equal to total');
  }

  const result: number[] = [];
  const availableNumbers: number[] = [];

  // 1부터 total까지의 숫자를 배열에 추가
  for (let i = 1; i <= total; i++) {
    availableNumbers.push(i);
  }

  // boom 개수만큼 랜덤으로 숫자를 선택하여 결과 배열에 추가
  for (let i = 0; i < boom; i++) {
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const selectedNumber = availableNumbers.splice(randomIndex, 1)[0];
    result.push(selectedNumber);
  }

  return result;
}
