import { MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './main-button.module.css';

interface MainButtonProps {
  children: ReactNode;
  variant?: 'outlined' | 'contained' | 'icon';
  color?: 'chocolate';
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

const MainButton = ({
  onClick,
  disabled = false,
  children,
  variant = 'contained',
  color = 'chocolate',
  fullWidth = true,
  type = 'button',
  className,
}: MainButtonProps) => {
  const btnCls = clsx(styles['button'], styles[variant], styles[color], className, {
    [styles['auto-width']]: !fullWidth,
    // [styles['disabled']]: disabled,
  });
  return (
    <button type={type} onClick={onClick} className={btnCls} disabled={disabled}>
      {children}
    </button>
  );
};

export default MainButton;
