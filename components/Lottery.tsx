import noteImage from '@/public/coffee/note.svg';
import Image from 'next/image';
import styles from './lottery.module.css';
// import UniqueText from './UniqueText';

interface LotteryProps {
  cnt?: string;
  type?: 'front' | 'back';
  children: React.ReactNode;
}

const Lottery = ({ cnt = '', children, type = 'back' }: LotteryProps) => {
  return (
    <div className={styles['wrapper']}>
      <Image src={noteImage} fill sizes="100%" alt="제비" />
      <div className={styles[`${type}-no`]}>No.{cnt}</div>
      <div className={styles[`${type}-selected`]}>{children}</div>
    </div>
  );
};

export default Lottery;
