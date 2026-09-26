import Image from '@tiptap/extension-image';
import { attachmentIdFromUrl, objectUrlFor } from '@/data/repos/attachments';

/**
 * Images stored as attachments are written in Markdown as `ndoco:attachment/<id>` (portable
 * and stable); this node view swaps in a blob URL for display.
 */
export const AttachmentImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
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
