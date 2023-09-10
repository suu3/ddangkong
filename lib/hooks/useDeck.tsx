interface useDeckProps {
  cnt: number;
  getCard: (i: number) => React.ReactNode;
}

const useDeck = ({ cnt, getCard }: useDeckProps) => {
  const divs = [];
  let currentDivs = [];

  // const isNumberDivisibleBy = (n: number, divisor: number) => {
  //   return n % divisor === 0;
  // };

  const divisor = 3; //isNumberDivisibleBy(cnt, 2) ? 2 : 3;

  for (let i = 1; i <= cnt; i++) {
    currentDivs.push(getCard(i));

    if (i % divisor === 0 || i === cnt) {
      divs.push(
        <div key={divs.length} className="w-full flex items-center justify-evenly">
          {currentDivs}
        </div>
      );
      currentDivs = [];
    }
  }
  return divs;
};

export default useDeck;
