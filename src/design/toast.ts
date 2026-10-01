import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void | Promise<void> };
  tone?: 'default' | 'danger';
}

interface ToastState {
  toasts: Toast[];
}

let nextId = 1;
export const useToasts = create<ToastState>(() => ({ toasts: [] }));

export const TOAST_MS = 6000;

export function showToast(toast: Omit<Toast, 'id'>, ms = TOAST_MS): number {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id }] }));
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number) {
  useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
