import { ReactNode } from 'react';

export interface ContainerProps {
  children: ReactNode;
}

interface useDeckProps {
  cnt: number;
  getCard: (i: number) => ReactNode;
  Group: ({ children }: ContainerProps) => JSX.Element;
}

const useDeck = ({ cnt, getCard, Group }: useDeckProps) => {
  const groups = [];
  let currentDivs = [];

  // if you want to change the divisor, use this comment
  //
  // const isNumberDivisibleBy = (n: number, divisor: number) => {
  //   return n % divisor === 0;
  // };

  const divisor = 3; //isNumberDivisibleBy(cnt, 2) ? 2 : 3;

  for (let i = 1; i <= cnt; i++) {
    currentDivs.push(getCard(i));

    if (i % divisor === 0 || i === cnt) {
      groups.push(<Group key={i * cnt}>{currentDivs}</Group>);
      currentDivs = [];
    }
  }
  return groups;
};

export default useDeck;
