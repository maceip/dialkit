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
