import { lazy, Suspense, type ComponentType } from 'react';
export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>, _options?: { ssr?: boolean }) {
  const Component = lazy(loader);
  return function DynamicComponent(props: P) {
    return <Suspense fallback={<p role="status">Carregando…</p>}><Component {...props} /></Suspense>;
  };
}
