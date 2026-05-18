import { useState } from "react";
import {
  defaultVisualizerProducts,
  ProductVisualizer,
  visualizerDefaults,
} from "../ProductVisualizer";

export function ProductVisualizerPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedProduct = defaultVisualizerProducts[selectedIndex];
  const productDefaultStrength =
    selectedProduct.displacementStrength ?? visualizerDefaults.displacementStrength;
  const productDefaultBlend =
    selectedProduct.blendMode ?? visualizerDefaults.blendMode;
  const productDefaultOpacity =
    selectedProduct.opacity ?? visualizerDefaults.opacity;

  const [strength, setStrength] = useState(productDefaultStrength);
  const [blendMode, setBlendMode] = useState(productDefaultBlend);
  const [opacity, setOpacity] = useState(productDefaultOpacity);
  const [showHandles, setShowHandles] = useState(true);

  return (
    <div className="mx-auto w-full max-w-3xl p-7 pb-12">
      <h1 className="mb-2 text-3xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
        Product Visualizer
      </h1>
      <p className="mb-7 text-gray-600 dark:text-gray-400">
        Drag the handles to position and warp the art. Corner handles skew,
        center handle moves.
      </p>

      {/* Controls */}
      <div className="mb-5 space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">

        {/* Product selector */}
        <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Product
            </label>
            <select
              value={selectedIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setSelectedIndex(idx);
                const p = defaultVisualizerProducts[idx];
                setStrength(p.displacementStrength ?? visualizerDefaults.displacementStrength);
                setBlendMode(p.blendMode ?? visualizerDefaults.blendMode);
                setOpacity(p.opacity ?? visualizerDefaults.opacity);
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {defaultVisualizerProducts.map((p, i) => (
                <option key={p.productName} value={i}>
                  {p.productName}
                </option>
              ))}
            </select>
          </div>

        {/* Displacement strength */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-900 dark:text-gray-100">
            <span>Displacement (fold warp)</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400">
              {strength}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="w-full"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            0 = flat, higher = art follows wrinkles more. Default:{" "}
            {productDefaultStrength}
          </p>
        </div>

        {/* Blend mode */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Blend mode
          </label>
          <select
            value={blendMode}
              onChange={(e) => setBlendMode(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply (absorbs fabric color)</option>
            <option value="screen">Screen (lightens)</option>
            <option value="overlay">Overlay</option>
            <option value="soft-light">Soft Light</option>
            <option value="hard-light">Hard Light</option>
            <option value="darken">Darken</option>
            <option value="lighten">Lighten</option>
          </select>
        </div>

        {/* Opacity */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-900 dark:text-gray-100">
            <span>Art opacity</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400">
              {opacity}%
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Reset + Handles */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 select-none dark:text-gray-300">
            <input
              type="checkbox"
              checked={showHandles}
              onChange={(e) => setShowHandles(e.target.checked)}
              className="h-4 w-4"
            />
            Show handles
          </label>
          <button
            type="button"
            onClick={() => {
              setStrength(productDefaultStrength);
              setBlendMode(productDefaultBlend);
              setOpacity(productDefaultOpacity);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* Visualizer */}
      <ProductVisualizer
        product={selectedProduct}
        strength={strength}
        blendMode={blendMode}
        opacity={opacity}
        showHandles={showHandles}
      />
    </div>
  );
}
