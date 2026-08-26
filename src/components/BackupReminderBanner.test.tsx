import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { BackupReminderBanner } from './BackupReminderBanner';
import { closeDB, putSettings, putProject } from '../db';
import type { Project } from '../types';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await closeDB();
  indexedDB = new IDBFactory();
  localStorage.clear();
});

const makeProject = (): Project => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: 'P', color: 'signal', parentId: null, archived: false, createdAt: now, updatedAt: now };
};

describe('BackupReminderBanner', () => {
  it('stays hidden when there is no data yet', async () => {
    render(<MemoryRouter><BackupReminderBanner /></MemoryRouter>);
    await waitFor(async () => {
      expect(screen.queryByText(/last backup/i)).not.toBeInTheDocument();
    });
    // Allow async check() in useEffect to complete before test ends
    await new Promise((r) => setTimeout(r, 50));
  });

  it('shows when data exists and no backup has ever been made', async () => {
    await putProject(makeProject());
    render(<MemoryRouter><BackupReminderBanner /></MemoryRouter>);
    expect(await screen.findByText(/last backup/i)).toBeInTheDocument();
  });

  it('stays hidden when a recent backup exists', async () => {
    await putProject(makeProject());
    await putSettings({ id: 'app-settings', lastBackupDate: new Date().toISOString(), reminderIntervalDays: 14 });
    render(<MemoryRouter><BackupReminderBanner /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/last backup/i)).not.toBeInTheDocument();
  });
});
