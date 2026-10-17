export function lensGeometry(width: number, height: number, progress: number, zoom = 2) {
  // A narrow screenshot/banner must not shrink the lens to an invisible dot.
  // On images thinner than 48px it may overhang that axis, with preview padding.
  const diameter = Math.min(104, Math.max(48, Math.min(width * .38, height * .55)));
  const radius = diameter / 2;
  const x = width <= diameter ? width / 2 : radius + (width - diameter) * (.5 + .46 * Math.sin(progress));
  const y = height <= diameter ? height / 2 : radius + (height - diameter) * (.5 + .46 * Math.sin(progress * 1.7 + .5));
  return {diameter, x, y, backgroundX: radius - x * zoom, backgroundY: radius - y * zoom, backgroundWidth: width * zoom, backgroundHeight: height * zoom};
}
