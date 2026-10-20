import type { ReactNode } from 'react';
import styles from './result-moment.module.css';

export default function ResultMoment({
  children,
  label = '두근두근, 결과 발표!',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className={styles.moment}>
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <p className={styles.eyebrow}>{label}</p>
      <div role="status" aria-live="polite" aria-atomic="true" className={styles.content}>
        {children}
      </div>
    </div>
  );
}
