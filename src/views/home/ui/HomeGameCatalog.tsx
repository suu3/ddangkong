'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './home-game-catalog.module.css';

interface GameCategory {
  id: string;
  title: string;
  description: string;
  content: ReactNode;
}

export default function HomeGameCatalog({ categories }: { categories: readonly GameCategory[] }) {
  const [selected, setSelected] = useState('all');
  const catalog = useRef<HTMLDivElement>(null);
  const tablist = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = [{ id: 'all', title: '전체' }, ...categories];

  function selectCategory(id: string) {
    setSelected(id);
    // When filtering a long list, start at its first game instead of leaving
    // the user near the bottom of the shorter category.
    if (catalog.current && tablist.current) {
      const stickyTop = tablist.current.getBoundingClientRect().top;
      if (catalog.current.getBoundingClientRect().top < stickyTop) {
        catalog.current.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectCategory(tabs[next].id);
    buttons.current[next]?.focus({ preventScroll: true });
  }

  return (
    <div ref={catalog} className={styles.catalog}>
      <div ref={tablist} role="tablist" aria-label="게임 카테고리" className={styles.tabs}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={element => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`game-tab-${tab.id}`}
            aria-controls="home-games-panel"
            aria-selected={selected === tab.id}
            tabIndex={selected === tab.id ? 0 : -1}
            className={styles.tab}
            onClick={() => selectCategory(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div id="home-games-panel" role="tabpanel" aria-labelledby={`game-tab-${selected}`}>
        {categories
          .filter(category => selected === 'all' || category.id === selected)
          .map(category => (
            <section key={category.id} aria-labelledby={`home-category-${category.id}`} className="mb-10 w-full">
              <h2 id={`home-category-${category.id}`} className="text-xl font-bold text-chocolate07">
                {category.title}
              </h2>
              <p className="mb-4 mt-1 text-sm text-chocolate05">{category.description}</p>
              {category.content}
            </section>
          ))}
      </div>
    </div>
  );
}
