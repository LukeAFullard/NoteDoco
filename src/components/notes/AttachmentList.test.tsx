import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { closeDB, putAttachment, getAttachmentsByNote } from '../../db';
import { AttachmentList } from './AttachmentList';
import type { Attachment } from '../../types';

beforeEach(async () => {
  cleanup();
  await closeDB();
  indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

describe('AttachmentList', () => {
  const noteId = 'test-note-id';

  it('renders existing attachments and deletes one on request', async () => {
    const att: Attachment = {
      id: 'att-1',
      noteId,
      filename: 'sample.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      blob: new Blob(['pdf data'], { type: 'application/pdf' }),
      createdAt: new Date().toISOString(),
    };
    await putAttachment(att);

    render(<AttachmentList noteId={noteId} />);

    expect(await screen.findByText('sample.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const deleteBtn = screen.getByRole('button', { name: /delete attachment sample\.pdf/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('No attached files.')).toBeInTheDocument();
    });

    const remaining = await getAttachmentsByNote(noteId);
    expect(remaining).toHaveLength(0);
  });

  it('allows attaching a file', async () => {
    render(<AttachmentList noteId={noteId} />);

    expect(screen.getByText('No attached files.')).toBeInTheDocument();

    const file = new File(['hello content'], 'notes.txt', { type: 'text/plain' });
    const fileInput = screen.getByText('Attach file').closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Attach file via file input
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('notes.txt')).toBeInTheDocument();

    const saved = await getAttachmentsByNote(noteId);
    expect(saved).toHaveLength(1);
    expect(saved[0].filename).toBe('notes.txt');
  });
});
