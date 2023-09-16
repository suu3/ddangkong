import { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './tooltip.module.css';

/**
 * @description Tootip의 기능 X 모양만 구현했습니다.
 *
 */

interface TooltipProps {
  children: ReactNode;
  visible?: boolean;
  className?: string;
}

const Tooltip = ({ children, visible = false, className }: TooltipProps) => {
  return (
    <div className={clsx(styles['tooltip'], className, visible ? styles['visible'] : styles['hidden'])}>{children}</div>
  );
};

export default Tooltip;
