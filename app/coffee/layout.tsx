import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function CoffeeLayout({ children }: LayoutProps) {
  return <section className="flex flex-col justify-between items-center">{children}</section>;
}
