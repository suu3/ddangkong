import { MouseEventHandler } from 'react';
import clsx from 'clsx';
import styles from './main-button.module.css';

interface MainButtonProps {
  label: string;
  variant?: 'outlined' | 'contained';
  color?: 'chocolate';
  disabled?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const MainButton = ({
  onClick,
  disabled = false,
  label,
  variant = 'contained',
  color = 'chocolate',
  className,
}: MainButtonProps) => {
  const btnCls = clsx(styles['button'], styles[variant], styles[color], className, {
    // [styles['disabled']]: disabled,
  });
  return (
    <button onClick={onClick} className={btnCls} disabled={disabled}>
      {label}
    </button>
  );
};

export default MainButton;
