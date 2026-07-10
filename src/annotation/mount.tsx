import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnnotationToolbar } from '../components/AnnotationToolbar';

let root: Root | null = null;
let el: HTMLDivElement | null = null;

/** Mount the React annotation toolbar from any framework host. */
export function mountAnnotationToolbar(projectKey = 'default'): () => void {
  if (typeof document === 'undefined') return () => {};
  if (!el) {
    el = document.createElement('div');
    el.id = 'dialkit-annotation-root';
    document.body.appendChild(el);
    root = createRoot(el);
  }
  root!.render(createElement(AnnotationToolbar, { projectKey }));
  return () => {
    root?.unmount();
    root = null;
    el?.remove();
    el = null;
  };
}
