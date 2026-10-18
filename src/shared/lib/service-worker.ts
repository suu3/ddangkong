/** Initial activation must not interrupt an in-flight room creation or navigation. */
export function watchServiceWorkerController(container: ServiceWorkerContainer, reload: () => void) {
  let controlled = Boolean(container.controller);
  let reloading = false;
  const onChange = () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    reload();
  };
  container.addEventListener('controllerchange', onChange);
  return () => container.removeEventListener('controllerchange', onChange);
}
