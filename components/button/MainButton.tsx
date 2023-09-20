import { MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './main-button.module.css';

interface MainButtonProps {
  children: ReactNode;
  variant?: 'outlined' | 'contained' | 'icon';
  color?: 'chocolate';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

const MainButton = ({
  onClick,
  disabled = false,
  children,
  variant = 'contained',
  color = 'chocolate',
  className,
}: MainButtonProps) => {
  const btnCls = clsx(styles['button'], styles[variant], styles[color], className, {
    // [styles['disabled']]: disabled,
  });
  return (
    <button onClick={onClick} className={btnCls} disabled={disabled}>
      {children}
    </button>
  );
};

export default MainButton;
