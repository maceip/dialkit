/** Minimal line icons for the Solid vertical tool chrome. */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.75,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
};

export function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 11v6" {...stroke} />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMove() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18M3 12h18" {...stroke} />
      <path d="M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" {...stroke} />
    </svg>
  );
}

export function IconColor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3c-4.4 3.2-7 6.6-7 10a7 7 0 0 0 14 0c0-3.4-2.6-6.8-7-10Z"
        {...stroke}
      />
      <circle cx="9.5" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconDial() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="13" r="2.25" fill="currentColor" stroke="none" />
      <path d="M7 16.5a6.2 6.2 0 0 1 10 0" {...stroke} />
      <circle cx="6.2" cy="10.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.2" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="10.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAnnotate() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 16.5V7.8A2.8 2.8 0 0 1 8.8 5h6.4A2.8 2.8 0 0 1 18 7.8v5.4A2.8 2.8 0 0 1 15.2 16H9.2L6 18.8V16.5Z"
        {...stroke}
      />
      <circle cx="18.2" cy="5.8" r="3.1" fill="currentColor" stroke="none" />
      <path d="M18.2 4.4v2.8M16.8 5.8h2.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" {...stroke} />
      <path d="M16.2 16.2 20 20" {...stroke} />
    </svg>
  );
}

export function IconGrip() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="7" r="1.3" fill="currentColor" />
      <circle cx="15" cy="7" r="1.3" fill="currentColor" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" />
      <circle cx="9" cy="17" r="1.3" fill="currentColor" />
      <circle cx="15" cy="17" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function IconCapture() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" {...stroke} />
      <circle cx="12" cy="12" r="3.2" {...stroke} />
    </svg>
  );
}

export function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 11.2 19.5 4.8c.5-.2 1 .3.8.8l-6.4 15c-.2.5-.9.5-1.1 0l-2.3-5.3a1 1 0 0 0-.5-.5L4.5 12.3c-.5-.2-.5-.9 0-1.1Z" {...stroke} />
      <path d="M10.6 13.4 15 9" {...stroke} />
    </svg>
  );
}
