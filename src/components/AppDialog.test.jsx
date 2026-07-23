import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppDialog from './AppDialog';

describe('AppDialog accessibility', () => {
  afterEach(cleanup);

  it('labels a destructive dialog, focuses the safe action and supports Escape', () => {
    const onCancel = vi.fn();
    render(
      <AppDialog
        open
        title="Delete item?"
        message="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        destructive
      />,
    );

    expect(screen.getByRole('alertdialog', { name: 'Delete item?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab focus inside the dialog', () => {
    render(
      <AppDialog
        open
        title="Notice"
        message="Done"
        confirmLabel="Close"
        cancelLabel="Back"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
  });
});
