import type { ReactNode } from 'react';
import type { BuildingKind, HazardKind, ResourceKey } from '../engine';

function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const fill = { fill: 'currentColor', stroke: 'none' } as const;

export const ICONS: Record<string, (p: { size?: number }) => ReactNode> = {
  food: ({ size }) => (
    <Svg size={size}>
      <path d="M12 21V8" />
      <path d="M12 8c-3 0-4-2-4-4 3 0 4 1.500 4 4Z" {...fill} />
      <path d="M12 8c3 0 4-2 4-4-3 0-4 1.500-4 4Z" {...fill} />
      <path d="M12 13c-3 0-4-2-4-4 3 0 4 1.500 4 4Z" {...fill} />
      <path d="M12 13c3 0 4-2 4-4-3 0-4 1.500-4 4Z" {...fill} />
      <path d="M12 18c-3 0-4-2-4-4 3 0 4 1.500 4 4Z" {...fill} />
      <path d="M12 18c3 0 4-2 4-4-3 0-4 1.500-4 4Z" {...fill} />
    </Svg>
  ),
  timber: ({ size }) => (
    <Svg size={size}>
      <rect x="3" y="14" width="18" height="6" rx="3" />
      <rect x="5" y="7" width="14" height="6" rx="3" />
      <circle cx="18" cy="17" r="1.300" {...fill} />
      <circle cx="16" cy="10" r="1.300" {...fill} />
    </Svg>
  ),
  stone: ({ size }) => (
    <Svg size={size}>
      <path d="M3 18 7 9l5-3 6 3 3 9-8 2z" />
      <path d="M7 9l5 4 6-4M12 13l1 7" />
    </Svg>
  ),
  knowledge: ({ size }) => (
    <Svg size={size}>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </Svg>
  ),
  people: ({ size }) => (
    <Svg size={size}>
      <circle cx="12" cy="7" r="3.200" />
      <path d="M5 21a7 7 0 0 1 14 0z" />
    </Svg>
  ),
  pause: ({ size }) => (
    <Svg size={size}>
      <rect x="6" y="5" width="4" height="14" rx="1" {...fill} />
      <rect x="14" y="5" width="4" height="14" rx="1" {...fill} />
    </Svg>
  ),
  play: ({ size }) => (
    <Svg size={size}>
      <path d="M7 4.500v15l13-7.500z" {...fill} />
    </Svg>
  ),
  rotate: ({ size }) => (
    <Svg size={size}>
      <path d="M20 12a8 8 0 1 1-2.400-5.700" />
      <path d="M20 4v5h-5" />
    </Svg>
  ),
  check: ({ size }) => (
    <Svg size={size}>
      <path d="M5 12.500l4.500 4.500L19 7" strokeWidth="2.600" />
    </Svg>
  ),
  next: ({ size }) => (
    <Svg size={size}>
      <path d="M5 12h13M13 6l6 6-6 6" strokeWidth="2.200" />
    </Svg>
  ),
  close: ({ size }) => (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6 6 18" strokeWidth="2.400" />
    </Svg>
  ),
  home: ({ size }) => (
    <Svg size={size}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
    </Svg>
  ),
  layers: ({ size }) => (
    <Svg size={size}>
      <path d="m12 4 9 5-9 5-9-5z" />
      <path d="m3 14 9 5 9-5" />
    </Svg>
  ),
  fire: ({ size }) => (
    <Svg size={size}>
      <path d="M12 3c1 4 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.500 2 2-.5-3 0-6 1-8Z" {...fill} />
    </Svg>
  ),
  flood: ({ size }) => (
    <Svg size={size}>
      <path d="M3 9c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
      <path d="M3 14c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
      <path d="M3 19c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
    </Svg>
  ),
  quake: ({ size }) => (
    <Svg size={size}>
      <path d="M3 12h3l2-6 3 12 3-9 2 3h5" />
    </Svg>
  ),
  ash: ({ size }) => (
    <Svg size={size}>
      <path d="M4 20 10 8h4l6 12z" />
      <path d="M12 8V3M9 5l-2-2M15 5l2-2" />
      <path d="M4 22h16" strokeDasharray="1 3" />
    </Svg>
  ),
  speaker: ({ size }) => (
    <Svg size={size}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11" />
    </Svg>
  ),
  speakerOff: ({ size }) => (
    <Svg size={size}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </Svg>
  ),
  skull: ({ size }) => (
    <Svg size={size}>
      <path d="M12 3a8 8 0 0 0-8 8c0 3 1.500 4.500 3 5.500V20h10v-3.500c1.500-1 3-2.500 3-5.500a8 8 0 0 0-8-8Z" />
      <circle cx="9" cy="11" r="1.600" {...fill} />
      <circle cx="15" cy="11" r="1.600" {...fill} />
    </Svg>
  ),
  help: ({ size }) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01" />
    </Svg>
  ),
  eye: ({ size }) => (
    <Svg size={size}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  trash: ({ size }) => (
    <Svg size={size}>
      <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" />
    </Svg>
  ),
  wrench: ({ size }) => (
    <Svg size={size}>
      <path d="M14 6a4 4 0 0 0 5 5l-9 9a2.100 2.100 0 0 1-3-3l9-9a4 4 0 0 0-2-2Z" />
    </Svg>
  ),
  shield: ({ size }) => (
    <Svg size={size}>
      <path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z" />
    </Svg>
  ),
  lock: ({ size }) => (
    <Svg size={size}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  ),
  star: ({ size }) => (
    <Svg size={size}>
      <path
        d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"
        {...fill}
      />
    </Svg>
  ),
  // buildings
  hearth: ({ size }) => (
    <Svg size={size}>
      <path
        d="M12 3c.8 3 4 4 4 8a4 4 0 0 1-8 0c0-1.500.7-2.500 1.500-3.300.2 1.300.9 1.800 1.700 1.800C10.800 7 11 5 12 3Z"
        {...fill}
      />
      <path d="M4 20h16M6 20l2-3h8l2 3" />
    </Svg>
  ),
  farm: ({ size }) => (
    <Svg size={size}>
      <path d="M3 18 6 9h12l3 9z" />
      <path d="M8 18l1.500-9M12 18V9M16 18l-1.500-9" />
      <path d="M12 3v3M9 4l1 2M15 4l-1 2" />
    </Svg>
  ),
  lumber_camp: ({ size }) => (
    <Svg size={size}>
      <path d="M5 20 14 7" />
      <path d="M13 4c3-1.500 6 0 7 3l-5 1-2-2z" {...fill} />
      <rect x="4" y="18" width="9" height="3" rx="1.500" />
    </Svg>
  ),
  quarry: ({ size }) => (
    <Svg size={size}>
      <path d="M4 20 11 8" />
      <path d="M8 6c4-3 9-2 12 2-4 0-8 1-10 4z" {...fill} />
      <path d="M13 20h8M16 17l5 3" />
    </Svg>
  ),
  cottage: ({ size }) => (
    <Svg size={size}>
      <path d="M3 12 12 4l9 8" />
      <path d="M5 11v9h14v-9" />
      <rect x="10" y="14" width="4" height="6" />
    </Svg>
  ),
  workshop: ({ size }) => (
    <Svg size={size}>
      <path d="M4 20V10l8-5 8 5v10" />
      <path d="M9 20v-6h6v6" />
      <path d="M12 3v3" />
    </Svg>
  ),
  archive: ({ size }) => (
    <Svg size={size}>
      <path d="M3 9 12 4l9 5" />
      <path d="M5 9v10M9.500 9v10M14.500 9v10M19 9v10M3 20h18" />
    </Svg>
  ),
  seed_vault: ({ size }) => (
    <Svg size={size}>
      <path d="M4 20a8 8 0 0 1 16 0z" />
      <path d="M12 12V8" />
      <path
        d="M12 8c-2.500 0-3.500-1.500-3.500-3.500 2.500 0 3.500 1 3.500 3.500Zm0 0c2.500 0 3.500-1.500 3.500-3.500-2.500 0-3.500 1-3.500 3.500Z"
        {...fill}
      />
    </Svg>
  ),
  granary: ({ size }) => (
    <Svg size={size}>
      <path d="M6 20V10c0-3 3-5 6-5s6 2 6 5v10" />
      <path d="M4 20h16M9 12h6M9 16h6" />
    </Svg>
  ),
  firebreak: ({ size }) => (
    <Svg size={size}>
      <path d="M3 17h18" />
      <path d="M3 13h18" strokeDasharray="2 3" />
      <path d="M5 8c0-3 3-3 3-6M12 9c0-3 3-3 3-6" />
    </Svg>
  ),
  stone_house: ({ size }) => (
    <Svg size={size}>
      <path d="M3 12 12 4l9 8" />
      <path d="M5 11v9h14v-9M9 14h6M9 17h6" />
    </Svg>
  ),
  levee: ({ size }) => (
    <Svg size={size}>
      <path d="M3 18 8 9h8l5 9z" />
      <path d="M3 21c3-2 5 2 9 0s6 2 9 0" />
    </Svg>
  ),
  dam: ({ size }) => (
    <Svg size={size}>
      <path d="M4 5h16v14H4z" />
      <path d="M8 5v14M12 5v14M16 5v14" />
    </Svg>
  ),
  bridge: ({ size }) => (
    <Svg size={size}>
      <path d="M2 14h20M4 14v5M20 14v5" />
      <path d="M4 14a8 6 0 0 1 16 0" />
    </Svg>
  ),
  retaining_wall: ({ size }) => (
    <Svg size={size}>
      <path d="M3 20V9h18v11z" />
      <path d="M3 14h18M9 9v5M15 14v6" />
    </Svg>
  ),
  forge: ({ size }) => (
    <Svg size={size}>
      <path d="M4 20h16M6 20v-4h12v4" />
      <path d="M8 16c0-4 4-4 4-9 3 2 4 5 4 9" />
    </Svg>
  ),
  grove: ({ size }) => (
    <Svg size={size}>
      <path d="M12 3 6 13h4l-4 6h12l-4-6h4z" />
      <path d="M12 19v3" />
    </Svg>
  ),
};

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const f = ICONS[name];
  return <span className="icon">{f ? f({ size }) : null}</span>;
}

export const RESOURCE_ICON: Record<ResourceKey | 'people', string> = {
  food: 'food',
  timber: 'timber',
  stone: 'stone',
  knowledge: 'knowledge',
  people: 'people',
};

export function buildingIcon(kind: BuildingKind): string {
  return kind;
}

export function hazardIcon(kind: HazardKind): string {
  return kind;
}
