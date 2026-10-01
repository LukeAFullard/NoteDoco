import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';
import { attachmentIdFromUrl, objectUrlFor } from '@/data/repos/attachments';
import { sketchIdFromUrl } from '@/data/repos/ink';
import { openSketch } from '@/features/ink/sketchDialog';

/**
 * A sketch block (NOTE-8) is an image whose source is `ndoco:ink/<doc id>`: it shows a live
 * preview of the drawing, and opens the sketch editor when pressed (or with Enter when
 * selected). The preview code (stroke rendering) loads only when a note has a sketch.
 */
function sketchView(docId: string) {
  const dom = document.createElement('figure');
  dom.className = 'note-sketch';
  dom.contentEditable = 'false';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'note-sketch-button';
  button.setAttribute('aria-label', 'Sketch. Press to draw.');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('figcaption');
  hint.className = 'note-sketch-hint';
  hint.textContent = 'Tap to draw';
  button.append(canvas);
  dom.append(button, hint);
  button.addEventListener('click', () => openSketch(docId));
  let stop: (() => void) | null = null;
  let alive = true;
  void import('@/features/ink/sketchPreview').then((m) => {
    if (!alive) return;
    stop = m.mountSketchPreview(canvas, dom, docId, (missing) => {
      hint.textContent = missing ? 'This sketch isn’t stored on this device' : 'Tap to draw';
    });
  });
  return {
    dom,
    stopEvent: (e: Event) => e.target instanceof Node && button.contains(e.target),
    ignoreMutation: () => true,
    destroy: () => {
      alive = false;
      stop?.();
    },
  };
}

/**
 * Images stored as attachments are written in Markdown as `ndoco:attachment/<id>` (portable
 * and stable); this node view swaps in a blob URL for display.
 */
export const AttachmentImage = Image.extend({
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        const id = sel instanceof NodeSelection && sel.node.type.name === this.name ? sketchIdFromUrl(sel.node.attrs.src ?? '') : null;
        if (!id) return false;
        openSketch(id);
        return true;
      },
    };
  },
  addNodeView() {
    return ({ node }) => {
      const sketch = sketchIdFromUrl(node.attrs.src ?? '');
      if (sketch) return sketchView(sketch);
      const img = document.createElement('img');
      img.className = 'note-image';
      img.draggable = true;
      const show = (src: string, alt: string) => {
        img.alt = alt ?? '';
        const id = attachmentIdFromUrl(src ?? '');
        if (!id) {
          img.src = src ?? '';
          return;
        }
        void objectUrlFor(id).then((url) => {
          if (url) img.src = url;
          else img.alt = `${alt || 'Image'} (missing)`;
        });
      };
      show(node.attrs.src, node.attrs.alt);
      return {
        dom: img,
        update: (n) => {
          if (n.type !== node.type) return false;
          show(n.attrs.src, n.attrs.alt);
          return true;
        },
      };
    };
  },
}).configure({ allowBase64: false });
