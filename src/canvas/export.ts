import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { db } from '@/data/db';
import { loadInk } from '@/data/repos/ink';
import type { InkElement } from '@/data/types';
import { fromStored, type InkStroke } from './model';
import { BLOCK_SIZE, drawPaper, layoutPages, PAGE_GAP, type PageBox } from './paper';
import { resolveInk } from './inkColours';
import { PEN_STYLES, strokePath } from './strokeStyle';
import { paintElements, renderPageCanvas, TEXT_FONT, TEXT_LINE_HEIGHT, TEXT_PAD, wrapText } from './render';

/**
 * Export and print (INK-17, P3.9): vector PDF and SVG, PNG of a page, and printing.
 * Loaded only when someone exports. Paper templates are drawn once by `drawPaper` into a
 * recording context, and the recording is replayed as SVG or PDF, so every format matches
 * what's on screen.
 */

export interface ExportDoc {
  title: string;
  boxes: PageBox[];
  strokes: Map<string, InkStroke[]>;
  elements: Map<string, InkElement[]>;
  /** Pictures for image elements, by attachment id. */
  images: Map<string, Blob>;
  /** Sketches export only their drawn area. */
  block: boolean;
}

/** Everything an export needs: an ink note (`itemId`) or a sketch (`docId`). */
export async function loadExportDoc(itemId: string, docId?: string): Promise<ExportDoc> {
  const { doc, pages, strokes, elements } = await loadInk(itemId, docId);
  const item = await db.items.get(itemId);
  const byPage = <T extends { pageId: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.pageId, [...(m.get(x.pageId) ?? []), x]);
    for (const v of m.values()) v.sort((a, b) => ((a as { id?: string }).id! < (b as { id?: string }).id! ? -1 : 1));
    return m;
  };
  const strokeMap = byPage(strokes.map(fromStored));
  const elementMap = byPage(elements);
  const block = doc.layout === 'block';
  const bottom = (id: string) => Math.max(0, ...(strokeMap.get(id) ?? []).map((s) => s.bbox[3]), ...(elementMap.get(id) ?? []).map((e) => e.y + e.h));
  let boxes = layoutPages(pages, bottom, block ? BLOCK_SIZE : undefined);
  if (block) boxes = boxes.map((b) => ({ ...b, h: Math.min(b.h, Math.max(160, bottom(b.id) + 32)) }));
  const images = new Map<string, Blob>();
  for (const e of elements) {
    if (!e.attachmentId) continue;
    const att = await db.attachments.get(e.attachmentId);
    if (att) images.set(att.id, att.blob);
  }
  return { title: block ? 'Sketch' : item?.title || 'Untitled', boxes, strokes: strokeMap, elements: elementMap, images, block };
}

// ---- Paper as a recording ----------------------------------------------------------

type PaperOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; colour: string }
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number; colour: string; width: number }
  | { kind: 'text'; text: string; x: number; y: number; size: number; colour: string };

/** Just enough of CanvasRenderingContext2D for drawPaper, writing down what it draws. */
class RecordingContext {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  font = '12px sans-serif';
  textBaseline = 'alphabetic';
  ops: PaperOp[] = [];
  private path: Array<[number, number, number, number]> = [];
  private at: [number, number] = [0, 0];
  fillRect(x: number, y: number, w: number, h: number) {
    this.ops.push({ kind: 'rect', x, y, w, h, colour: this.fillStyle });
  }
  beginPath() {
    this.path = [];
  }
  moveTo(x: number, y: number) {
    this.at = [x, y];
  }
  lineTo(x: number, y: number) {
    this.path.push([this.at[0], this.at[1], x, y]);
    this.at = [x, y];
  }
  stroke() {
    for (const [x0, y0, x1, y1] of this.path) this.ops.push({ kind: 'line', x0, y0, x1, y1, colour: this.strokeStyle, width: this.lineWidth });
  }
  fillText(text: string, x: number, y: number) {
    this.ops.push({ kind: 'text', text, x, y, size: parseFloat(this.font) || 12, colour: this.fillStyle });
  }
}

export function paperOps(box: PageBox, hairline = 0.6): PaperOp[] {
  const rec = new RecordingContext();
  drawPaper(rec as unknown as CanvasRenderingContext2D, box, hairline);
  return rec.ops;
}

// ---- SVG ----------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => Math.round(v * 100) / 100;

let measurer: CanvasRenderingContext2D | null = null;
function measure(text: string, size: number) {
  measurer ??= document.createElement('canvas').getContext('2d');
  if (!measurer) return text.length * size * 0.5;
  measurer.font = `${size}px ${TEXT_FONT}`;
  return measurer.measureText(text).width;
}

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function strokeD(s: InkStroke, explicit = false) {
  return strokePath({ tool: s.tool, scale: s.size, points: s.points, pressure: s.pressure, complete: true }, explicit);
}

/** One SVG with the pages stacked as they are on screen. Vector throughout. */
export async function toSvg(doc: ExportDoc): Promise<string> {
  const width = Math.max(...doc.boxes.map((b) => b.w));
  const height = doc.boxes.reduce((h, b) => h + b.h, 0) + PAGE_GAP * Math.max(0, doc.boxes.length - 1);
  const parts: string[] = [];
  let y = 0;
  for (const box of doc.boxes) {
    const g: string[] = [`<g transform="translate(${n((width - box.w) / 2)} ${n(y)})">`, `<clipPath id="p${box.id}"><rect width="${box.w}" height="${box.h}"/></clipPath>`, `<g clip-path="url(#p${box.id})">`];
    for (const op of paperOps(box)) {
      if (op.kind === 'rect') g.push(`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${op.colour}"/>`);
      else if (op.kind === 'line') g.push(`<line x1="${n(op.x0)}" y1="${n(op.y0)}" x2="${n(op.x1)}" y2="${n(op.y1)}" stroke="${op.colour}" stroke-width="${n(op.width)}"/>`);
      else g.push(`<text x="${n(op.x)}" y="${n(op.y + op.size)}" font-size="${op.size}" font-family="sans-serif" fill="${op.colour}">${esc(op.text)}</text>`);
    }
    for (const el of doc.elements.get(box.id) ?? []) {
      if (el.kind === 'image') {
        const blob = el.attachmentId ? doc.images.get(el.attachmentId) : undefined;
        if (blob) g.push(`<image x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" preserveAspectRatio="none" href="${await dataUrl(blob)}"/>`);
        continue;
      }
      const lh = el.fontSize * TEXT_LINE_HEIGHT;
      const lines = wrapText(el.text, el.w - TEXT_PAD.x * 2, (t) => measure(t, el.fontSize));
      const spans = lines.map((line, i) => `<tspan x="${n(el.x + TEXT_PAD.x)}" y="${n(el.y + TEXT_PAD.y + i * lh + (lh - el.fontSize) / 2 + el.fontSize * 0.8)}">${esc(line)}</tspan>`);
      g.push(`<text font-size="${el.fontSize}" font-family="${esc(TEXT_FONT)}" fill="${resolveInk(el.colour, box.paper.colour)}" xml:space="preserve">${spans.join('')}</text>`);
    }
    const strokes = doc.strokes.get(box.id) ?? [];
    for (const s of [...strokes.filter((s) => s.tool === 'highlighter'), ...strokes.filter((s) => s.tool !== 'highlighter')]) {
      const op = PEN_STYLES[s.tool].opacity;
      g.push(`<path d="${strokeD(s)}" fill="${resolveInk(s.colour, box.paper.colour)}"${op < 1 ? ` fill-opacity="${op}"` : ''}/>`);
    }
    g.push('</g></g>');
    parts.push(g.join(''));
    y += box.h + PAGE_GAP;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}"><title>${esc(doc.title)}</title>${parts.join('')}</svg>`;
}

// ---- PNG ----------------------------------------------------------------------------

async function decodeImages(doc: ExportDoc): Promise<Map<string, ImageBitmap>> {
  const out = new Map<string, ImageBitmap>();
  for (const [id, blob] of doc.images) {
    try {
      out.set(id, await createImageBitmap(blob));
    } catch {
      /* an unreadable picture is left out rather than failing the export */
    }
  }
  return out;
}

const canvasBlob = (c: HTMLCanvasElement, type = 'image/png') =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The image couldn’t be made.'))), type));

/** One page as a PNG, `scale` × its size in CSS pixels (2 = crisp on most screens and in print). */
export async function pagePng(doc: ExportDoc, pageIndex: number, scale = 2): Promise<Blob> {
  const box = doc.boxes[pageIndex] ?? doc.boxes[0]!;
  const images = await decodeImages(doc);
  return canvasBlob(renderPageCanvas(box, doc.strokes.get(box.id) ?? [], box.w, scale, undefined, doc.elements.get(box.id) ?? [], images));
}

// ---- PDF ----------------------------------------------------------------------------

/** CSS px (96 per inch) to PDF points (72 per inch). */
const PT = 0.75;

function colour(hex: string) {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

async function embedImage(pdf: PDFDocument, blob: Blob): Promise<PDFImage | null> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (blob.type === 'image/png') return await pdf.embedPng(bytes);
    if (blob.type === 'image/jpeg') return await pdf.embedJpg(bytes);
    // Anything else (WebP, GIF, SVG…) goes through a canvas to PNG.
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    return await pdf.embedPng(new Uint8Array(await (await canvasBlob(c)).arrayBuffer()));
  } catch {
    return null;
  }
}

/** Can the standard PDF font write this text? (It covers Western European text, not emoji or CJK.) */
function encodable(font: PDFFont, text: string) {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

async function drawTextBox(pdf: PDFDocument, page: PDFPage, font: PDFFont, el: InkElement, box: PageBox, top: (y: number) => number, images: Map<string, ImageBitmap>) {
  const fill = resolveInk(el.colour, box.paper.colour);
  if (encodable(font, el.text.replace(/\n/g, ''))) {
    const lh = el.fontSize * TEXT_LINE_HEIGHT;
    const lines = wrapText(el.text, el.w - TEXT_PAD.x * 2, (t) => font.widthOfTextAtSize(t, el.fontSize));
    lines.forEach((line, i) => {
      if (!line) return;
      page.drawText(line, { x: (el.x + TEXT_PAD.x) * PT, y: top(el.y + TEXT_PAD.y + i * lh + (lh - el.fontSize) / 2 + el.fontSize * 0.8), size: el.fontSize * PT, font, color: colour(fill) });
    });
    return;
  }
  // Text the standard font can't write is drawn as a picture of the text box instead.
  const h = Math.max(el.h, el.fontSize * TEXT_LINE_HEIGHT);
  const c = document.createElement('canvas');
  c.width = Math.ceil(el.w * 3);
  c.height = Math.ceil(h * 3);
  const ctx = c.getContext('2d')!;
  ctx.scale(3, 3);
  paintElements(ctx, box, [{ ...el, x: 0, y: 0 }], images);
  const img = await pdf.embedPng(new Uint8Array(await (await canvasBlob(c)).arrayBuffer()));
  page.drawImage(img, { x: el.x * PT, y: top(el.y + h), width: el.w * PT, height: h * PT });
}

/** A vector PDF, one PDF page per page, at real size. */
export async function toPdf(doc: ExportDoc): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  pdf.setCreator('NoteDoco');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bitmaps = await decodeImages(doc);
  const embedded = new Map<string, PDFImage | null>();
  for (const box of doc.boxes) {
    const page = pdf.addPage([box.w * PT, box.h * PT]);
    const top = (y: number) => (box.h - y) * PT;
    for (const op of paperOps(box)) {
      if (op.kind === 'rect') page.drawRectangle({ x: op.x * PT, y: top(op.y + op.h), width: op.w * PT, height: op.h * PT, color: colour(op.colour) });
      else if (op.kind === 'line')
        page.drawLine({ start: { x: op.x0 * PT, y: top(op.y0) }, end: { x: op.x1 * PT, y: top(op.y1) }, thickness: op.width * PT, color: colour(op.colour) });
      else page.drawText(op.text, { x: op.x * PT, y: top(op.y + op.size * 0.85), size: op.size * PT, font, color: colour(op.colour) });
    }
    for (const el of doc.elements.get(box.id) ?? []) {
      if (el.kind === 'text') {
        await drawTextBox(pdf, page, font, el, box, top, bitmaps);
        continue;
      }
      const blob = el.attachmentId ? doc.images.get(el.attachmentId) : undefined;
      if (!blob || !el.attachmentId) continue;
      if (!embedded.has(el.attachmentId)) embedded.set(el.attachmentId, await embedImage(pdf, blob));
      const img = embedded.get(el.attachmentId);
      if (img) page.drawImage(img, { x: el.x * PT, y: top(el.y + el.h), width: el.w * PT, height: el.h * PT });
    }
    const strokes = doc.strokes.get(box.id) ?? [];
    for (const s of [...strokes.filter((s) => s.tool === 'highlighter'), ...strokes.filter((s) => s.tool !== 'highlighter')]) {
      const d = strokeD(s, true);
      if (!d) continue;
      // drawSvgPath uses SVG's y-down coordinates from the point given (the page's top-left).
      page.drawSvgPath(d, { x: 0, y: box.h * PT, scale: PT, color: colour(resolveInk(s.colour, box.paper.colour)), opacity: PEN_STYLES[s.tool].opacity, borderWidth: 0 });
    }
  }
  return new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' });
}

// ---- Print --------------------------------------------------------------------------

/** Prints the pages at their real size, through a hidden frame (works offline). */
export async function printDoc(doc: ExportDoc): Promise<void> {
  const urls: string[] = [];
  for (let i = 0; i < doc.boxes.length; i++) urls.push(URL.createObjectURL(await pagePng(doc, i, 2)));
  const sizes = new Set(doc.boxes.map((b) => b.paper.size));
  const pageSize = sizes.size === 1 && sizes.has('a4') ? 'A4' : sizes.size === 1 && sizes.has('letter') ? 'letter' : 'auto';
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.srcdoc = `<!doctype html><html><head><title>${esc(doc.title)}</title><style>@page{size:${pageSize};margin:0}html,body{margin:0}img{display:block;width:100%;break-after:page}img:last-child{break-after:auto}</style></head><body>${urls.map((u) => `<img src="${u}" alt="">`).join('')}</body></html>`;
  await new Promise<void>((resolve) => {
    frame.onload = () => {
      const win = frame.contentWindow;
      const done = () => {
        frame.remove();
        urls.forEach((u) => URL.revokeObjectURL(u));
        resolve();
      };
      if (!win) return done();
      win.addEventListener('afterprint', () => setTimeout(done, 100));
      // Wait for the page images to decode before opening the print dialog.
      void Promise.all([...win.document.images].map((img) => img.decode().catch(() => undefined))).then(() => {
        win.focus();
        win.print();
      });
    };
    document.body.appendChild(frame);
  });
}
