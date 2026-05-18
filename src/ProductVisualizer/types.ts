/** Normalized placement rect on the product: x, y, width, height (0–1). */
export type ArtPosition = [number, number, number, number];

/** Full quad: [TL, TR, BR, BL] each as [x, y] (0–1). Use instead of position for skewed shapes. */
export type ArtQuad = [[number,number],[number,number],[number,number],[number,number]];

export type VisualizerProduct = {
  productName: string;
  bg: { url: string };
  /** PNG used as both the displacement (fold) map and the clip mask via its alpha channel. */
  displacement: string;
  /** Optional separate clip mask. If omitted, displacement alpha is used instead. */
  clipping?: { url: string; color?: string };
  /** Per-product default displacement strength. Overrides global default; slider overrides this. */
  displacementStrength?: number;
  /** Per-product default blend mode (CSS mix-blend-mode values). Overrides global default; selector overrides this. */
  blendMode?: string;
  /** Per-product default opacity 0–100. */
  opacity?: number;
  art: {
    url: string;
    /** Simple rect [x, y, w, h]. Use quad instead for skewed/perspective shapes. */
    position?: ArtPosition;
    /** Full 4-corner quad (TL, TR, BR, BL). Takes priority over position. */
    quad?: ArtQuad;
  };
};
