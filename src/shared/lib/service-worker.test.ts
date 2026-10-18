import { expect, it, vi } from 'vitest';
import { watchServiceWorkerController } from './service-worker';

it('does not interrupt an initial visit when the first service worker takes control', () => {
  const container = Object.assign(new EventTarget(), { controller: null });
  const reload = vi.fn();
  const stop = watchServiceWorkerController(container as unknown as ServiceWorkerContainer, reload);
  container.dispatchEvent(new Event('controllerchange'));
  expect(reload).not.toHaveBeenCalled();
  container.dispatchEvent(new Event('controllerchange'));
  expect(reload).toHaveBeenCalledTimes(1);
  stop();
  container.dispatchEvent(new Event('controllerchange'));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('refreshes a page already controlled by an older service worker when it updates', () => {
  const container = Object.assign(new EventTarget(), { controller: {} });
  const reload = vi.fn();
  const stop = watchServiceWorkerController(container as unknown as ServiceWorkerContainer, reload);
  container.dispatchEvent(new Event('controllerchange'));
  expect(reload).toHaveBeenCalledTimes(1);
  stop();
});
