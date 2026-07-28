export type SpeedTestVibe = 'organism' | 'race' | 'storm' | 'sound' | 'launch';
export type SpeedTestSample = { at: string; bps: number };
export type SpeedTestPhase = 'idle' | 'running' | 'complete';
export type SpeedTestLive = {
  state: string;
  bytesTransferred: number;
  downloadBps: number | null;
  startedAt?: string | null;
  updatedAt?: string;
  samples: SpeedTestSample[];
};
export type SpeedTestSceneProps = {
  phase: SpeedTestPhase;
  mbps: number;
  bytesTransferred: number;
  elapsedMs: number;
  samples: SpeedTestSample[];
  soundEnabled: boolean;
  theme: SpeedTestTheme;
};
export type SpeedTestTheme = {
  canvas: string;
  canvasRaised: string;
  panel: string;
  panelStrong: string;
  control: string;
  selected: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentStrong: string;
  telemetry: string;
  warning: string;
  critical: string;
};
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return hex;
  const number = Number.parseInt(value, 16);
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`;
}
export const speedTestVibes: Array<{
  id: SpeedTestVibe;
  name: string;
  hook: string;
  glyph: string;
}> = [
  { id: 'organism', name: 'Organism', hook: 'Feel the connection breathe', glyph: '◉' },
  { id: 'race', name: 'Race', hook: 'Watch packets fight to finish', glyph: '↠' },
  { id: 'storm', name: 'Storm', hook: 'Turn bandwidth into weather', glyph: 'ϟ' },
  { id: 'sound', name: 'Sound', hook: 'Let the network compose', glyph: '∿' },
  { id: 'launch', name: 'Launch', hook: 'Push past escape velocity', glyph: '↥' },
];
