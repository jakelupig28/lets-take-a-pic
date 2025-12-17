import { AnimationType, FilterType, FrameColor, GridType } from "./types";

export const DEFAULT_CONFIG = {
  timerDuration: 3,
  gridType: GridType.GRID_2X2, // Default to Grid 2x2 as requested
  filterType: FilterType.NORMAL,
  frameColor: FrameColor.WHITE,
  animationType: AnimationType.NONE,
};

export const GRID_CONFIGS: Record<GridType, { count: number; label: string; aspectRatio: number }> = {
  [GridType.SINGLE]: { count: 1, label: "Single", aspectRatio: 4/3 }, // Landscape
  [GridType.STRIP_3]: { count: 3, label: "Strip (3)", aspectRatio: 3/4 }, // Portrait
  [GridType.STRIP_4]: { count: 4, label: "Strip (4)", aspectRatio: 3/4 }, // Portrait
  [GridType.GRID_2X2]: { count: 4, label: "Grid 2x2", aspectRatio: 4/3 }, // Landscape
};

export const FILTERS = [
  { label: 'Normal', value: FilterType.NORMAL },
  { label: 'B&W', value: FilterType.GRAYSCALE },
  { label: 'Sepia', value: FilterType.SEPIA },
  { label: 'Vintage', value: FilterType.VINTAGE },
  { label: 'Soft', value: FilterType.SOFT },
  { label: 'Retro', value: FilterType.RETRO },
  { label: 'Cyberpunk', value: FilterType.CYBERPUNK },
  { label: 'Dreamy', value: FilterType.DREAMY },
];

export const ANIMATIONS = [
  { label: 'None', value: AnimationType.NONE },
  { label: 'Breathe', value: AnimationType.BREATHE },
  { label: 'Rainbow', value: AnimationType.RAINBOW },
  { label: 'Flicker', value: AnimationType.FLICKER },
  { label: 'Wobble', value: AnimationType.WOBBLE },
  { label: 'Glow', value: AnimationType.GLOW },
  { label: 'Pulse', value: AnimationType.PULSE },
];

export const FRAMES = [
  { label: 'White', value: FrameColor.WHITE, text: '#000000' },
  { label: 'Black', value: FrameColor.BLACK, text: '#FFFFFF' },
  { label: 'Cream', value: FrameColor.CREAM, text: '#000000' },
  { label: 'Blush', value: FrameColor.PINK, text: '#000000' },
  { label: 'Sky', value: FrameColor.BLUE, text: '#000000' },
  { label: 'Sage', value: FrameColor.SAGE, text: '#000000' },
  { label: 'Butter', value: FrameColor.BUTTER, text: '#000000' },
  { label: 'Lilac', value: FrameColor.LILAC, text: '#000000' },
];

export const TIMERS = [3, 5, 10];