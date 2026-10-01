import { useMemo, useState } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { Dialog } from '@/design/Dialog';
import { Button } from '@/design/Button';
import { toastWithUndo } from '@/app/undoActions';
import { setPaperWithUndo } from '@/data/actions';
import type { Paper } from '@/data/types';
import { PAPER_COLOUR_LABELS } from '@/canvas/inkColours';
import { PAGE_SIZES, type PageBox } from '@/canvas/paper';
import { renderPageCanvas } from '@/canvas/render';

const SIZES: Array<[Paper['size'], string]> = [
  ['a4', 'A4'],
  ['letter', 'Letter'],
  ['endless', 'Endless (grows as you write)'],
];
const TEMPLATES: Array<[Paper['template'], string]> = [
  ['blank', 'Blank'],
  ['lined', 'Lined'],
  ['grid', 'Squared'],
  ['dot', 'Dotted'],
  ['cornell', 'Cornell'],
  ['planner', 'Day planner'],
];

const optionCls =
  'group flex cursor-pointer items-center gap-2 rounded-panel border border-border px-2 py-1.5 text-sm outline-none data-[selected]:border-accent data-[selected]:bg-accent-soft data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus';

function Group<T extends string>({ label, value, onChange, options, preview }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]>; preview?: (v: T) => string }) {
  return (
    <RadioGroup value={value} onChange={(v) => onChange(v as T)} className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, text]) => (
          <Radio key={v} value={v} className={optionCls}>
            {preview && <img src={preview(v)} alt="" width={36} className="rounded-sm border border-border" />}
            {text}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}

/** Paper size, template and colour for this page or every page (INK-8). */
export function PaperDialog({ itemId, page, block, onClose }: { itemId: string; page: PageBox; block?: boolean; onClose: () => void }) {
  const [paper, setPaper] = useState<Paper>(page.paper);
  const [scope, setScope] = useState<'page' | 'all'>('all');
  const previews = useMemo(() => {
    const out = {} as Record<Paper['template'], string>;
    for (const [t] of TEMPLATES) {
      const box: PageBox = { id: 'preview', x: 0, y: 0, w: PAGE_SIZES.a4.w, h: PAGE_SIZES.a4.h, paper: { ...paper, size: 'a4', template: t } };
      out[t] = renderPageCanvas(box, [], 36, 2).toDataURL();
    }
    return out;
  }, [paper]);
  const apply = async () => {
    toastWithUndo(await setPaperWithUndo(itemId, paper, scope === 'page' || block ? [page.id] : undefined));
    onClose();
  };
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title="Paper">
      <div className="flex flex-col gap-4 p-5">
        <Group label="Template" value={paper.template} onChange={(template) => setPaper({ ...paper, template })} options={TEMPLATES} preview={(t) => previews[t]} />
        {!block && <Group label="Size" value={paper.size === 'infinite' ? 'endless' : paper.size} onChange={(size) => setPaper({ ...paper, size })} options={SIZES} />}
        <Group
          label="Colour"
          value={paper.colour}
          onChange={(colour) => setPaper({ ...paper, colour })}
          options={(Object.keys(PAPER_COLOUR_LABELS) as Paper['colour'][]).map((c) => [c, PAPER_COLOUR_LABELS[c]])}
        />
        {!block && (
          <Group
            label="Use for"
            value={scope}
            onChange={setScope}
            options={[
              ['all', 'All pages (and new ones)'],
              ['page', 'This page only'],
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onPress={() => void apply()}>
            Apply
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
