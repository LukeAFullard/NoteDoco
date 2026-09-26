import { create } from 'zustand';
import type { PendingReminder } from '@/data/repos/reminders';

/** Reminders that went off while NoteDoco was closed (TIME-13: "While you were away"). */
export const useMissed = create<{ missed: PendingReminder[] }>(() => ({ missed: [] }));
export const clearMissed = () => useMissed.setState({ missed: [] });
