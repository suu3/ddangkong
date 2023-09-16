import { forwardRef } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import noteImage from '@/public/coffee/note.svg';
import styles from './lottery.module.css';

interface LotteryProps {
  cnt?: string;
  type?: 'front' | 'back';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Lottery = forwardRef<HTMLDivElement, LotteryProps>(
  ({ cnt = '', children, type = 'back', className, style = {} }, ref) => {
    return (
      <div className={clsx(styles['wrapper'], className)} style={style} ref={ref}>
        <Image priority src={noteImage} fill sizes="100%" alt="제비" />
        <div className={styles[`${type}-no`]}>No.{cnt}</div>
        <div className={styles[`${type}-selected`]}>{children}</div>
      </div>
    );
  }
);
Lottery.displayName = 'Lottery';

export default Lottery;
