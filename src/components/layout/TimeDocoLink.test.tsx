import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimeDocoLink } from './TimeDocoLink';

describe('TimeDocoLink', () => {
  it('links to the TimeDoco app in a new tab', () => {
    render(<TimeDocoLink />);
    const link = screen.getByRole('link', { name: /track time with timedoco/i });
    expect(link).toHaveAttribute('href', 'https://timedoco.com/app/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
