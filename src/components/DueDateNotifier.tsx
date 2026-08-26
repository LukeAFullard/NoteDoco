import { useEffect, useRef } from 'react';
import { getSettings, getNotes } from '../db';
import { getNewlyDueNotes } from '../utils/dueDateNotifications';
import { getDueBucket } from '../utils/dueDate';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function DueDateNotifier() {
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | undefined;
    let isCancelled = false;

    const checkDueNotes = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return;
      }

      if (Notification.permission !== 'granted') {
        return;
      }

      const settings = await getSettings();
      if (isCancelled || !settings.notificationsEnabled) {
        return;
      }

      const notes = await getNotes();
      if (isCancelled) return;

      const newlyDue = getNewlyDueNotes(notes, notifiedIdsRef.current);

      for (const note of newlyDue) {
        if (isCancelled) break;
        notifiedIdsRef.current.add(note.id);
        const bucket = note.goalDate ? getDueBucket(note.goalDate) : 'today';
        const label = bucket === 'today' ? 'Due today' : 'Overdue';
        const noteTitle = note.title.trim() || 'Untitled note';

        try {
          new Notification(`${label}: ${noteTitle}`, {
            body: noteTitle,
          });
        } catch (err) {
          console.error('Failed to trigger notification:', err);
        }
      }
    };

    checkDueNotes();
    timerId = setInterval(checkDueNotes, CHECK_INTERVAL_MS);

    return () => {
      isCancelled = true;
      if (timerId) clearInterval(timerId);
    };
  }, []);

  return null;
}
