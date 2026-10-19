import type { AnchorHTMLAttributes } from 'react';
import { navigate } from './router';
export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const internal = href.startsWith('/') && !href.startsWith('//');
  return <a {...props} href={internal ? `#${href}` : href} onClick={event => {
    onClick?.(event);
    if (internal && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && !props.target) {
      event.preventDefault(); void navigate(href);
    }
  }} />;
}
