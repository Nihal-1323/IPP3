
export enum VisionOperation {
  EROSION = 'Erosion',
  DILATION = 'Dilation',
  OPENING = 'Opening',
  CLOSING = 'Closing',
  SKELETONIZATION = 'Skeletonization',
  CONVEX_HULL = 'Convex Hull',
  CORNER_DETECTION = 'Corner Detection'
}

export interface PanelState {
  id: string;
  image: string | null;
  operation: VisionOperation;
  params: PanelParams;
  isPlaying: boolean;
  isComplete: boolean;
}

export interface PanelParams {
  kernelSize: number;
  threshold: number;
  scales: number;
  speed: number;
}

export interface MatrixData {
  before: number[][];
  after: number[][];
  kernel: number[][];
}
