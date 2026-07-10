import css from './styles/annotation.css';

let injected = false;

/** Inject Solid annotation toolbar CSS once (bundled as text). */
export function ensureAnnotationStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dialkit-solid-annotation-styles';
  style.textContent = typeof css === 'string' ? css : String(css);
  document.head.appendChild(style);
}
