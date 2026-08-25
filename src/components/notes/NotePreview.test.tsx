import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotePreview } from './NotePreview';

describe('NotePreview', () => {
  it('renders checklist items as checkboxes and reports the toggled line', () => {
    const onToggleLine = vi.fn();
    render(<NotePreview content={'Intro paragraph\n\n- [ ] first\n- [x] second'} onToggleLine={onToggleLine} />);

    expect(screen.getByText('Intro paragraph')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    fireEvent.click(checkboxes[0]);
    expect(onToggleLine).toHaveBeenCalledWith(2);
  });
});
