// ─── MLG Icon Set ─────────────────────────────────────────────────────
// Geometric SVG icons matching mlrecloud.com splash page style.
// fill="none", stroke="currentColor", stroke-linecap="square",
// stroke-linejoin="miter", stroke-width="1.25"

const PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
  width: "100%",
  height: "100%",
};

export function IconSearch({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <circle cx="11" cy="11" r="7"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

export function IconBuilding({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M3 21h18"/>
      <path d="M5 21V7l7-4 7 4v14"/>
      <path d="M9 21V13h6v8"/>
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/>
    </svg>
  );
}

export function IconCommunity({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M3 21h18"/>
      <path d="M5 21V9l4-4h6l4 4v12"/>
      <path d="M10 21v-6h4v6"/>
      <path d="M2 9l2-2M22 9l-2-2"/>
    </svg>
  );
}

export function IconLocation({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
}

export function IconZip({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <rect x="2" y="4" width="20" height="16" rx="1"/>
      <path d="M2 8h20"/>
      <path d="M6 4v4"/>
      <path d="M8 12h2l-2 4h2"/>
    </svg>
  );
}

export function IconBell({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

export function IconMail({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

export function IconShare({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M7 17L17 7M17 7H8M17 7v9"/>
    </svg>
  );
}

export function IconCheck({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export function IconX({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function IconSave({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...PROPS} width={size} height={size} stroke={color}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
