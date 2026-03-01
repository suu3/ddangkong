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
  activeSelectors?: Array<{ id: string; name: string }>;
}

const Lottery = forwardRef<HTMLDivElement, LotteryProps>(
  ({ children, className = '', style = {}, activeSelectors = [] }, ref) => {
    // 간단한 해시로 색상 생성
    const getSelectorColor = (id: string) => {
      const colors = ['#E91E63', '#9C27B0', '#2196F3', '#00BCD4', '#4CAF50', '#FFC107', '#FF5722'];
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length];
    };

    return (
      <div className={clsx(styles['wrapper'], className)} style={style} ref={ref}>
        <Image priority src={noteImage} fill sizes="100%" alt="제비" />
        {activeSelectors.map(selector => (
          <div
            key={selector.id}
            className={styles['selection-highlight']}
            style={{ '--highlight-color': getSelectorColor(selector.id) } as any}
          >
            <div className={styles['selector-label']}>{selector.name}</div>
          </div>
        ))}
        {children}
      </div>
    );
  }
);

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
