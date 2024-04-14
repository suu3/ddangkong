import { ChangeEventHandler, InputHTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './main-input.module.css';

interface MainInputProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  className?: string;
}

const MainInput = ({ onChange, placeholder, value, disabled = false, className, ...rest }: MainInputProps) => {
  const inputCls = clsx(styles['input'], className, {
    [styles['disabled']]: disabled,
  });
  return <input {...rest} className={inputCls} value={value} onChange={onChange} placeholder={placeholder} />;
};

export default MainInput;
