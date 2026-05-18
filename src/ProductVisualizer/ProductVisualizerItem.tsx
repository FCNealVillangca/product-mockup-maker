import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  drawWarpedImage,
  type DisplacementOptions,
  type Point,
} from "../lib/homography";
import { visualizerDefaults } from "./config";
import type { ArtPosition, ArtQuad, VisualizerProduct } from "./types";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const normalizePosition = (position: ArtPosition): ArtPosition => {
  const max = Math.max(...position);
  if (max <= 1) return position;
  return position.map((v) => v / 100) as ArtPosition;
};

const rectToQuad = ([x, y, w, h]: ArtPosition): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const artQuadToPoints = (q: ArtQuad): Point[] =>
  q.map(([x, y]) => ({ x, y }));

const initialQuad = (art: VisualizerProduct["art"]): Point[] => {
  if (art.quad) return artQuadToPoints(art.quad);
  if (art.position) return rectToQuad(normalizePosition(art.position));
  return rectToQuad([0.2, 0.2, 0.6, 0.6]);
};

const quadToPixel = (quad: Point[], w: number, h: number): Point[] =>
  quad.map((p) => ({ x: p.x * w, y: p.y * h }));

const CORNER_LABELS = ["Top left", "Top right", "Bottom right", "Bottom left"];

type Props = {
  product: VisualizerProduct;
  /** Displacement fold strength (0–50). Defaults to visualizerDefaults.displacementStrength. */
  strength?: number;
  /** Art opacity 0–100. Defaults to visualizerDefaults.opacity. */
  opacity?: number;
  /** CSS blend mode for the art layer. */
  blendMode?: string;
  /** Whether to show the drag handles and outline. */
  showHandles?: boolean;
};

export function ProductVisualizerItem({ product, strength, opacity, blendMode, showHandles = true }: Props) {
  const [quad, setQuad] = useState<Point[]>(() => initialQuad(product.art));
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [bgReady, setBgReady] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [dispReady, setDispReady] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const artRef = useRef<HTMLImageElement>(null);
  const dispRef = useRef<HTMLImageElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const artCanvasRef = useRef<HTMLCanvasElement>(null);
  // Baked displacement canvas — avoids hidden <img> having width=0
  const dispBakedRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const img = dispRef.current;
    if (!dispReady || !img || img.naturalWidth === 0) return;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    dispBakedRef.current = c;
  }, [dispReady]);

  const measure = useCallback(() => {
    if (!wrapRef.current || !bgReady || !bgRef.current) return;
    const width = wrapRef.current.clientWidth;
    if (width < 1) return;
    const aspect = bgRef.current.naturalHeight / bgRef.current.naturalWidth;
    const height = Math.max(1, Math.round(width * aspect));
    setDisplaySize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  }, [bgReady]);

  useLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    if (!bgReady || !wrapRef.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [bgReady, measure]);

  useLayoutEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const artCanvas = artCanvasRef.current;
    const bg = bgRef.current;
    const art = artRef.current;
    if (!bgCanvas || !artCanvas || !bg || !art || !bgReady || !artReady || displaySize.w < 2)
      return;

    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const cw = Math.round(displaySize.w * dpr);
    const ch = Math.round(displaySize.h * dpr);

    // --- Background canvas ---
    bgCanvas.width = cw;
    bgCanvas.height = ch;
    bgCanvas.style.width = `${displaySize.w}px`;
    bgCanvas.style.height = `${displaySize.h}px`;
    const bgCtx = bgCanvas.getContext("2d");
    if (bgCtx) {
      bgCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgCtx.clearRect(0, 0, cw, ch);
      bgCtx.scale(dpr, dpr);
      bgCtx.drawImage(bg, 0, 0, displaySize.w, displaySize.h);
    }

    // --- Art canvas ---
    artCanvas.width = cw;
    artCanvas.height = ch;
    artCanvas.style.width = `${displaySize.w}px`;
    artCanvas.style.height = `${displaySize.h}px`;
    const artCtx = artCanvas.getContext("2d");
    if (!artCtx) return;

    artCtx.setTransform(1, 0, 0, 1, 0, 0);
    artCtx.clearRect(0, 0, cw, ch);
    artCtx.scale(dpr, dpr);

    const dst = quadToPixel(quad, displaySize.w, displaySize.h);

    // Build displacement options from the baked canvas (never a hidden <img>)
    const resolvedStrength = strength ?? visualizerDefaults.displacementStrength;
    let dispOpts: DisplacementOptions | undefined;
    const dispBaked = dispBakedRef.current;
    if (dispBaked && resolvedStrength > 0) {
      dispOpts = {
        map: dispBaked,
        strength: resolvedStrength,
        productWidth: displaySize.w,
        productHeight: displaySize.h,
      };
    }

    const meshRes = isDragging && dragIndex !== 4 ? 8 : 24;

    // Draw art to an offscreen canvas so we can clip it cleanly
    const offscreen = document.createElement("canvas");
    offscreen.width = displaySize.w;
    offscreen.height = displaySize.h;
    const offCtx = offscreen.getContext("2d", { 
      alpha: true,
      desynchronized: false,
      colorSpace: "srgb"
    });
    if (!offCtx) return;
    
    // Enable smooth rendering to reduce seam visibility
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = "high";

    drawWarpedImage(offCtx, art, dst, meshRes, dispOpts);

    // Clip art to the displacement map's alpha channel.
    // Since displacement.png is a PNG its alpha defines the printable shirt area —
    // destination-in keeps only the pixels where it is opaque.
    if (dispBakedRef.current) {
      offCtx.globalCompositeOperation = "destination-in";
      offCtx.drawImage(dispBakedRef.current, 0, 0, displaySize.w, displaySize.h);
      offCtx.globalCompositeOperation = "source-over";
    }

    // Paint the clipped art onto the art canvas; CSS handles the blend mode
    artCtx.drawImage(offscreen, 0, 0);
  }, [
    quad,
    artReady,
    bgReady,
    dispReady,
    displaySize,
    isDragging,
    dragIndex,
    strength,
  ]);

  // Pointer drag logic — index 0-3 = corner, 4 = center (move all)
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
        if (isFirst) { startX = nx; startY = ny; isFirst = false; return; }
        const dx = nx - startX;
        const dy = ny - startY;
        startX = nx;
        startY = ny;
        setIsDragging(true);
        setQuad((prev) =>
          prev.map((p) => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) })),
        );
      } else {
        setIsDragging(true);
        setQuad((prev) =>
          prev.map((p, i) =>
            i === dragIndex ? { x: clamp01(nx), y: clamp01(ny) } : p,
          ),
        );
      }
    };

    const onUp = () => { setIsDragging(false); setDragIndex(null); };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragIndex]);

  const centerX = quad.reduce((s, p) => s + p.x, 0) / 4;
  const centerY = quad.reduce((s, p) => s + p.y, 0) / 4;

  const exportImage = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const artCanvas = artCanvasRef.current;
    if (!bgCanvas || !artCanvas) return;

    // Create a high-resolution export canvas
    const exportCanvas = document.createElement("canvas");
    const exportSize = 2048; // High resolution export
    const aspect = displaySize.h / displaySize.w;
    exportCanvas.width = exportSize;
    exportCanvas.height = Math.round(exportSize * aspect);

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // Draw background at high resolution
    ctx.drawImage(bgRef.current!, 0, 0, exportCanvas.width, exportCanvas.height);

    // Create high-res art layer
    if (artRef.current && bgReady && artReady) {
      const artCtx = ctx;
      const dst = quadToPixel(quad, exportCanvas.width, exportCanvas.height);

      // Use higher mesh resolution for export to eliminate visible grid
      const exportMeshRes = 128;

      // Build displacement options for export
      const resolvedStrength = strength ?? visualizerDefaults.displacementStrength;
      let dispOpts: DisplacementOptions | undefined;
      const dispBaked = dispBakedRef.current;
      if (dispBaked && resolvedStrength > 0) {
        dispOpts = {
          map: dispBaked,
          strength: resolvedStrength,
          productWidth: exportCanvas.width,
          productHeight: exportCanvas.height,
        };
      }

      // Draw art to export canvas
      const offscreen = document.createElement("canvas");
      offscreen.width = exportCanvas.width;
      offscreen.height = exportCanvas.height;
      const offCtx = offscreen.getContext("2d", { 
        alpha: true,
        desynchronized: false,
        colorSpace: "srgb"
      });
      if (offCtx) {
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = "high";

        drawWarpedImage(offCtx, artRef.current, dst, exportMeshRes, dispOpts);

        // Clip art to displacement map alpha
        if (dispBakedRef.current) {
          offCtx.globalCompositeOperation = "destination-in";
          offCtx.drawImage(dispBakedRef.current, 0, 0, exportCanvas.width, exportCanvas.height);
          offCtx.globalCompositeOperation = "source-over";
        }

        // Apply blend mode and opacity to final export
        artCtx.globalCompositeOperation = (
          blendMode ?? product.blendMode ?? visualizerDefaults.blendMode
        ) as GlobalCompositeOperation;
        artCtx.globalAlpha = (opacity ?? visualizerDefaults.opacity) / 100;
        artCtx.drawImage(offscreen, 0, 0);
        artCtx.globalCompositeOperation = "source-over";
        artCtx.globalAlpha = 1;
      }
    }

    // Download the image
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${product.productName.replace(/\s+/g, '-').toLowerCase()}-export.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png", 1.0);
  }, [quad, displaySize, bgReady, artReady, strength, blendMode, opacity, product]);
  const polyPoints =
    displaySize.w > 0
      ? quadToPixel(quad, displaySize.w, displaySize.h)
          .map((p) => `${p.x},${p.y}`)
          .join(" ")
      : "";

  return (
    <article className="w-full">
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg bg-gray-100 shadow-md dark:bg-gray-800"
        style={displaySize.h > 0 ? { height: displaySize.h } : { aspectRatio: "4/5" }}
      >
        {/* Hidden source images */}
        <img
          ref={bgRef}
          src={product.bg.url}
          alt=""
          className="pointer-events-none absolute w-full opacity-0"
          onLoad={() => { setBgReady(true); requestAnimationFrame(measure); }}
        />
        <img ref={artRef} src={product.art.url} alt="" className="hidden" onLoad={() => setArtReady(true)} />
        <img ref={dispRef} src={product.displacement} alt="" className="hidden" onLoad={() => setDispReady(true)} />

        {/* Background canvas */}
        <canvas ref={bgCanvasRef} className="absolute inset-0 h-full w-full" />

        {/* Art canvas — CSS multiply blends it against the shirt */}
        {artReady && bgReady && (
          <canvas
            ref={artCanvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{
              mixBlendMode: (
                blendMode ?? product.blendMode ?? visualizerDefaults.blendMode
              ) as React.CSSProperties["mixBlendMode"],
              opacity: (opacity ?? visualizerDefaults.opacity) / 100,
            }}
          />
        )}

        {/* Handles overlay */}
        {bgReady && displaySize.w > 0 && showHandles && (
          <div className="pointer-events-none absolute inset-0">
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
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))" }}
                />
              )}
            </svg>

            {/* 4 corner handles */}
            {quad.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-label={CORNER_LABELS[i]}
                className="pointer-events-auto absolute -ml-2 -mt-2 h-4 w-4 cursor-grab touch-none rounded-full border-2 border-white bg-purple-600 shadow-md active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 dark:bg-purple-500"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  setDragIndex(i);
                }}
                onPointerUp={(e) => {
                  try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                  setDragIndex(null);
                }}
                onPointerCancel={(e) => {
                  try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                  setDragIndex(null);
                }}
              />
            ))}

            {/* Center move handle */}
            <button
              type="button"
              aria-label="Move art"
              className="pointer-events-auto absolute -ml-3 -mt-3 h-6 w-6 cursor-move touch-none rounded-full border-2 border-white bg-green-500 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
              style={{ left: `${centerX * 100}%`, top: `${centerY * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                setDragIndex(4);
              }}
              onPointerUp={(e) => {
                try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                setDragIndex(null);
              }}
              onPointerCancel={(e) => {
                try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                setDragIndex(null);
              }}
            >
              <svg className="h-full w-full p-0.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {product.productName}
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Current settings
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportImage}
                className="rounded border border-green-300 bg-green-50 px-2 py-0.5 font-sans text-[10px] font-medium text-green-700 hover:bg-green-100 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
              >
                Export PNG
              </button>
              <button
              type="button"
              onClick={() => {
                const resolvedStrength = strength ?? product.displacementStrength ?? visualizerDefaults.displacementStrength;
                const resolvedBlend = blendMode ?? product.blendMode ?? visualizerDefaults.blendMode;
                const resolvedOpacity = opacity ?? product.opacity ?? visualizerDefaults.opacity;
                const quadArr = quad.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4)]);
                const snippet = JSON.stringify(
                  {
                    quad: quadArr,
                    displacementStrength: resolvedStrength,
                    blendMode: resolvedBlend,
                    opacity: resolvedOpacity,
                  },
                  null,
                  2,
                );

                const doCopy = () => {
                  // Fallback for non-HTTPS / focus issues
                  try {
                    const ta = document.createElement("textarea");
                    ta.value = snippet;
                    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                  } catch {}
                };

                if (navigator.clipboard) {
                  navigator.clipboard.writeText(snippet).catch(doCopy);
                } else {
                  doCopy();
                }

                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 font-sans text-[10px] font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {copied ? "✓ Copied!" : "Copy config"}
              </button>
            </div>
          </div>

          {/* Quad corners */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {quad.map((p, i) => (
              <span key={i}>
                {["TL", "TR", "BR", "BL"][i]}&nbsp;
                ({p.x.toFixed(3)},&nbsp;{p.y.toFixed(3)})
              </span>
            ))}
          </div>
          <div className="mt-1 border-t border-gray-200 pt-1 dark:border-gray-700">
            <span className="mr-3">cx&nbsp;{centerX.toFixed(3)}</span>
            <span>cy&nbsp;{centerY.toFixed(3)}</span>
          </div>

          {/* Other settings */}
          <div className="mt-1 border-t border-gray-200 pt-1 dark:border-gray-700 font-sans space-y-0.5">
            <div>
              <span className="text-gray-400 dark:text-gray-500">displacement&nbsp;</span>
              {strength ?? product.displacementStrength ?? visualizerDefaults.displacementStrength}
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500">blend&nbsp;</span>
              {blendMode ?? product.blendMode ?? visualizerDefaults.blendMode}
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500">opacity&nbsp;</span>
              {opacity ?? visualizerDefaults.opacity}%
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
