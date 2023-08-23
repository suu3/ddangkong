import noteImage from '@/public/coffee/note.svg';
import Image from 'next/image';
import styles from './lottery.module.css';
import UniqueText from './UniqueText';

interface LotteryProps {
  cnt: string;
}

const Lottery = ({ cnt }: LotteryProps) => {
  return (
    <div className={styles['wrapper']}>
      <Image src={noteImage} fill sizes="100%" alt="제비" />
      <div className={styles['no']}>No.</div>
      <div className={styles['select-num']}>{cnt}</div>
    </div>
  );
};

export default Lottery;
