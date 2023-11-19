import { CSSProperties, ReactNode, forwardRef } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import noteImage from '@/public/coffee/note.svg';
import styles from './lottery.module.css';
import UniqueText from './UniqueText';

interface LotteryProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const Lottery = forwardRef<HTMLDivElement, LotteryProps>(({ children, className = '', style = {} }, ref) => {
  return (
    <div className={clsx(styles['wrapper'], className)} style={style} ref={ref}>
      <Image priority src={noteImage} fill sizes="100%" alt="제비" />
      {children}
    </div>
  );
});

Lottery.displayName = 'Lottery';

const LotteryBack = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <UniqueText Tag="div" size="md" font="uhbee-seulvely" className={styles['back-no']}>
        No.
      </UniqueText>
      <UniqueText Tag="div" size="lg" font="uhbee-seulvely" className={styles['back-selected']}>
        {children}
      </UniqueText>
    </>
  );
};

const LotteryFront = ({ cnt = '', children }: { cnt?: string; children: ReactNode }) => {
  return (
    <>
      <UniqueText Tag="div" size="md" font="uhbee-seulvely" className={styles['front-no']}>
        No.{cnt}
      </UniqueText>
      <UniqueText Tag="div" size="lg" font="uhbee-seulvely" className={styles['front-selected']}>
        {children}
      </UniqueText>
    </>
  );
};

//@link compound type : https://stackoverflow.com/questions/65767437/property-group-does-not-exist-on-type-forwardrefexoticcomponentinputprops

type LotteryType = typeof Lottery & {
  Back: typeof LotteryBack;
  Front: typeof LotteryFront;
};

const CompoundedLottery = Lottery as LotteryType;
CompoundedLottery.Back = LotteryBack;
CompoundedLottery.Front = LotteryFront;

export default CompoundedLottery;
