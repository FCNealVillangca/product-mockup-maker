import { ProductVisualizerItem } from "./ProductVisualizerItem";
import type { VisualizerProduct } from "./types";

export type ProductVisualizerProps = {
  product: VisualizerProduct;
  /** Displacement fold strength (0–50). */
  strength?: number;
  /** Art opacity 0–100. */
  opacity?: number;
  /** CSS blend mode for the art layer. */
  blendMode?: string;
  /** Whether to show the drag handles and outline. */
  showHandles?: boolean;
  className?: string;
};

export function ProductVisualizer({
  product,
  strength,
  opacity,
  blendMode,
  showHandles,
  className = "",
}: ProductVisualizerProps) {
  return (
    <div className={`w-full ${className}`.trim()}>
      <ProductVisualizerItem
        key={product.productName}
        product={product}
        strength={strength}
        opacity={opacity}
        blendMode={blendMode}
        showHandles={showHandles}
      />
    </div>
  );
}
