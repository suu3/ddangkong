import clsx from 'clsx';
import styles from './unique-text.module.css';

interface UniqueTextProps {
  Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  children: React.ReactNode;
  font?: 'sans' | 'uhbee';
  size?: 'sm' | 'md' | 'ml' | 'lg' | '';
  className?: string;
  style?: React.CSSProperties;
}

const UniqueText = ({ Tag, children, font = 'sans', size = '', className, style }: UniqueTextProps) => {
  return (
    <Tag className={clsx(styles['common'], styles[font], styles[size], className)} style={style}>
      {children}
    </Tag>
  );
};

export default UniqueText;
