/**
 * Small pure helpers for framing the 3D scene. Kept free of Three.js and the DOM
 * so they can be unit-tested without a renderer.
 */

/** Aspect ratio for a viewport, guarding against a zero-height container. */
export function aspectRatio(width: number, height: number): number {
  if (height <= 0) return 1;
  return width / height;
}

/**
 * Camera distance (along the view direction) needed to just fit a subject of
 * `subjectHeight` within the vertical field of view `fovDegrees`.
 *
 * Derived from: tan(fov / 2) = (subjectHeight / 2) / distance
 */
export function orbitRadius(fovDegrees: number, subjectHeight: number): number {
  const halfFov = (fovDegrees * Math.PI) / 180 / 2;
  return subjectHeight / 2 / Math.tan(halfFov);
}
