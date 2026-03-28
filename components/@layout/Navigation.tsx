import Link from 'next/link';
import Image from 'next/image';
import { MAIN } from '@/lib/constants/serviceUrls';
import { GlobalSoundButton } from '@/lib/context/sound';
import homeIcon from '@/public/button/button_home.svg';
import styles from './navigation.module.css';

const Navigation = () => (
  <header className={styles['header']}>
    <Link href={MAIN}>
      <Image src={homeIcon} width={32} height={32} alt="메인 화면으로 돌아가기" />
    </Link>
    <nav className={styles['nav']}>
      <div className={styles['nav-spacer']} />
      <GlobalSoundButton />
    </nav>
  </header>
);

export default Navigation;
