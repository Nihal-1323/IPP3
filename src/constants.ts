
import { VisionOperation } from './types';

export const OPERATION_DESCRIPTIONS: Record<VisionOperation, string> = {
  [VisionOperation.EROSION]: "Erosion 'shrinks' or 'thins' foreground objects. A pixel in the original image (1 or 0) will be considered 1 only if all the pixels under the structuring element are 1. Otherwise, it is eroded (made 0).",
  [VisionOperation.DILATION]: "Dilation 'grows' or 'thickens' foreground objects. A pixel in the original image is considered 1 if at least one pixel under the structuring element is 1. This fills small holes and joins disconnected parts.",
  [VisionOperation.OPENING]: "Opening is an erosion followed by a dilation. It is used to remove noise (small bright spots) while preserving the general shape and size of larger objects.",
  [VisionOperation.CLOSING]: "Closing is a dilation followed by an erosion. It is useful for closing small holes inside foreground objects, or small black points on the object.",
  [VisionOperation.SKELETONIZATION]: "Skeletonization (or thinning) reduces shapes down to their topological skeletons. It iteratively removes boundary pixels that are not essential for maintaining connectivity.",
  [VisionOperation.CONVEX_HULL]: "The Convex Hull of a shape is the smallest convex set that contains it. Imagine stretching a rubber band around the shape.",
  [VisionOperation.CORNER_DETECTION]: "Corner detection identifies points where there are large intensity variations in all directions, making them stable landmarks for tracking."
};

export const CODE_SNIPPETS: Record<VisionOperation, { opencv: string; js: string }> = {
  [VisionOperation.EROSION]: {
    opencv: `kernel = np.ones((5,5), np.uint8)\nerosion = cv2.erode(img, kernel, iterations = 1)`,
    js: `// Simplified logic\nfor(let y=0; y<h; y++) {\n  for(let x=0; x<w; x++) {\n    if(!allNeighborsActive(x, y)) result[y][x] = 0;\n  }\n}`
  },
  [VisionOperation.DILATION]: {
    opencv: `kernel = np.ones((5,5), np.uint8)\ndilation = cv2.dilate(img, kernel, iterations = 1)`,
    js: `// Simplified logic\nfor(let y=0; y<h; y++) {\n  for(let x=0; x<w; x++) {\n    if(anyNeighborActive(x, y)) result[y][x] = 1;\n  }\n}`
  },
  [VisionOperation.OPENING]: {
    opencv: `kernel = np.ones((5,5), np.uint8)\nopening = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)`,
    js: `const eroded = erode(img, kernel);\nconst result = dilate(eroded, kernel);`
  },
  [VisionOperation.CLOSING]: {
    opencv: `kernel = np.ones((5,5), np.uint8)\nclosing = cv2.morphologyEx(img, cv2.MORPH_CLOSE, kernel)`,
    js: `const dilated = dilate(img, kernel);\nconst result = erode(dilated, kernel);`
  },
  [VisionOperation.SKELETONIZATION]: {
    opencv: `skeleton = cv2.ximgproc.thinning(img)`,
    js: `// Iterative thinning\nwhile(changed) {\n  for(let p of boundary) {\n    if(canRemove(p)) remove(p);\n  }\n}`
  },
  [VisionOperation.CONVEX_HULL]: {
    opencv: `hull = cv2.convexHull(contours)`,
    js: `const hull = monotoneChainScan(points);`
  },
  [VisionOperation.CORNER_DETECTION]: {
    opencv: `corners = cv2.goodFeaturesToTrack(gray, 25, 0.01, 10)`,
    js: `const response = computeHarrisResponse(img);\nconst kpts = nonMaxSuppression(response);`
  }
};
