export function photoPlaceholder(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="100%" stop-color="#111"/>
      </linearGradient>
    </defs>
    <rect width="480" height="640" fill="url(#g)"/>
    <text x="240" y="320" fill="rgba(255,255,255,0.9)" font-size="28" text-anchor="middle" font-family="system-ui,sans-serif">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
