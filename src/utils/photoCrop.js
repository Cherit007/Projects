export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const calculateDrawParams = ({
  imgWidth,
  imgHeight,
  canvasSize,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) => {
  const safeWidth = Math.max(1, imgWidth || 1);
  const safeHeight = Math.max(1, imgHeight || 1);
  const baseScale = Math.max(canvasSize / safeWidth, canvasSize / safeHeight);
  const scale = baseScale * zoom;

  const drawWidth = safeWidth * scale;
  const drawHeight = safeHeight * scale;

  const maxOffsetX = Math.max(0, (drawWidth - canvasSize) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - canvasSize) / 2);

  const boundedOffsetX = clamp(offsetX, -maxOffsetX, maxOffsetX);
  const boundedOffsetY = clamp(offsetY, -maxOffsetY, maxOffsetY);

  const x = (canvasSize - drawWidth) / 2 + boundedOffsetX;
  const y = (canvasSize - drawHeight) / 2 + boundedOffsetY;

  return {
    x,
    y,
    drawWidth,
    drawHeight,
    maxOffsetX,
    maxOffsetY,
    boundedOffsetX,
    boundedOffsetY,
  };
};
