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

  it('offers a third choice between cancelling and confirming, and Escape still only cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onSecondary = vi.fn();
    render(
      <AppDialog
        open
        title="Continue the last backup?"
        message="2 files are saved."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        secondaryLabel="Start over"
        onConfirm={onConfirm}
        onCancel={onCancel}
        onSecondary={onSecondary}
      />,
    );

    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Cancel', 'Start over', 'Continue']);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
