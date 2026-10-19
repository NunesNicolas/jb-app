import { Children, isValidElement, useEffect, type ReactNode } from 'react';
export default function Head({ children }: { children: ReactNode }) {
  const title = Children.toArray(children).find(child => isValidElement(child) && child.type === 'title');
  const value = isValidElement<{ children: ReactNode }>(title) ? Children.toArray(title.props.children).join('') : 'JB Management';
  useEffect(() => { document.title = value; }, [value]);
  return null;
}
