export const TAU = Math.PI * 2;

export const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
export const boxAt = (x, y, hw, hh) => ({ x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh });
