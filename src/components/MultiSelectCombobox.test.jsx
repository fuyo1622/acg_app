import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MultiSelectCombobox from './MultiSelectCombobox';

function ControlledCombobox({ initialValue = [], options = [] }) {
  const [value, setValue] = useState(initialValue);

  return (
    <MultiSelectCombobox
      id="series"
      label="Series"
      value={value}
      options={options}
      placeholder="Type to search or add..."
      addLabel={'Add "{value}"'}
      removeLabel="Remove {value}"
      onChange={setValue}
    />
  );
}

function renderCombobox(props) {
  render(<ControlledCombobox {...props} />);
  return screen.getByRole('combobox', { name: 'Series' });
}

describe('MultiSelectCombobox', () => {
  afterEach(cleanup);

  it('opens on input, moves through options with the arrow keys and selects with Enter', () => {
    const input = renderCombobox({ options: ['Evangelion', 'Evangelion: 3.0+1.0', 'Gundam'] });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'eva' } });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3); // two matches plus the "add new" entry
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Evangelion: 3.0+1.0')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('wraps arrow navigation around both ends of the list', () => {
    const input = renderCombobox({ options: ['Evangelion', 'Evangelion: 3.0+1.0'] });
    fireEvent.change(input, { target: { value: 'eva' } });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const options = screen.getAllByRole('option');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('offers a new value only when it is not already known', () => {
    const input = renderCombobox({ options: ['Gundam'] });

    fireEvent.change(input, { target: { value: 'Nendoroid' } });
    expect(screen.getByRole('option', { name: 'Add "Nendoroid"' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'gundam' } });
    expect(screen.queryByRole('option', { name: 'Add "gundam"' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gundam' })).toBeInTheDocument();
  });

  it('closes the list with Escape and removes the last chip with Backspace', () => {
    const input = renderCombobox({ initialValue: ['Asuka', 'Rei'], options: ['Asuka', 'Rei'] });

    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(screen.queryByText('Rei')).not.toBeInTheDocument();
    expect(screen.getByText('Asuka')).toBeInTheDocument();
  });

  it('removes a chip through its labelled button', () => {
    renderCombobox({ initialValue: ['Asuka', 'Rei'] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Asuka' }));
    expect(screen.queryByText('Asuka')).not.toBeInTheDocument();
    expect(screen.getByText('Rei')).toBeInTheDocument();
  });
});
