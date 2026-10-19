import { createContext, useContext } from 'react';

export type Router = {
  pathname: string;
  asPath: string;
  query: Record<string, string>;
  push: (href: string) => Promise<boolean>;
  replace: (href: string) => Promise<boolean>;
};
export const RouterContext = createContext<Router | null>(null);
export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Router indisponível.');
  return router;
}
export function navigate(href: string, replace = false) {
  if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\')) throw new Error('Rota inválida.');
  if (replace) history.replaceState(null, '', `#${href}`);
  else history.pushState(null, '', `#${href}`);
  window.dispatchEvent(new Event('jb:navigate'));
  return Promise.resolve(true);
}
