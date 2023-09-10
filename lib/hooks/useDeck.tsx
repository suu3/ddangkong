interface useDeckProps {
  cnt: number;
  getCard: (i: number) => React.ReactNode;
  Group: ({ children }: { children: React.ReactNode }) => JSX.Element;
}

const useDeck = ({ cnt, getCard, Group }: useDeckProps) => {
  const groups = [];
  let currentDivs = [];

  // const isNumberDivisibleBy = (n: number, divisor: number) => {
  //   return n % divisor === 0;
  // };

  const divisor = 3; //isNumberDivisibleBy(cnt, 2) ? 2 : 3;

  for (let i = 1; i <= cnt; i++) {
    currentDivs.push(getCard(i));

    if (i % divisor === 0 || i === cnt) {
      groups.push(<Group>{currentDivs}</Group>);
      currentDivs = [];
    }
  }
  return groups;
};

export default useDeck;
