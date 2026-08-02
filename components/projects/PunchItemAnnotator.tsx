"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Circle, ArrowUpRight, MapPin, RotateCcw, Trash2 } from "lucide-react";
import type { AnnotationShape } from "@/lib/queries/punch_list";
import { cn } from "@/lib/utils";

interface PunchItemAnnotatorProps {
  photoUrl: string;
  initialShapes?: AnnotationShape[];
  readOnly?: boolean;
  onChange?: (shapes: AnnotationShape[]) => void;
  className?: string;
}

export function PunchItemAnnotator({
  photoUrl,
  initialShapes = [],
  readOnly = false,
  onChange,
  className,
}: PunchItemAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shapes, setShapes] = useState<AnnotationShape[]>(initialShapes);
  const [activeTool, setActiveTool] = useState<"circle" | "arrow" | "pin">("circle");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Sync internal shapes state with initialShapes prop if updated
  useEffect(() => {
    setShapes(initialShapes || []);
  }, [initialShapes]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photoUrl;
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
  }, [photoUrl]);

  // Notify parent of shape updates
  const updateShapes = useCallback(
    (newShapes: AnnotationShape[]) => {
      setShapes(newShapes);
      if (onChange) onChange(newShapes);
    },
    [onChange]
  );

  // Redraw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear and draw background image
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(imgRef.current, 0, 0, width, height);

    // Styling defaults
    const ACCENT_COLOR = "#f43f5e"; // Rose-500
    ctx.strokeStyle = ACCENT_COLOR;
    ctx.fillStyle = ACCENT_COLOR;
    ctx.lineWidth = Math.max(3, Math.round(width / 200));

    // Draw committed shapes
    shapes.forEach((shape) => {
      ctx.beginPath();
      if (shape.type === "circle") {
        const cx = shape.x * width;
        const cy = shape.y * height;
        const r = (shape.radius || 0.08) * Math.min(width, height);
        ctx.arc(cx, cy, Math.max(10, r), 0, 2 * Math.PI);
        ctx.stroke();

        // Subtle translucent fill
        ctx.fillStyle = "rgba(244, 63, 94, 0.15)";
        ctx.fill();
        ctx.fillStyle = ACCENT_COLOR;
      } else if (shape.type === "arrow") {
        const x1 = shape.x * width;
        const y1 = shape.y * height;
        const x2 = (shape.endX ?? shape.x + 0.1) * width;
        const y2 = (shape.endY ?? shape.y + 0.1) * height;

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrowhead at (x2, y2)
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.max(12, Math.round(width / 35));
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLen * Math.cos(angle - Math.PI / 6),
          y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x2 - headLen * Math.cos(angle + Math.PI / 6),
          y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (shape.type === "pin") {
        const px = shape.x * width;
        const py = shape.y * height;
        const pinRadius = Math.max(8, Math.round(width / 50));

        // Draw Pin Drop Marker
        ctx.beginPath();
        ctx.arc(px, py - pinRadius, pinRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(px - pinRadius * 0.7, py - pinRadius * 0.5);
        ctx.lineTo(px, py + pinRadius * 0.4);
        ctx.lineTo(px + pinRadius * 0.7, py - pinRadius * 0.5);
        ctx.closePath();
        ctx.fill();

        // Inner White Dot
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(px, py - pinRadius, pinRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ACCENT_COLOR;
      }
    });

    // Draw active shape being dragged
    if (isDrawing && startPoint && currentPoint) {
      ctx.beginPath();
      if (activeTool === "circle") {
        const cx = startPoint.x * width;
        const cy = startPoint.y * height;
        const dx = (currentPoint.x - startPoint.x) * width;
        const dy = (currentPoint.y - startPoint.y) * height;
        const r = Math.sqrt(dx * dx + dy * dy);
        ctx.arc(cx, cy, Math.max(10, r), 0, 2 * Math.PI);
        ctx.stroke();
      } else if (activeTool === "arrow") {
        const x1 = startPoint.x * width;
        const y1 = startPoint.y * height;
        const x2 = currentPoint.x * width;
        const y2 = currentPoint.y * height;

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.max(12, Math.round(width / 35));
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLen * Math.cos(angle - Math.PI / 6),
          y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x2 - headLen * Math.cos(angle + Math.PI / 6),
          y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [shapes, isDrawing, startPoint, currentPoint, activeTool]);

  // Adjust canvas size to parent aspect ratio
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !containerRef.current || !imgRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;

    const containerWidth = container.clientWidth || 600;
    const aspect = img.height / img.width;

    canvas.width = containerWidth;
    canvas.height = Math.round(containerWidth * aspect);

    draw();
  }, [imgLoaded, draw]);

  // Redraw when shapes or points update
  useEffect(() => {
    draw();
  }, [draw]);

  // Event Handlers for drawing
  const getCanvasRelativePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const pos = getCanvasRelativePos(e);

    if (activeTool === "pin") {
      updateShapes([...shapes, { type: "pin", x: pos.x, y: pos.y }]);
      return;
    }

    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentPoint(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !isDrawing) return;
    const pos = getCanvasRelativePos(e);
    setCurrentPoint(pos);
  };

  const handleMouseUp = () => {
    if (readOnly || !isDrawing || !startPoint || !currentPoint) return;
    setIsDrawing(false);

    if (activeTool === "circle") {
      const dx = currentPoint.x - startPoint.x;
      const dy = currentPoint.y - startPoint.y;
      const radius = Math.max(0.04, Math.sqrt(dx * dx + dy * dy));
      updateShapes([...shapes, { type: "circle", x: startPoint.x, y: startPoint.y, radius }]);
    } else if (activeTool === "arrow") {
      updateShapes([
        ...shapes,
        { type: "arrow", x: startPoint.x, y: startPoint.y, endX: currentPoint.x, endY: currentPoint.y },
      ]);
    }

    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleUndo = () => {
    if (shapes.length === 0) return;
    updateShapes(shapes.slice(0, shapes.length - 1));
  };

  const handleClear = () => {
    updateShapes([]);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar Controls (Hidden in ReadOnly mode) */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-secondary/80 rounded-xl border border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTool("circle")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTool === "circle"
                  ? "bg-rose-500 text-white shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Circle className="w-3.5 h-3.5" /> Circle Highlight
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("arrow")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTool === "arrow"
                  ? "bg-rose-500 text-white shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Arrow Pointer
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("pin")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTool === "pin"
                  ? "bg-rose-500 text-white shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MapPin className="w-3.5 h-3.5" /> Defect Pin Marker
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={shapes.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo last shape"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={shapes.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear all annotations"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden border border-border bg-black/5 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={cn("w-full h-auto block touch-none", !readOnly && "cursor-crosshair")}
        />
      </div>
    </div>
  );
}
