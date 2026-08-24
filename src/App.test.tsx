import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the sidebar and defaults to the Up Next dashboard', async () => {
    render(<App />);
    expect(await screen.findByText('Up Next')).toBeInTheDocument();
    expect(screen.getByText('New project')).toBeInTheDocument();
  });
});
