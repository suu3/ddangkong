import { ChangeEventHandler, MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './main-input.module.css';

interface MainInputProps {
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  className?: string;
}

const MainInput = ({ onChange, placeholder, value, disabled = false, className }: MainInputProps) => {
  const inputCls = clsx(styles['input'], className, {
    [styles['disabled']]: disabled,
  });
  return <input className={inputCls} value={value} onChange={onChange} placeholder={placeholder} />;
};

export default MainInput;
