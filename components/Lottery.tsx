import { LegacyRef, forwardRef } from 'react';
import noteImage from '@/public/coffee/note.svg';
import Image from 'next/image';
import styles from './lottery.module.css';
// import UniqueText from './UniqueText';
import clsx from 'clsx';

interface LotteryProps {
  cnt?: string;
  type?: 'front' | 'back';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}


const Lottery = forwardRef(({ cnt = '', children, type = 'back', className, style = {} }: LotteryProps, ref :LegacyRef<HTMLDivElement>) => {
  return (
    <div className={clsx(styles['wrapper'], className)} style={style} ref={ref}>
      <Image priority src={noteImage} fill sizes="100%" alt="제비" />
      <div className={styles[`${type}-no`]}>No.{cnt}</div>
      <div className={styles[`${type}-selected`]}>{children}</div>
    </div>
  );
});
Lottery.displayName = 'Lottery';

export default Lottery;
