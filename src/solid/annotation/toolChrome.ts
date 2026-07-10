import { createSignal } from 'solid-js';

/** Shared chrome state: dial panels stay hidden until the Dial tool opens them. */
const [dialsOpen, setDialsOpen] = createSignal(false);

export { dialsOpen, setDialsOpen };

export function toggleDialsOpen(): boolean {
  const next = !dialsOpen();
  setDialsOpen(next);
  return next;
}
