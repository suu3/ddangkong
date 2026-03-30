import { ReactNode } from 'react';
import UniqueText from '../UniqueText';
import styles from './game-menu.module.css';
import Link from 'next/link';

type BadgeTone = 'amber' | 'green' | 'blue' | 'rose';

interface GameMenuProps {
  title: string;
  image?: ReactNode;
  link: string;
  description?: string;
  badges?: ReadonlyArray<{
    label: string;
    tone?: BadgeTone;
  }>;
}

const GameMenu = ({ title, image, link, description, badges = [] }: GameMenuProps) => {
  return (
    <div className={styles['wrapper']}>
      <Link href={link} className={styles['cardLink']}>
        <div className={styles['img']}>{image}</div>
        <div className={styles['content']}>
          <UniqueText Tag="p" font="uhbee-seulvely" size="md" className={styles['title']}>
            {title}
          </UniqueText>
          {badges.length > 0 && (
            <div className={styles['badgeList']}>
              {badges.map(badge => (
                <span key={`${title}-${badge.label}`} className={styles['badge']} data-tone={badge.tone ?? 'amber'}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
      {description && (
        <details className={styles['details']}>
          <summary className={styles['summary']}>게임 설명 보기</summary>
          <p className={styles['description']}>{description}</p>
        </details>
      )}
    </div>
  );
};

export default GameMenu;
