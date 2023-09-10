import React, { Fragment, isValidElement, useState } from 'react';

interface ConatinerProps {
  children: React.ReactNode;
  curStep: number;
  // curStep: number;
}
const Container = ({ children, curStep }: ConatinerProps) => {
  return <Fragment>{React.Children.toArray(children).filter(isValidElement)[curStep]}</Fragment>;
};

const useStep = (initialStep: number) => {
  const [step, setStep] = useState(initialStep);

  const handleStep = (type: 'next' | 'prev') => {
    switch (type) {
      case 'next':
        setStep(step + 1);
        break;
      case 'prev':
        setStep(step > 0 ? step - 1 : 0);
        break;
      default:
        break;
    }
  };

  return [step, Container, handleStep] as const;
};

export default useStep;
