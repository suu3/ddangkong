import { MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styled-button.module.css';

interface StyledButtonProps {
  children: ReactNode;
  variant?: 'outlined' | 'contained' | 'icon';
  color?: 'chocolate';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

const StyledButton = ({ onClick, disabled = false, children, className }: StyledButtonProps) => {
  const btnCls = clsx(styles['button'], className, {
    // [styles['disabled']]: disabled,
  });
  return (
    <button onClick={onClick} className={btnCls} disabled={disabled}>
      {children}
    </button>
  );
};

export default StyledButton;
