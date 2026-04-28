
import { VisionOperation } from '../types';

/**
 * Basic image processing algorithms implemented for demo purposes
 */

export function getBinaryData(pixels: Uint8ClampedArray, width: number, height: number, threshold: number): number[][] {
  const binary: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      row.push(gray > threshold ? 1 : 0);
    }
    binary.push(row);
  }
  return binary;
}

export function applyMorphology(
  data: number[][], 
  op: VisionOperation, 
  kernelSize: number
): number[][] {
  const height = data.length;
  const width = data[0].length;
  const result: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
  const offset = Math.floor(kernelSize / 2);

  if (op === VisionOperation.OPENING) {
    const eroded = applyMorphology(data, VisionOperation.EROSION, kernelSize);
    return applyMorphology(eroded, VisionOperation.DILATION, kernelSize);
  }
  if (op === VisionOperation.CLOSING) {
    const dilated = applyMorphology(data, VisionOperation.DILATION, kernelSize);
    return applyMorphology(dilated, VisionOperation.EROSION, kernelSize);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let isErosion = (op === VisionOperation.EROSION);
      let match = isErosion;
      
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const val = data[ny][nx];
            if (isErosion) {
              if (val === 0) match = false;
            } else {
              if (val === 1) match = true;
            }
          } else if (isErosion) {
            match = false; 
          }
        }
      }
      result[y][x] = match ? 1 : 0;
    }
  }

  return result;
}

export function skeletonizeStep(data: number[][]): { grid: number[][], changed: boolean } {
  let grid = data.map(row => [...row]);
  let changed = false;
  const toRemove: { x: number; y: number }[] = [];

  for (let step = 1; step <= 2; step++) {
    for (let y = 1; y < grid.length - 1; y++) {
      for (let x = 1; x < grid[y].length - 1; x++) {
        if (grid[y][x] === 0) continue;

        const p2 = grid[y-1][x], p3 = grid[y-1][x+1], p4 = grid[y][x+1], p5 = grid[y+1][x+1],
              p6 = grid[y+1][x], p7 = grid[y+1][x-1], p8 = grid[y][x-1], p9 = grid[y-1][x-1];

        const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        const transitions = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) +
                            (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
                            (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) +
                            (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);

        if (neighbors >= 2 && neighbors <= 6 && transitions === 1) {
          if (step === 1) {
            if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
              toRemove.push({ x, y });
              changed = true;
            }
          } else {
            if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
              toRemove.push({ x, y });
              changed = true;
            }
          }
        }
      }
    }
    for (const p of toRemove) grid[p.y][p.x] = 0;
    toRemove.length = 0;
  }
  return { grid, changed };
}

export function skeletonize(data: number[][]): number[][] {
  let current = data;
  for (let i = 0; i < 100; i++) {
    const { grid, changed } = skeletonizeStep(current);
    if (!changed) return grid;
    current = grid;
  }
  return current;
}

export function getPointsFromBinary(data: number[][]): {x: number, y: number}[] {
  const points: {x: number, y: number}[] = [];
  for (let y = 0; y < data.length; y++) {
    for (let x = 0; x < data[y].length; x++) {
      if (data[y][x] === 1) points.push({ x, y });
    }
  }
  return points;
}

export function drawHullOnGrid(hull: {x: number, y: number}[], width: number, height: number): number[][] {
  const grid = Array.from({ length: height }, () => Array(width).fill(0));
  if (hull.length < 2) return grid;

  const drawLine = (p1: any, p2: any) => {
    let x1 = Math.round(p1.x), y1 = Math.round(p1.y);
    let x2 = Math.round(p2.x), y2 = Math.round(p2.y);
    let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    let sx = (x1 < x2) ? 1 : -1, sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) grid[y1][x1] = 1;
      if (x1 === x2 && y1 === y2) break;
      let e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x1 += sx; }
      if (e2 < dx) { err += dx; y1 += sy; }
    }
  };

  for (let i = 0; i < hull.length; i++) {
    drawLine(hull[i], hull[(i + 1) % hull.length]);
  }
  return grid;
}

export function getConvexHull(points: { x: number, y: number }[]): { x: number, y: number }[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  const upper: { x: number, y: number }[] = [];
  for (const p of sorted) {
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  const lower: { x: number, y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  upper.pop();
  lower.pop();
  return upper.concat(lower);
}

export function detectCorners(data: number[][]): {x: number, y: number}[] {
  const height = data.length;
  const width = data[0].length;
  const corners: {x: number, y: number}[] = [];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (data[y][x] === 0) continue;
      
      const p2 = data[y-1][x], p4 = data[y][x+1], p6 = data[y+1][x], p8 = data[y][x-1];
      const p1 = data[y-1][x-1], p3 = data[y-1][x+1], p5 = data[y+1][x+1], p7 = data[y+1][x-1];
      
      const neighbors = p1+p2+p3+p4+p5+p6+p7+p8;
      
      // Simple corner: foreground pixel with few-ish neighbors
      if (neighbors >= 2 && neighbors <= 4) {
        corners.push({ x, y });
      }
    }
  }
  return corners;
}

function crossProduct(a: any, b: any, c: any) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
