import { PDFDocument } from 'pdf-lib';
import { paperOps, toPdf, toSvg, type ExportDoc } from './export';
import { layoutPages } from './paper';
import { makeStroke } from './model';

function doc(): ExportDoc {
  const boxes = layoutPages([
    { id: 'p1', paper: { size: 'a4', template: 'lined', colour: 'white' } },
    { id: 'p2', paper: { size: 'letter', template: 'blank', colour: 'dark' } },
  ]);
  const stroke = (id: string, tool: 'ballpoint' | 'highlighter', colour: string) =>
    makeStroke({
      id,
      pageId: 'p1',
      tool,
      colour,
      size: 1,
      pressure: true,
      points: Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 10, y: 200 + (i % 3), p: 0.5, t: i * 8 })),
      createdAt: '',
    });
  return {
    title: 'Lecture <1>',
    boxes,
    strokes: new Map([['p1', [stroke('a', 'ballpoint', 'blue'), stroke('b', 'highlighter', 'yellow')]]]),
    elements: new Map([
      ['p2', [{ id: 'e', pageId: 'p2', kind: 'text', x: 20, y: 20, w: 200, h: 30, text: 'Hello & welcome', fontSize: 18, colour: 'black', attachmentId: null, createdAt: '' }]],
    ]),
    images: new Map(),
    block: false,
  };
}

describe('ink export', () => {
  it('records paper templates as lines', () => {
    const ops = paperOps(doc().boxes[0]!);
    expect(ops[0]).toMatchObject({ kind: 'rect', colour: '#ffffff' });
    expect(ops.filter((o) => o.kind === 'line').length).toBeGreaterThan(20);
    expect(paperOps(doc().boxes[1]!)).toHaveLength(1); // blank: just the paper
  });

  it('writes an SVG with paper, text and ink (highlighter first)', async () => {
    const svg = await toSvg(doc());
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('<title>Lecture &lt;1&gt;</title>');
    expect(svg).toContain('Hello &amp; welcome');
    expect(svg).toContain('fill="#1c1f22"'.replace('#1c1f22', '#e8eaed')); // black text on dark paper turns light
    const hi = svg.indexOf('fill-opacity="0.35"');
    const pen = svg.indexOf('fill="#1f5fbf"');
    expect(hi).toBeGreaterThan(0);
    expect(pen).toBeGreaterThan(hi);
  });

  it('writes a PDF with one real-size page per page', async () => {
    const pdf = await PDFDocument.load(new Uint8Array(await (await toPdf(doc())).arrayBuffer()));
    expect(pdf.getPageCount()).toBe(2);
    const [a4, letter] = pdf.getPages();
    expect(Math.round(a4!.getWidth())).toBe(596); // 210 mm
    expect(Math.round(letter!.getHeight())).toBe(792); // 11 in
    expect(pdf.getTitle()).toBe('Lecture <1>');
  });
});

it('writes smooth curves as explicit Q commands for PDF, tracing the same shape', async () => {
  const { svgPath, svgPathExplicit } = await import('./strokeStyle');
  const pts = [[0, 0], [10, 0], [20, 5], [30, 15], [40, 10], [50, 0]];
  const explicit = svgPathExplicit(pts);
  expect(explicit).not.toContain('T');
  expect(explicit.match(/Q/g)).toHaveLength(4);
  // The first curve is the same in both forms.
  expect(svgPath(pts).startsWith(explicit.slice(0, explicit.indexOf(' Q', 3)))).toBe(true);
});
