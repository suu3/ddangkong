import styles from './navigation.module.css';

const Navigation = () => {
  return (
    <header className={styles['header']}>
      <nav className={styles['nav']}>{/* <div>햄버거 버튼</div> */}</nav>
    </header>
  );
};

export default Navigation;
