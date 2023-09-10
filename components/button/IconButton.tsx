import { MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './icon-button.module.css';

interface IconButtonProps {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const IconButton = ({ onClick, disabled = false, children, className }: IconButtonProps) => {
  const btnCls = clsx(styles['button'], className);
  return (
    <button onClick={onClick} className={btnCls} disabled={disabled}>
      {children}
    </button>
  );
};

export default IconButton;
