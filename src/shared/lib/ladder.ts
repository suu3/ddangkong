export interface Ladder {
  count: number;
  rows: number[][];
}
export interface Point {
  x: number;
  y: number;
}
export const LADDER_TOP = 24;
export const LADDER_BOTTOM = 344;
export const railX = (index: number) => 44 + index * 88;
export const ladderWidth = (count: number) => count * 88;
export const rowY = (row: number, total: number) =>
  LADDER_TOP + ((row + 1) * (LADDER_BOTTOM - LADDER_TOP)) / (total + 1);

export function createLadder(count: number): Ladder {
  if (!Number.isInteger(count) || count < 2 || count > 8) throw new Error('2~8명으로 시작해주세요.');
  return {
    count,
    rows: Array.from({ length: 12 }, () => {
      const row: number[] = [];
      for (let i = 0; i < count - 1; i++)
        if (Math.random() < 0.48) {
          row.push(i);
          i++;
        }
      return row;
    }),
  };
}

export function traceLadder(ladder: Ladder, start: number): { end: number; points: Point[] } {
  if (!Number.isInteger(start) || start < 0 || start >= ladder.count) throw new Error('잘못된 시작점입니다.');
  let rail = start;
  const points = [{ x: railX(rail), y: LADDER_TOP }];
  ladder.rows.forEach((row, index) => {
    const y = rowY(index, ladder.rows.length);
    points.push({ x: railX(rail), y });
    if (row.includes(rail)) rail++;
    else if (row.includes(rail - 1)) rail--;
    points.push({ x: railX(rail), y });
  });
  points.push({ x: railX(rail), y: LADDER_BOTTOM });
  return { end: rail, points };
}
