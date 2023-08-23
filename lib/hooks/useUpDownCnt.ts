import { useState } from "react";

interface UseUpDownCnt {
  initialValue?: number;
}

const useUpDownCnt = ({ initialValue = 0 }: UseUpDownCnt) => {
  const [count, setCount] = useState(initialValue);

  const handleIncrease = () => {
    setCount((prev) => prev + 1);
  };

  const handleDecrease = () => {
    setCount((prev) => prev - 1);
  };

  return [count, handleIncrease, handleDecrease] as const;
};

export default useUpDownCnt;
