import { MouseEventHandler } from 'react';
import clsx from 'clsx';
import styles from './main-button.module.css';

interface MainButtonProps {
  label: string;
  variant?: 'outlined' | 'contained';
  color?: 'chocolate';
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const MainButton = ({ onClick, label, variant = 'contained', color = 'chocolate', className }: MainButtonProps) => {
  const btnCls = clsx(styles['button'], styles[variant], styles[color], className);
  return (
    <button onClick={onClick} className={btnCls}>
      {label}
    </button>
  );
};

export default MainButton;
