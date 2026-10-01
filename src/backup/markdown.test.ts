import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { createItem, setManualTags } from '@/data/repos/items';
import { listGroups } from '@/data/repos/groups';
import { blobText } from '@/lib/blob';
import { exportNote, importTextFiles, parseFrontMatter, safeFileName } from './markdown';

beforeEach(freshDb);

const file = (text: string, name: string, relative = '') => {
  const f = new File([text], name);
  if (relative) Object.defineProperty(f, 'webkitRelativePath', { value: relative });
  return f;
};

it('exports a note as Markdown with front matter', async () => {
  const id = await createItem({ kind: 'note', text: '# Plan: Q4?\n- [ ] ship' });
  await setManualTags(id, ['work']);
  const out = await exportNote(id);
  expect(out.name).toBe('Plan Q4.md');
  const md = await blobText(out.blob);
  expect(md).toMatch(/^---\ntitle: "Plan: Q4\?"\ntags: \["work"\]\ncreated: .+\nupdated: .+\n---\n# Plan: Q4\?\n- \[ \] ship$/);
});

it('parses front matter in its common shapes', () => {
  expect(parseFrontMatter('---\ntitle: "Hi"\ntags: [a, "b"]\n---\nBody')).toEqual({ title: 'Hi', tags: ['a', 'b'], body: 'Body' });
  expect(parseFrontMatter('---\ntags:\n  - x\n  - y\n---\nBody').tags).toEqual(['x', 'y']);
  expect(parseFrontMatter('No front matter').body).toBe('No front matter');
});

it('imports files and folders, turning folders into nested groups', async () => {
  const n = await importTextFiles(
    [
      file('---\ntags: [ideas]\n---\nGreat idea', 'Idea.md', 'Vault/Projects/Idea.md'),
      file('# Shopping\n- milk', 'Shopping.md', 'Vault/Shopping.md'),
      file('plain words', 'log.txt', 'Vault/log.txt'),
      file('skip me', 'photo.png', 'Vault/photo.png'),
    ],
    null,
  );
  expect(n).toBe(3);
  const groups = await listGroups();
  expect(groups.map((g) => g.name).sort()).toEqual(['Projects', 'Vault']);
  const items = await db.items.toArray();
  const idea = items.find((i) => i.title === 'Idea')!;
  expect(idea.tags).toEqual(['ideas']);
  expect(idea.groupId).toBe(groups.find((g) => g.name === 'Projects')!.id);
  expect(items.find((i) => i.title === 'Shopping')).toBeDefined();
  expect((await db.noteBodies.get(items.find((i) => i.title === 'log')!.id))!.format).toBe('plain');
});

it('makes safe file names', () => {
  expect(safeFileName('a/b:c*?')).toBe('a b c');
  expect(safeFileName('   ')).toBe('Untitled');
});
