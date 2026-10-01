import type { ReactNode } from 'react';
import { Brush, Eraser, Highlighter, Lasso, Pen, PenTool, Type } from 'lucide-react';
import type { InkTool } from '@/canvas/engine';

/** The tools, in toolbar order, with their keyboard shortcuts. */
export const TOOLS: Array<{ tool: InkTool; label: string; icon: ReactNode; key: string }> = [
  { tool: 'ballpoint', label: 'Ballpoint pen', icon: <Pen size={18} />, key: 'P' },
  { tool: 'fountain', label: 'Fountain pen', icon: <PenTool size={18} />, key: 'F' },
  { tool: 'marker', label: 'Marker', icon: <Brush size={18} />, key: 'M' },
  { tool: 'highlighter', label: 'Highlighter', icon: <Highlighter size={18} />, key: 'H' },
  { tool: 'eraser', label: 'Eraser', icon: <Eraser size={18} />, key: 'E' },
  { tool: 'lasso', label: 'Lasso: select ink', icon: <Lasso size={18} />, key: 'L' },
  { tool: 'text', label: 'Text box', icon: <Type size={18} />, key: 'T' },
];

export const SIZES = [
  { size: 0.4, label: 'Extra fine' },
  { size: 0.7, label: 'Fine' },
  { size: 1, label: 'Medium' },
  { size: 1.6, label: 'Bold' },
  { size: 2.5, label: 'Extra bold' },
];

export const sizeLabel = (size: number) => SIZES.find((s) => s.size === size)?.label ?? `${Math.round(size * 100)}%`;
