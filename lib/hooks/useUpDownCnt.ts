import { useState } from 'react';

const useUpDownCnt = (initialValue: number = 0) => {
  const [count, setCount] = useState(initialValue);

  const handleIncrease = () => {
    setCount(prev => prev + 1);
  };

  const handleDecrease = () => {
    setCount(prev => prev - 1);
  };

  return [count, handleIncrease, handleDecrease] as const;
};

export default useUpDownCnt;
