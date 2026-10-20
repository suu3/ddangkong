'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { MAIN } from '@/lib/constants/serviceUrls';
import { GlobalSoundButton } from '@/lib/context/sound';
import homeIcon from '@/public/button/button_home.svg';
import styles from './navigation.module.css';

const Navigation = () => {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <header className={styles['header']}>
      <Link href={MAIN} className={styles.iconButton}>
        <Image src={homeIcon} width={32} height={32} alt="메인 화면으로 돌아가기" />
      </Link>
      <nav className={styles['nav']}>
        <div ref={container} className={styles.menuContainer}>
          <button
            ref={trigger}
            type="button"
            className={styles.iconButton}
            aria-label="설정 메뉴"
            aria-expanded={open}
            aria-controls="navigation-settings"
            onClick={() => setOpen(value => !value)}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M7 9h18M7 16h18M7 23h18" stroke="#493b37" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
          {open && (
            <div id="navigation-settings" className={styles.settings}>
              <p className={styles.settingsTitle}>소리 설정</p>
              <GlobalSoundButton />
              <p className={styles.settingsHint}>켜면 배경음과 효과음이 재생돼요.</p>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navigation;
