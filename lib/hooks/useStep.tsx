import React, { Fragment, isValidElement, useState } from 'react';

export interface UseStep {
  (initialStep: number): readonly [number, React.FC<ConatinerProps>, (type: 'next' | 'prev') => void];
}

export interface HandleStep {
  (type: 'next' | 'prev'): void;
}

interface ConatinerProps {
  children: React.ReactNode;
  curStep: number;
  // curStep: number;
}
const Container = ({ children, curStep }: ConatinerProps) => {
  return <Fragment>{React.Children.toArray(children).filter(isValidElement)[curStep]}</Fragment>;
};

const useStep: UseStep = initialStep => {
  const [step, setStep] = useState(initialStep);

  const handleStep: HandleStep = type => {
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
