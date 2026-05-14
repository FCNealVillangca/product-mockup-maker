import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { drawWarpedImage, generateDisplacementMap } from "./lib/homography";
import type { DisplacementOptions, Point } from "./lib/homography";

const DEFAULT_QUAD: Point[] = [
  { x: 0.32, y: 0.38 },
  { x: 0.68, y: 0.38 },
  { x: 0.68, y: 0.72 },
  { x: 0.32, y: 0.72 },
];

const quadToPixel = (quad: Point[], w: number, h: number): Point[] =>
  quad.map((p) => ({ x: p.x * w, y: p.y * h }));

export function ProductRenderer() {
  const [productUrl, setProductUrl] = useState<string | null>(
    "/defaultshirt.avif",
  );
  const [designUrl, setDesignUrl] = useState<string | null>("/design.png");
  const [useAutoDisplacement, setUseAutoDisplacement] = useState(true);
  const [displacementStrength, setDisplacementStrength] = useState(3);
  const [designOpacity, setDesignOpacity] = useState(100);
  const [blendMode, setBlendMode] = useState<GlobalCompositeOperation>(
    "normal" as GlobalCompositeOperation,
  );
  const [showHandles, setShowHandles] = useState(true);
  const [quad, setQuad] = useState<Point[]>(() => [...DEFAULT_QUAD]);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [designReady, setDesignReady] = useState(false);
  const [productReady, setProductReady] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const productCanvasRef = useRef<HTMLCanvasElement>(null);
  const designCanvasRef = useRef<HTMLCanvasElement>(null);
  const designImgRef = useRef<HTMLImageElement>(null);
  const generatedDispMapRef = useRef<HTMLCanvasElement | null>(null);
  const revokeLater = useRef<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => revokeLater.current.forEach(URL.revokeObjectURL), []);

  const handleFile =
    (setter: typeof setProductUrl, readySetter?: typeof setProductReady) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      revokeLater.current.push(url);
      setter(url);
      readySetter?.(false);
      if (setter === setProductUrl) {
        generatedDispMapRef.current = null;
      }
    };

  const measure = useCallback(() => {
    if (!imgRef.current || !productReady) return;
    const { width, height } = imgRef.current.getBoundingClientRect();
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    setDisplaySize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [productReady]);

  useLayoutEffect(() => measure(), [measure]);

  useEffect(() => {
    if (!productReady) return;
    const ro = new ResizeObserver(measure);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, productReady]);

  useLayoutEffect(() => {
    const productCanvas = productCanvasRef.current;
    const designCanvas = designCanvasRef.current;
    const design = designImgRef.current;
    const product = imgRef.current;
    if (
      !productCanvas ||
      !designCanvas ||
      !design ||
      !product ||
      !designReady ||
      !productReady ||
      displaySize.w < 2
    )
      return;

    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const cw = Math.round(displaySize.w * dpr);
    const ch = Math.round(displaySize.h * dpr);

    // Product canvas - ONLY the shirt
    productCanvas.width = cw;
    productCanvas.height = ch;
    productCanvas.style.width = `${displaySize.w}px`;
    productCanvas.style.height = `${displaySize.h}px`;

    const productCtx = productCanvas.getContext("2d");
    if (productCtx) {
      productCtx.setTransform(1, 0, 0, 1, 0, 0);
      productCtx.clearRect(0, 0, cw, ch);
      productCtx.scale(dpr, dpr);
      productCtx.drawImage(product, 0, 0, displaySize.w, displaySize.h);
    }

    // Design canvas - ONLY the design/logo
    designCanvas.width = cw;
    designCanvas.height = ch;
    designCanvas.style.width = `${displaySize.w}px`;
    designCanvas.style.height = `${displaySize.h}px`;

    const designCtx = designCanvas.getContext("2d");
    if (!designCtx) return;

    designCtx.setTransform(1, 0, 0, 1, 0, 0);
    designCtx.clearRect(0, 0, cw, ch);
    designCtx.scale(dpr, dpr);

    const dst = quadToPixel(quad, displaySize.w, displaySize.h);

    let dispOpts: DisplacementOptions | undefined;
    if (displacementStrength > 0 && useAutoDisplacement && imgRef.current) {
      if (!generatedDispMapRef.current) {
        generatedDispMapRef.current = generateDisplacementMap(imgRef.current);
      }
      if (generatedDispMapRef.current) {
        dispOpts = {
          map: generatedDispMapRef.current,
          strength: displacementStrength,
          productWidth: displaySize.w,
          productHeight: displaySize.h,
        };
      }
    }

    // Draw ONLY the design with opacity (blend mode via CSS)
    // Use lower resolution grid while dragging for performance
    const meshResolution = isDragging && dragIndex !== 4 ? 12 : 28;
    designCtx.globalAlpha = designOpacity / 100;
    drawWarpedImage(designCtx, design, dst, meshResolution, dispOpts);
    designCtx.globalAlpha = 1;
  }, [
    quad,
    designReady,
    productReady,
    displaySize,
    designUrl,
    displacementStrength,
    useAutoDisplacement,
    designOpacity,
    isDragging,
    dragIndex,
  ]);

  useEffect(() => {
    if (dragIndex === null) return;

    let startX = 0;
    let startY = 0;
    let isFirst = true;

    const onMove = (e: PointerEvent) => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;

      if (dragIndex === 4) {
        // Center handle - update quad to recalculate displacement at new position
        if (isFirst) {
          startX = nx;
          startY = ny;
          isFirst = false;
          return;
        }
        const dx = nx - startX;
        const dy = ny - startY;

        // Update quad in real-time so displacement is recalculated
        setIsDragging(true);
        setQuad((prev) =>
          prev.map((p) => ({
            x: Math.min(1, Math.max(0, p.x + dx)),
            y: Math.min(1, Math.max(0, p.y + dy)),
          })),
        );

        // Update start position for next delta
        startX = nx;
        startY = ny;
      } else {
        // Individual corner handle - set dragging flag
        setIsDragging(true);
        const x = Math.min(1, Math.max(0, nx));
        const y = Math.min(1, Math.max(0, ny));
        setQuad((prev) => prev.map((p, i) => (i === dragIndex ? { x, y } : p)));
      }
    };

    const onUp = () => {
      setIsDragging(false);
      setDragIndex(null);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragIndex]);

  // Convert blend mode to CSS mix-blend-mode
  const cssMixBlendMode: React.CSSProperties["mixBlendMode"] =
    blendMode === "source-over"
      ? "normal"
      : blendMode === "multiply"
        ? "multiply"
        : blendMode === "screen"
          ? "screen"
          : blendMode === "overlay"
            ? "overlay"
            : blendMode === "darken"
              ? "darken"
              : blendMode === "lighten"
                ? "lighten"
                : blendMode === "color-dodge"
                  ? "color-dodge"
                  : blendMode === "color-burn"
                    ? "color-burn"
                    : blendMode === "hard-light"
                      ? "hard-light"
                      : blendMode === "soft-light"
                        ? "soft-light"
                        : blendMode === "difference"
                          ? "difference"
                          : blendMode === "exclusion"
                            ? "exclusion"
                            : blendMode === "hue"
                              ? "hue"
                              : blendMode === "saturation"
                                ? "saturation"
                                : blendMode === "color"
                                  ? "color"
                                  : blendMode === "luminosity"
                                    ? "luminosity"
                                    : "normal";
  const pixelQuad =
    displaySize.w > 0 ? quadToPixel(quad, displaySize.w, displaySize.h) : [];
  const polyPoints = pixelQuad.map((p) => `${p.x},${p.y}`).join(" ");

  // Calculate center point for the center handle
  const centerX = quad.reduce((sum, p) => sum + p.x, 0) / 4;
  const centerY = quad.reduce((sum, p) => sum + p.y, 0) / 4;

  const downloadFinalRender = () => {
    if (
      !productCanvasRef.current ||
      !designCanvasRef.current ||
      !imgRef.current
    )
      return;

    const finalCanvas = document.createElement("canvas");
    const img = imgRef.current;
    finalCanvas.width = img.naturalWidth;
    finalCanvas.height = img.naturalHeight;

    const ctx = finalCanvas.getContext("2d");
    if (!ctx) return;

    // Draw product image
    ctx.drawImage(img, 0, 0);

    // Draw design on top
    const design = designImgRef.current;
    if (design && designReady) {
      const scaleX = img.naturalWidth / displaySize.w;
      const scaleY = img.naturalHeight / displaySize.h;
      const scaledDst = pixelQuad.map((p) => ({
        x: p.x * scaleX,
        y: p.y * scaleY,
      }));

      let dispOpts: DisplacementOptions | undefined;
      if (
        displacementStrength > 0 &&
        useAutoDisplacement &&
        generatedDispMapRef.current
      ) {
        dispOpts = {
          map: generatedDispMapRef.current,
          strength: displacementStrength * Math.max(scaleX, scaleY),
          productWidth: img.naturalWidth,
          productHeight: img.naturalHeight,
        };
      }

      ctx.globalAlpha = designOpacity / 100;
      ctx.globalCompositeOperation = blendMode;
      drawWarpedImage(ctx, design, scaledDst, 28, dispOpts);
    }

    // Download
    finalCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-mockup.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div className="mx-auto max-w-3xl p-7 pb-12">
      <h1 className="mb-2 text-3xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
        Product Mockup Generator
      </h1>
      <p className="mb-7 text-gray-600 dark:text-gray-400">
        Place designs on products with realistic effects. Adjust blend modes and
        opacity for professional results.
      </p>

      <fieldset className="mb-5 rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
        <legend className="px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          1. Product image
        </legend>
        <input
          className="bg-white p-2"
          type="file"
          accept="image/*"
          onChange={handleFile(setProductUrl, setProductReady)}
        />
        <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-400">
          PNG or JPG mockup (for example a blank t-shirt).
        </p>
      </fieldset>

      <fieldset className="mb-5 rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
        <legend className="px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          2. Design image
        </legend>
        <input
          type="file"
          className="bg-white p-2"
          accept="image/*"
          onChange={handleFile(setDesignUrl, setDesignReady)}
        />
        <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-400">
          Transparent PNG works best for prints and logos.
        </p>
      </fieldset>

      <fieldset className="mb-5 rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
        <legend className="px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          3. Appearance
        </legend>

        <div className="space-y-4">
          <div>
            <label className="mb-2 flex items-center gap-3 text-sm">
              <span className="min-w-[90px] font-medium text-gray-900 dark:text-gray-100">
                Opacity: {designOpacity}%
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={designOpacity}
                onChange={(e) => setDesignOpacity(Number(e.target.value))}
                className="flex-1"
              />
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Blend mode
            </label>
            <select
              value={blendMode}
              onChange={(e) =>
                setBlendMode(e.target.value as GlobalCompositeOperation)
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply (dark designs)</option>
              <option value="screen">Screen (light designs)</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft Light</option>
              <option value="hard-light">Hard Light</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Try Multiply for dark designs or Screen for light designs
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="mb-5 rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
        <legend className="px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          4. Displacement (wrinkle effect)
        </legend>

        <div className="space-y-4">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={useAutoDisplacement}
                onChange={(e) => {
                  setUseAutoDisplacement(e.target.checked);
                  if (e.target.checked) generatedDispMapRef.current = null;
                }}
                disabled={!productUrl}
                className="h-4 w-4"
              />
              Apply displacement (makes design follow wrinkles)
            </label>
            {useAutoDisplacement && (
              <div className="pl-6">
                <label className="flex items-center gap-3 text-sm">
                  <span className="min-w-[90px] text-gray-700 dark:text-gray-300">
                    Strength: {displacementStrength}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={displacementStrength}
                    onChange={(e) =>
                      setDisplacementStrength(Number(e.target.value))
                    }
                    className="flex-1"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/30">
        <legend className="px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          5. Position (drag corners)
        </legend>
        <div className="mb-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showHandles}
              onChange={(e) => setShowHandles(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Show handles
            </span>
          </label>
          <button
            type="button"
            onClick={downloadFinalRender}
            disabled={!designReady || !productReady}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download Final Render
          </button>
        </div>
        {!productUrl ? (
          <div className="py-12 text-center text-sm text-gray-600 dark:text-gray-400">
            Upload a product image to begin.
          </div>
        ) : (
          <div
            ref={wrapRef}
            className="relative inline-block max-w-full overflow-hidden rounded-lg border border-gray-300 bg-gray-100 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {/* Product image - hidden, used for measurement only */}
            <img
              ref={imgRef}
              src={productUrl}
              alt="Product"
              className="invisible block max-w-full select-none"
              onLoad={() => {
                setProductReady(true);
                requestAnimationFrame(measure);
              }}
            />
            {designUrl && (
              <img
                key={designUrl}
                ref={designImgRef}
                src={designUrl}
                alt=""
                className="hidden"
                onLoad={() => setDesignReady(true)}
              />
            )}
            {/* Product canvas - shirt only, NEVER moves */}
            <canvas
              ref={productCanvasRef}
              className="absolute inset-0 h-full w-full"
            />

            {/* Design canvas - logo only, moves during drag, blends with CSS */}
            {designUrl && productReady && designReady && (
              <canvas
                ref={designCanvasRef}
                className="absolute inset-0 h-full w-full"
                style={{ mixBlendMode: cssMixBlendMode }}
              />
            )}
            {productReady && displaySize.w > 0 && showHandles && (
              <div
                ref={overlayRef}
                className="pointer-events-none absolute inset-0"
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${displaySize.w} ${displaySize.h}`}
                  className="overflow-visible"
                  preserveAspectRatio="none"
                >
                  {polyPoints && (
                    <polygon
                      points={polyPoints}
                      fill="none"
                      stroke="rgba(255,255,255,0.95)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      style={{
                        filter: "drop-shadow(0 0 2px rgba(0,0,0,0.65))",
                      }}
                    />
                  )}
                </svg>
                {quad.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pointer-events-auto absolute -ml-2 -mt-2 h-4 w-4 cursor-grab touch-none rounded-full border-2 border-white bg-purple-600 shadow-md active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 dark:bg-purple-500"
                    aria-label={
                      ["Top left", "Top right", "Bottom right", "Bottom left"][
                        i
                      ]
                    }
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      setDragIndex(i);
                    }}
                    onPointerUp={(e) => {
                      try {
                        (e.target as HTMLElement).releasePointerCapture(
                          e.pointerId,
                        );
                      } catch {}
                      setDragIndex(null);
                    }}
                    onPointerCancel={(e) => {
                      try {
                        (e.target as HTMLElement).releasePointerCapture(
                          e.pointerId,
                        );
                      } catch {}
                      setDragIndex(null);
                    }}
                  />
                ))}
                {/* Center handle to move all corners at once */}
                <button
                  type="button"
                  className="pointer-events-auto absolute -ml-3 -mt-3 h-6 w-6 cursor-move touch-none rounded-full border-2 border-white bg-green-500 shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
                  aria-label="Move all corners"
                  style={{
                    left: `${centerX * 100}%`,
                    top: `${centerY * 100}%`,
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    setDragIndex(4);
                  }}
                  onPointerUp={(e) => {
                    try {
                      (e.target as HTMLElement).releasePointerCapture(
                        e.pointerId,
                      );
                    } catch {}
                    setDragIndex(null);
                  }}
                  onPointerCancel={(e) => {
                    try {
                      (e.target as HTMLElement).releasePointerCapture(
                        e.pointerId,
                      );
                    } catch {}
                    setDragIndex(null);
                  }}
                >
                  <svg
                    className="h-full w-full p-0.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
        {!designUrl && productUrl && (
          <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-400">
            Upload a design to see it warped onto the product.
          </p>
        )}
      </fieldset>
    </div>
  );
}
