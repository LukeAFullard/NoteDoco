import { useState } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { CornerDownLeft } from 'lucide-react';
import { createItem, restoreItems, trashItems, updateItem } from '@/data/repos/items';
import { recordUndo } from '@/data/undo';
import type { Id, LocalDate } from '@/data/types';
import { toastWithUndo } from '@/app/undoActions';
import { IconButton } from '@/design/Button';
import { cn } from '@/design/cn';
import { describeRule, parseRule } from '@/lib/recurrence';
import { allDaySpan, formatDay, formatSpan, spanDays, todayLocal } from '@/lib/time';
import { useLocalPref } from '@/lib/localPref';
import type { Capture } from '@/features/time/naturalDate';

type Mode = 'todo' | 'sticky' | 'note';
type Parser = (text: string) => Capture;

const MODES: { value: Mode; label: string }[] = [
  { value: 'todo', label: 'To-do' },
  { value: 'sticky', label: 'Sticky' },
  { value: 'note', label: 'Note' },
];

let loading: Promise<Parser> | null = null;
const loadParser = () => (loading ??= import('@/features/time/naturalDate').then((m) => (t: string) => m.parseCapture(t)));

/**
 * Quick capture (CAP-2): one line becomes a to-do, sticky or note, with any date in it read
 * and removed ("call Sam fri 3pm"). Without a date it goes on `defaultDay`.
 */
export function CaptureBar({ defaultDay, groupId = null, placeholder }: { defaultDay: LocalDate | null; groupId?: Id | null; placeholder?: string }) {
  const [text, setText] = useState('');
  const [parse, setParse] = useState<Parser | null>(null);
  const [mode, setMode] = useLocalPref<Mode>('captureMode', 'todo');
  const ensureParser = () => void loadParser().then((p) => setParse(() => p));
  const capture = text.trim() && parse ? parse(text) : null;
  const when = capture?.when ?? (capture?.due || !defaultDay ? null : allDaySpan(defaultDay));
  const rule = parseRule(capture?.recurrence);

  const submit = async () => {
    const typed = text.trim();
    if (!typed) return;
    setText(''); // straight away, so anything typed next isn't lost while this saves
    const c = (await loadParser())(typed);
    const w = c.when ?? (c.due || !defaultDay ? null : allDaySpan(defaultDay));
    const id = await createItem({ kind: mode === 'note' ? 'note' : 'sticky', groupId, text: c.text || typed, when: w, due: c.due, task: mode === 'todo' });
    if (c.recurrence) await updateItem(id, { recurrence: c.recurrence });
    const day = w && spanDays(w)[0];
    const label = day ? (day === todayLocal() ? 'Added to Today' : `Added for ${formatDay(day)}`) : c.due ? `Added, due ${formatSpan(c.due)}` : 'Added to the Inbox';
    recordUndo({ label, undo: () => trashItems([id]), redo: () => restoreItems([id]) });
    toastWithUndo(label);
  };

  return (
    <form
      className="rounded-panel border border-border bg-bg p-2 focus-within:ring-2 focus-within:ring-focus"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={ensureParser}
          aria-label="Quick add"
          placeholder={placeholder ?? 'Add something… try “call Sam fri 3pm” or “pay rent by 1 oct”'}
          className="h-9 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted sm:text-sm"
        />
        <IconButton label="Add" size="sm" type="submit" variant="primary" isDisabled={!text.trim()}>
          <CornerDownLeft size={16} />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-1">
        <RadioGroup value={mode} onChange={(v) => setMode(v as Mode)} aria-label="Add as" orientation="horizontal" className="flex gap-1">
          {MODES.map((m) => (
            <Radio
              key={m.value}
              value={m.value}
              className="cursor-pointer rounded-full px-2.5 py-0.5 text-xs text-muted outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[selected]:bg-accent-soft data-[selected]:font-medium data-[selected]:text-accent"
            >
              {m.label}
            </Radio>
          ))}
        </RadioGroup>
        <span aria-live="polite" className={cn('min-w-0 truncate text-xs text-muted', !capture && 'sr-only')}>
          {capture &&
            [
              capture.text && `“${capture.text}”`,
              when && formatSpan(when),
              capture.due && `due ${formatSpan(capture.due)}`,
              rule && describeRule(rule).toLowerCase(),
            ]
              .filter(Boolean)
              .join(' · ')}
        </span>
      </div>
    </form>
  );
}
