import { clamp, calculateDrawParams } from '../utils/photoCrop';

describe('photo crop utils', () => {
  it('clamps values in range', () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-2, 0, 5)).toBe(0);
    expect(clamp(3, 0, 5)).toBe(3);
  });

  it('calculates draw params and bounds offsets', () => {
    const params = calculateDrawParams({
      imgWidth: 800,
      imgHeight: 400,
      canvasSize: 200,
      zoom: 1,
      offsetX: 999,
      offsetY: -999,
    });

    expect(params.drawWidth).toBeGreaterThanOrEqual(200);
    expect(params.drawHeight).toBeGreaterThanOrEqual(200);
    expect(Math.abs(params.boundedOffsetX)).toBeLessThanOrEqual(params.maxOffsetX + 0.01);
    expect(Math.abs(params.boundedOffsetY)).toBeLessThanOrEqual(params.maxOffsetY + 0.01);
  });
});
