import { ReactNode } from 'react';
import UniqueText from '../UniqueText';
import styles from './game-menu.module.css';
import Link from 'next/link';

interface GameMenuProps {
  title: string;
  image?: ReactNode;
  link: string;
}

const GameMenu = ({ title, image, link }: GameMenuProps) => {
  return (
    <Link href={link} className={styles['wrapper']}>
      <div className={styles['img']}>{image}</div>
      <UniqueText Tag="p" font="uhbee-seulvely" size="md">
        {title}
      </UniqueText>
    </Link>
  );
};

export default GameMenu;
