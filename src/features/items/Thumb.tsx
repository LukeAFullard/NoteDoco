import { useAttachmentUrl } from '@/data/hooks';

/** An item's thumbnail picture (ink notes), or nothing while it loads or if there isn't one. Decorative: the title says what it is. */
export function Thumb({ id, className }: { id: string | null; className?: string }) {
  const url = useAttachmentUrl(id);
  return url ? <img src={url} alt="" draggable={false} className={className} /> : null;
}
