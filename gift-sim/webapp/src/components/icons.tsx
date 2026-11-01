// Собственные SVG-иконки (без внешних библиотек).

let starId = 0;

export function Star({ size }: { size?: number }) {
  const id = `sg${starId++}`;
  return (
    <svg class="star" viewBox="0 0 24 24" style={size ? { width: size, height: size } : undefined} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FFE08A" />
          <stop offset="1" stop-color="#FF9F2E" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
      />
    </svg>
  );
}

export function KeyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="#9FC4FF"
        d="M14.5 3a6.5 6.5 0 0 0-6.2 8.5L3 16.8V21h4.2v-2.2h2.2v-2.2h2.2l1.4-1.4A6.5 6.5 0 1 0 14.5 3zm2 6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"
      />
    </svg>
  );
}

const s = { fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" } as const;

export const TabIcons = {
  home: () => (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  ),
  games: () => (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3" y="7" width="18" height="11" rx="5" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="15.5" cy="11.5" r=".8" fill="currentColor" />
      <circle cx="17.5" cy="13.5" r=".8" fill="currentColor" />
    </svg>
  ),
  inventory: () => (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M3 9h18M12 9v11" />
      <path d="M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z" />
    </svg>
  ),
  profile: () => (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" />
    </svg>
  ),
};
