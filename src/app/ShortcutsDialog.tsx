import { Dialog } from '@/design/Dialog';
import { Kbd } from '@/design/Kbd';
import { useUi } from './ui';

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const SECTIONS: Array<[string, Array<[string, string[]]>]> = [
  [
    'Anywhere',
    [
      ['Search and commands', [mod, 'K']],
      ['New note', ['N']],
      ['New sticky', ['S']],
      ['New ink note', ['D']],
      ['Undo / redo', [mod, 'Z']],
      ['Keyboard shortcuts', ['?']],
    ],
  ],
  [
    'Ink notes',
    [
      ['Ballpoint, fountain pen, marker', ['P', 'F', 'M']],
      ['Highlighter, eraser', ['H', 'E']],
      ['Zoom in / out / fit', ['+', '−', '0']],
      ['Scroll', ['←', '→', '↑', '↓']],
      ['Pan with the mouse', ['Space', 'drag']],
      ['Zoom with the mouse', [mod, 'scroll']],
    ],
  ],
  [
    'Lists',
    [
      ['Select several', [mod, 'click']],
      ['Select a range', ['Shift', 'click']],
      ['Clear selection', ['Esc']],
    ],
  ],
  [
    'Timeline and calendar',
    [
      ['Move between items', ['←', '→', '↑', '↓']],
      ['Reschedule', ['Alt', '←', '→']],
      ['Move to another lane', ['Alt', '↑', '↓']],
      ['Zoom in / out', ['+', '−']],
      ['Go to today', ['T']],
      ['Open', ['Enter']],
    ],
  ],
  [
    'Writing',
    [
      ['Insert a block', ['/']],
      ['Find and replace', [mod, 'F']],
      ['Checklist', ['[ ]', 'space']],
      ['Heading', ['#', 'space']],
      ['Date', ['@fri', 'space']],
      ['Link to a note', ['[[', 'name', ']]']],
      ['Leave focus mode', ['Esc']],
    ],
  ],
];

export function ShortcutsDialog() {
  return (
    <Dialog isOpen onOpenChange={(o) => !o && useUi.setState({ shortcutsOpen: false })} title="Keyboard shortcuts">
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {SECTIONS.map(([title, rows]) => (
          <section key={title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
            <dl className="space-y-1.5 text-sm">
              {rows.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt>{label}</dt>
                  <dd className="flex gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
