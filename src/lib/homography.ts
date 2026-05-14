export type Point = { x: number; y: number };

/** Homography (3×3) with h22 = 1, as nested arrays. */
export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

/**
 * Maps each src[i] to dst[i] (four corners). Uses h22 = 1 and Gaussian elimination.
 * Order: top-left, top-right, bottom-right, bottom-left.
 */
export function homographyFromFourPoints(
  src: Point[],
  dst: Point[],
): Mat3 | null {
  if (src.length !== 4 || dst.length !== 4) return null;

  // Unknowns: h00 h01 h02 h10 h11 h12 h20 h21, with h22 = 1.
  // u = (h00*x + h01*y + h02) / (h20*x + h21*y + 1)
  // v = (h10*x + h11*y + h12) / (h20*x + h21*y + 1)
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const sol = solveLinearSystem(A, b);
  if (!sol) return null;

  const [h00, h01, h02, h10, h11, h12, h20, h21] = sol;
  return [
    [h00, h01, h02],
    [h10, h11, h12],
    [h20, h21, 1],
  ];
}

export function applyHomography(H: Mat3, x: number, y: number): Point {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  if (Math.abs(w) < 1e-12) return { x, y };
  return {
    x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  };
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const m = A[0].length;
  if (n !== m || n !== b.length) return null;

  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < m; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const div = M[col][col];
    for (let c = col; c <= m; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-15) continue;
      for (let c = col; c <= m; c++) M[r][c] -= f * M[col][c];
    }
  }

  return M.map((row) => row[m]);
}

/** Solve dx = a*sx + c*sy + e, dy = b*sx + d*sy + f for three point pairs. */
function affineFromTriangle(
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
): [number, number, number, number, number, number] | null {
  const sx = solve3x3(
    s0.x,
    s0.y,
    1,
    s1.x,
    s1.y,
    1,
    s2.x,
    s2.y,
    1,
    d0.x,
    d1.x,
    d2.x,
  );
  const sy = solve3x3(
    s0.x,
    s0.y,
    1,
    s1.x,
    s1.y,
    1,
    s2.x,
    s2.y,
    1,
    d0.y,
    d1.y,
    d2.y,
  );
  if (!sx || !sy) return null;
  return [sx[0], sy[0], sx[1], sy[1], sx[2], sy[2]];
}

function solve3x3(
  a00: number,
  a01: number,
  a02: number,
  a10: number,
  a11: number,
  a12: number,
  a20: number,
  a21: number,
  a22: number,
  b0: number,
  b1: number,
  b2: number,
): [number, number, number] | null {
  const A = [
    [a00, a01, a02, b0],
    [a10, a11, a12, b1],
    [a20, a21, a22, b2],
  ];
  const n = 3;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const t = A[col];
      A[col] = A[pivot];
      A[pivot] = t;
    }
    const div = A[col][col];
    for (let c = col; c <= n; c++) A[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (Math.abs(f) < 1e-15) continue;
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  return [A[0][3], A[1][3], A[2][3]];
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
) {
  const t = affineFromTriangle(s0, s1, s2, d0, d1, d2);
  if (!t) return;
  const [a, b, c, d, e, f] = t;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export interface DisplacementOptions {
  map: HTMLImageElement | HTMLCanvasElement;
  strength: number;
  productWidth: number;
  productHeight: number;
}

/**
 * Generates a proper displacement map from an image using the green channel.
 * Based on professional Photoshop technique: isolate green channel, enhance, blur.
 */
export function generateDisplacementMap(
  img: HTMLImageElement,
): HTMLCanvasElement | null {
  if (!img.complete || img.naturalWidth === 0) return null;

  const canvas = document.createElement("canvas");
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Extract green channel (usually has best shadow/highlight range)
  for (let i = 0; i < data.length; i += 4) {
    const green = data[i + 1];
    data[i] = green;
    data[i + 1] = green;
    data[i + 2] = green;
  }

  ctx.putImageData(imageData, 0, 0);

  // Apply Gaussian blur to prevent pixel-level distortion
  ctx.filter = "blur(3px)";
  const temp = ctx.getImageData(0, 0, w, h);
  ctx.filter = "none";
  ctx.putImageData(temp, 0, 0);

  return canvas;
}

/**
 * Adjust a displacement map with Photoshop-style Levels control
 * @param baseMap - The base displacement map to adjust
 * @param invert - Invert the displacement (black<->white)
 * @param inputBlack - Input black point (0-255)
 * @param inputWhite - Input white point (0-255)
 * @param gamma - Midtones/gamma adjustment (0.1-10, default 1.0)
 */
export function adjustDisplacementMap(
  baseMap: HTMLCanvasElement,
  invert: boolean,
  inputBlack: number,
  inputWhite: number,
  gamma: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = baseMap.width;
  canvas.height = baseMap.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return baseMap;

  ctx.drawImage(baseMap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Ensure inputBlack < inputWhite
  const inBlack = Math.min(inputBlack, inputWhite - 1);
  const inWhite = Math.max(inputWhite, inputBlack + 1);
  const range = inWhite - inBlack;

  for (let i = 0; i < data.length; i += 4) {
    let val = data[i];
    
    // 1. Clamp to input range
    val = Math.max(inBlack, Math.min(inWhite, val));
    
    // 2. Normalize to [0, 1]
    let normalized = (val - inBlack) / range;
    
    // 3. Apply gamma (midtones adjustment)
    normalized = Math.pow(normalized, 1 / gamma);
    
    // 4. Scale back to [0, 255]
    val = normalized * 255;
    
    // 5. Apply invert if needed
    if (invert) {
      val = 255 - val;
    }
    
    // Clamp final value
    val = Math.max(0, Math.min(255, val));
    
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function sampleDisplacement(
  dispMap: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  productWidth: number,
  productHeight: number,
  tempCanvas: HTMLCanvasElement,
  tempCtx: CanvasRenderingContext2D,
): { dx: number; dy: number } {
  const w = dispMap.width;
  const h = dispMap.height;
  if (w <= 0 || h <= 0) return { dx: 0, dy: 0 };

  // Map from display coordinates to displacement map coordinates
  const mapX = (x / productWidth) * w;
  const mapY = (y / productHeight) * h;

  const px = Math.max(0, Math.min(w - 1, Math.floor(mapX)));
  const py = Math.max(0, Math.min(h - 1, Math.floor(mapY)));

  if (tempCanvas.width !== w || tempCanvas.height !== h) {
    tempCanvas.width = w;
    tempCanvas.height = h;
    tempCtx.drawImage(dispMap, 0, 0);
  }

  const data = tempCtx.getImageData(px, py, 1, 1).data;
  const luminance = (data[0] * 0.299 + data[1] * 0.587 + data[2] * 0.114) / 255;

  return {
    dx: (luminance - 0.5) * 2,
    dy: (luminance - 0.5) * 2,
  };
}

/**
 * Draws `img` warped so its corners map to `dstQuad` (TL, TR, BR, BL) using a mesh.
 * Optionally applies displacement mapping for surface texture conformance.
 */
export function drawWarpedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  dstQuad: Point[],
  grid = 24,
  displacement?: DisplacementOptions,
) {
  if (dstQuad.length !== 4) return;
  const w = img.width;
  const h = img.height;
  if (w <= 0 || h <= 0) return;

  const src: Point[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const H = homographyFromFourPoints(src, dstQuad);
  if (!H) return;

  const gx = Math.max(2, grid);
  const gy = Math.max(2, grid);

  let tempCanvas: HTMLCanvasElement | null = null;
  let tempCtx: CanvasRenderingContext2D | null = null;

  if (displacement && displacement.strength > 0) {
    tempCanvas = document.createElement("canvas");
    tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    if (tempCtx) {
      tempCanvas.width = displacement.map.width;
      tempCanvas.height = displacement.map.height;
      tempCtx.drawImage(displacement.map, 0, 0);
    }
  }

  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      const u0 = (i / gx) * w;
      const u1 = ((i + 1) / gx) * w;
      const v0 = (j / gy) * h;
      const v1 = ((j + 1) / gy) * h;

      const stl = { x: u0, y: v0 };
      const str = { x: u1, y: v0 };
      const sbr = { x: u1, y: v1 };
      const sbl = { x: u0, y: v1 };

      let dtl = applyHomography(H, stl.x, stl.y);
      let dtr = applyHomography(H, str.x, str.y);
      let dbr = applyHomography(H, sbr.x, sbr.y);
      let dbl = applyHomography(H, sbl.x, sbl.y);

      if (displacement && displacement.strength > 0 && tempCanvas && tempCtx) {
        const dispTL = sampleDisplacement(
          displacement.map,
          dtl.x,
          dtl.y,
          displacement.productWidth,
          displacement.productHeight,
          tempCanvas,
          tempCtx,
        );
        const dispTR = sampleDisplacement(
          displacement.map,
          dtr.x,
          dtr.y,
          displacement.productWidth,
          displacement.productHeight,
          tempCanvas,
          tempCtx,
        );
        const dispBR = sampleDisplacement(
          displacement.map,
          dbr.x,
          dbr.y,
          displacement.productWidth,
          displacement.productHeight,
          tempCanvas,
          tempCtx,
        );
        const dispBL = sampleDisplacement(
          displacement.map,
          dbl.x,
          dbl.y,
          displacement.productWidth,
          displacement.productHeight,
          tempCanvas,
          tempCtx,
        );

        dtl = {
          x: dtl.x + dispTL.dx * displacement.strength,
          y: dtl.y + dispTL.dy * displacement.strength,
        };
        dtr = {
          x: dtr.x + dispTR.dx * displacement.strength,
          y: dtr.y + dispTR.dy * displacement.strength,
        };
        dbr = {
          x: dbr.x + dispBR.dx * displacement.strength,
          y: dbr.y + dispBR.dy * displacement.strength,
        };
        dbl = {
          x: dbl.x + dispBL.dx * displacement.strength,
          y: dbl.y + dispBL.dy * displacement.strength,
        };
      }

      drawTexturedTriangle(ctx, img, stl, str, sbl, dtl, dtr, dbl);
      drawTexturedTriangle(ctx, img, str, sbr, sbl, dtr, dbr, dbl);
    }
  }
}
