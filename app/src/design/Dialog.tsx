import type { ReactNode } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { cn } from './cn';

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Hide the visible title (it stays available to screen readers). */
  hideTitle?: boolean;
}

/** A centred dialog on wide screens and a bottom sheet on phones. */
export function Dialog({ isOpen, onOpenChange, title, children, className, hideTitle }: DialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-start sm:pt-[12vh]"
    >
      <Modal
        className={cn(
          'w-full max-h-[85vh] overflow-auto border border-border bg-surface text-text shadow-xl',
          'rounded-t-2xl sm:max-w-lg sm:rounded-panel',
          className,
        )}
      >
        <AriaDialog className="outline-none">
          <Heading slot="title" className={hideTitle ? 'sr-only' : 'px-5 pt-5 text-lg font-semibold'}>
            {title}
          </Heading>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
