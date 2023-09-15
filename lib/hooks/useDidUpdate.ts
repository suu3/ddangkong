import { DependencyList, useEffect, useRef } from 'react';

export function useDidUpdate<T extends () => (() => void) | void>(effect: T, deps: DependencyList) {
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    return effect();
  }, [effect]);
}