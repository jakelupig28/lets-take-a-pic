export enum AppState {
  IDLE = 'IDLE',
  SETUP = 'SETUP',
  COUNTDOWN = 'COUNTDOWN',
  CAPTURE = 'CAPTURE', // The moment of taking the photo
  PROCESSING = 'PROCESSING', // Between shots
  RESULT = 'RESULT',
}

export enum FilterType {
  NORMAL = 'none',
  GRAYSCALE = 'grayscale(100%) contrast(110%)',
  SEPIA = 'sepia(50%) contrast(105%)',
  VINTAGE = 'sepia(30%) contrast(120%) brightness(90%)',
  SOFT = 'brightness(110%) saturate(85%) contrast(90%)',
  RETRO = 'contrast(110%) brightness(90%) sepia(30%) saturate(120%) hue-rotate(-10deg)',
  CYBERPUNK = 'contrast(115%) brightness(110%) saturate(180%) hue-rotate(190deg)',
  DREAMY = 'contrast(90%) brightness(110%) saturate(110%) sepia(20%)',
}

export enum AnimationType {
  NONE = 'none',
  BREATHE = 'breathe',
  RAINBOW = 'rainbow',
  FLICKER = 'flicker',
  WOBBLE = 'wobble',
  GLOW = 'glow',
  PULSE = 'pulse',
}

export enum MaskType {
  NONE = 'none',
  HEARTS = 'hearts',
  STARS = 'stars',
}

export enum GridType {
  SINGLE = '1x1',
  STRIP_3 = '1x3',
  STRIP_4 = '1x4',
  GRID_2X2 = '2x2',
}

export enum FrameColor {
  WHITE = '#FFFFFF',
  BLACK = '#1A1A1A',
  CREAM = '#F5F5F0',
  PINK = '#FFD1DC',
  BLUE = '#D1E8FF',
  SAGE = '#D3E4CD',
  BUTTER = '#FFF4BD',
  LILAC = '#E5D4EF',
}

export interface PhotoConfig {
  timerDuration: number; // seconds
  gridType: GridType;
  filterType: FilterType;
  frameColor: FrameColor;
  animationType: AnimationType;
  maskType: MaskType;
}

export interface CapturedImage {
  id: string;
  dataUrl: string; // Base64
}

export interface FaceData {
  x: number;
  y: number;
  width: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
}