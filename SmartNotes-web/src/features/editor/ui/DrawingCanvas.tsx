"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2, Redo2, Trash2, Eraser, Edit3, X, Check, Palette } from "lucide-react";
import { motion } from "framer-motion";

type Point = { x: number; y: number };

type Stroke = {
  points: Point[];
  color: string;
  lineWidth: number;
};

type DrawingCanvasProps = {
  onClose: () => void;
  onSave: (blob: Blob) => void;
};

const COLOR_PRESETS = [
  "#000000",
  "#7c3aed",
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#eab308",
];

export function DrawingCanvas({ onClose, onSave }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#7c3aed");
  const [lineWidth, setLineWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  
  strokesRef.current = strokes;

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.save();
    const dpr = window.devicePixelRatio || 1;
    context.scale(dpr, dpr);

    strokesRef.current.forEach((stroke) => {
      if (stroke.points.length < 1) return;

      context.beginPath();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.lineWidth;

      const p0 = stroke.points[0];
      context.moveTo(p0.x, p0.y);

      if (stroke.points.length === 1) {
        context.lineTo(p0.x, p0.y);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          context.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
      }
      context.stroke();
    });

    context.restore();
  };

  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      
      redrawCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    currentStrokeRef.current = [coords];
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    
    currentStrokeRef.current.push(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.save();
    const dpr = window.devicePixelRatio || 1;
    context.scale(dpr, dpr);

    context.beginPath();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    context.lineWidth = tool === "eraser" ? 24 : lineWidth;

    const points = currentStrokeRef.current;
    if (points.length > 1) {
      const pPrev = points[points.length - 2];
      const pCurr = points[points.length - 1];
      context.moveTo(pPrev.x, pPrev.y);
      context.lineTo(pCurr.x, pCurr.y);
      context.stroke();
    }
    context.restore();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current.length > 0) {
      const newStroke: Stroke = {
        points: [...currentStrokeRef.current],
        color: tool === "eraser" ? "#ffffff" : color,
        lineWidth: tool === "eraser" ? 24 : lineWidth,
      };

      setStrokes((prev) => [...prev, newStroke]);
      setRedoStrokes([]);
    }
    currentStrokeRef.current = [];
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStrokes((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStrokes.length === 0) return;
    const last = redoStrokes[redoStrokes.length - 1];
    setRedoStrokes((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, last]);
  };

  const clearCanvas = () => {
    if (window.confirm("Очистить весь холст?")) {
      setStrokes([]);
      setRedoStrokes([]);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempContext = tempCanvas.getContext("2d");
    if (!tempContext) return;

    tempContext.save();
    const dpr = window.devicePixelRatio || 1;
    tempContext.scale(dpr, dpr);

    strokes.forEach((stroke) => {
      if (stroke.points.length < 1) return;
      tempContext.beginPath();
      tempContext.lineCap = "round";
      tempContext.lineJoin = "round";
      tempContext.strokeStyle = stroke.color;
      tempContext.lineWidth = stroke.lineWidth;

      const p0 = stroke.points[0];
      tempContext.moveTo(p0.x, p0.y);
      if (stroke.points.length === 1) {
        tempContext.lineTo(p0.x, p0.y);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          tempContext.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
      }
      tempContext.stroke();
    });
    tempContext.restore();

    tempCanvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, "image/png");
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/96 select-none overflow-hidden">
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }}
      />
      
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 px-5 py-3 shadow-2xl backdrop-blur-md max-w-[90%] sm:max-w-max"
      >
        <div className="flex items-center gap-3.5 border-r border-border/60 pr-4">
          <button
            onClick={() => setTool("pen")}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              tool === "pen" ? "bg-accent text-accent-foreground shadow-lg shadow-accent/25" : "hover:bg-surface-strong text-foreground/72"
            }`}
            title="Карандаш"
            type="button"
          >
            <Edit3 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              tool === "eraser" ? "bg-accent text-accent-foreground shadow-lg shadow-accent/25" : "hover:bg-surface-strong text-foreground/72"
            }`}
            title="Ластик"
            type="button"
          >
            <Eraser className="h-4.5 w-4.5" />
          </button>
        </div>

        {tool === "pen" && (
          <div className="flex items-center gap-2 border-r border-border/60 pr-4">
            {COLOR_PRESETS.map((pColor) => (
              <button
                key={pColor}
                onClick={() => setColor(pColor)}
                className={`h-6 w-6 rounded-full border border-border/60 relative flex items-center justify-center transition hover:scale-110 active:scale-95`}
                style={{ backgroundColor: pColor }}
                type="button"
              >
                {color === pColor && (
                  <span className="h-2 w-2 rounded-full bg-white shadow-sm" />
                )}
              </button>
            ))}
            
            <label className="relative cursor-pointer h-6 w-6 rounded-full border border-border/60 flex items-center justify-center hover:scale-110 active:scale-95 bg-surface-strong text-foreground/54">
              <Palette className="h-3.5 w-3.5" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 border-r border-border/60 pr-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground/42">Размер</span>
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 accent-accent cursor-pointer"
          />
          <span className="text-xs font-black w-4 text-center">{lineWidth}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground/72 hover:bg-surface-strong disabled:opacity-30 transition"
            title="Назад"
            type="button"
          >
            <Undo2 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStrokes.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground/72 hover:bg-surface-strong disabled:opacity-30 transition"
            title="Вперед"
            type="button"
          >
            <Redo2 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={clearCanvas}
            disabled={strokes.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 transition"
            title="Очистить"
            type="button"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </motion.div>

      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerOut={stopDrawing}
        className="flex-1 w-full h-full cursor-crosshair touch-none bg-white"
        style={{ touchAction: "none" }}
      />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-6 right-6 z-50 flex items-center gap-3"
      >
        <button
          onClick={onClose}
          className="flex h-12 gap-2 items-center justify-center rounded-2xl border border-border/80 bg-surface/90 px-5 text-sm font-black text-foreground shadow-2xl backdrop-blur-md hover:bg-surface-strong transition active:scale-95"
          type="button"
        >
          <X className="h-4 w-4" /> Отмена
        </button>
        <button
          onClick={handleSave}
          className="flex h-12 gap-2 items-center justify-center rounded-2xl bg-accent text-accent-foreground px-6 text-sm font-black shadow-2xl shadow-accent/25 hover:bg-accent/90 transition active:scale-95"
          type="button"
        >
          <Check className="h-4 w-4" /> Сохранить
        </button>
      </motion.div>
    </div>
  );
}
