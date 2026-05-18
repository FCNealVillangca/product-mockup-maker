import type { VisualizerProduct } from "./types";

/** Base path for bundled mockup assets (under `public/`). */
export const VISUALIZER_ASSET_BASE = "/assets/tshirt";

export const visualizerDefaults = {
  assetBase: VISUALIZER_ASSET_BASE,
  /**
   * Displacement strength. 0 = off, higher = more fold warp.
   * Range used in ProductRenderer is 0–50; ~20 gives a clear visible effect.
   */
  displacementStrength: 20,
  /** Art opacity 0–100. */
  opacity: 100,
  blendMode: "normal",
};

/** Default product list — add more entries when you have more mockup assets. */
export const defaultVisualizerProducts: VisualizerProduct[] = [
  {
    productName: "White t-shirt",
    bg: { url: `${VISUALIZER_ASSET_BASE}/bg.jpg` },
    displacement: `${VISUALIZER_ASSET_BASE}/displacement.png`,
    displacementStrength: 10,
    blendMode: "multiply",
    opacity: 70,
    art: {
      url: `${VISUALIZER_ASSET_BASE}/art.png`,
      quad: [
        [0.3456, 0.2],
        [0.7256, 0.2],
        [0.7256, 0.58],
        [0.3456, 0.58],
      ],
    },
  },
  {
    productName: "Hoodie",
    bg: { url: "/assets/hoodie/bg.jpg" },
    displacement: "/assets/hoodie/displacement.png",
    displacementStrength: 10,
    blendMode: "normal",
    opacity: 70,
    art: {
      url: `${VISUALIZER_ASSET_BASE}/art.png`,
      quad: [
        [0.2535, 0.1826],
        [0.6538, 0.1517],
        [0.6903, 0.5351],
        [0.3195, 0.5857],
      ],
    },
  },
  {
    productName: "Car sticker",
    bg: { url: "/assets/carsticker/bg.jpg" },
    displacement: "/assets/carsticker/displacement.png",
    displacementStrength: 5,
    blendMode: "multiply",
    opacity: 70,
    art: {
      url: `${VISUALIZER_ASSET_BASE}/art.png`,
      quad: [
        [0.5527, 0.2191],
        [0.9909, 0.3062],
        [0.568, 0.57],
        [0.1383, 0.4256],
      ],
    },
  },
  {
    productName: "Mug",
    bg: { url: "/assets/mug/bg.jpg" },
    displacement: "/assets/mug/displacement.png",
    displacementStrength: 3,
    blendMode: "multiply",
    opacity: 80,
    art: {
      url: `${VISUALIZER_ASSET_BASE}/art.png`,
      quad: [
        [0.3153, 0.493],
        [0.7718, 0.4916],
        [0.7102, 0.8217],
        [0.3902, 0.8217],
      ],
    },
  },
];
