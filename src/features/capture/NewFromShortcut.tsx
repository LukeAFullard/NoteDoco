import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { newNote, newSticky } from './capture';
import { openSticky } from '@/features/stickies/stickyDialog';

/** Target of the app-icon shortcuts: /new/note and /new/sticky. */
export function NewFromShortcut() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return; // StrictMode runs effects twice in development
    done.current = true;
    void (async () => {
      if (kind === 'sticky') {
        const id = await newSticky(null);
        navigate('/inbox', { replace: true });
        openSticky(id, true);
      } else {
        navigate(`/items/${await newNote(null)}`, { replace: true });
      }
    })();
  }, [kind, navigate]);
  return null;
}
