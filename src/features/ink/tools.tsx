import type { ReactNode } from 'react';
import { Brush, Eraser, Highlighter, Pen, PenTool } from 'lucide-react';
import type { InkTool } from '@/canvas/engine';

/** The pens, in toolbar order, with their keyboard shortcuts. */
export const TOOLS: Array<{ tool: InkTool; label: string; icon: ReactNode; key: string }> = [
  { tool: 'ballpoint', label: 'Ballpoint pen', icon: <Pen size={18} />, key: 'P' },
  { tool: 'fountain', label: 'Fountain pen', icon: <PenTool size={18} />, key: 'F' },
  { tool: 'marker', label: 'Marker', icon: <Brush size={18} />, key: 'M' },
  { tool: 'highlighter', label: 'Highlighter', icon: <Highlighter size={18} />, key: 'H' },
  { tool: 'eraser', label: 'Eraser', icon: <Eraser size={18} />, key: 'E' },
];

export const SIZES = [
  { size: 0.6, label: 'Fine' },
  { size: 1, label: 'Medium' },
  { size: 1.8, label: 'Bold' },
];
