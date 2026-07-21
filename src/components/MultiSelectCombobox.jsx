import { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toValueArray } from '../utils/valueUtils';

export default function MultiSelectCombobox({
  id,
  label,
  value,
  options,
  placeholder,
  addLabel,
  removeLabel,
  onChange,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const selectedValues = useMemo(() => toValueArray(value), [value]);
  const normalizedOptions = useMemo(() => toValueArray(options), [options]);
  const trimmedQuery = query.trim();

  const menuItems = useMemo(() => {
    if (!trimmedQuery) return [];

    const queryLower = trimmedQuery.toLocaleLowerCase();
    const selectedKeys = new Set(selectedValues.map(item => item.toLocaleLowerCase()));
    const matches = normalizedOptions
      .filter(option => !selectedKeys.has(option.toLocaleLowerCase()))
      .filter(option => option.toLocaleLowerCase().includes(queryLower))
      .map(option => ({ type: 'option', value: option }));
    const isKnownValue = [...normalizedOptions, ...selectedValues]
      .some(option => option.toLocaleLowerCase() === queryLower);

    if (!isKnownValue) matches.push({ type: 'new', value: trimmedQuery });
    return matches;
  }, [normalizedOptions, selectedValues, trimmedQuery]);

  const chooseValue = (nextValue) => {
    onChange(toValueArray([...selectedValues, nextValue]));
    setQuery('');
    setIsOpen(false);
    setActiveIndex(0);
  };

  const removeValue = (valueToRemove) => {
    onChange(selectedValues.filter(item => item !== valueToRemove));
  };

  const handleInputChange = (event) => {
    setQuery(event.target.value);
    setIsOpen(Boolean(event.target.value.trim()));
    setActiveIndex(0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && menuItems.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => (index + 1) % menuItems.length);
    } else if (event.key === 'ArrowUp' && menuItems.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => (index - 1 + menuItems.length) % menuItems.length);
    } else if (event.key === 'Enter' && isOpen && menuItems.length) {
      event.preventDefault();
      chooseValue(menuItems[Math.min(activeIndex, menuItems.length - 1)].value);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'Backspace' && !query && selectedValues.length) {
      removeValue(selectedValues[selectedValues.length - 1]);
    }
  };

  const handleBlur = (event) => {
    if (!containerRef.current?.contains(event.relatedTarget)) setIsOpen(false);
  };

  const listboxId = `${id}-options`;

  return (
    <div className="multi-select" ref={containerRef} onBlur={handleBlur}>
      <div className={`multi-select-control${isOpen ? ' is-open' : ''}`}>
        {selectedValues.map(selectedValue => (
          <span className="multi-select-chip" key={selectedValue}>
            <span>{selectedValue}</span>
            <button
              type="button"
              onClick={() => removeValue(selectedValue)}
              aria-label={removeLabel.replace('{value}', selectedValue)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(Boolean(trimmedQuery))}
          onKeyDown={handleKeyDown}
          placeholder={selectedValues.length ? '' : placeholder}
          autoComplete="off"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={isOpen && menuItems.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={isOpen && menuItems.length ? `${id}-option-${activeIndex}` : undefined}
        />
      </div>

      {isOpen && menuItems.length > 0 && (
        <div className="multi-select-menu" id={listboxId} role="listbox">
          {menuItems.map((item, index) => (
            <button
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`multi-select-option${index === activeIndex ? ' is-active' : ''}`}
              key={`${item.type}-${item.value}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseValue(item.value)}
            >
              {item.type === 'new' && <Plus size={16} aria-hidden="true" />}
              <span>{item.type === 'new' ? addLabel.replace('{value}', item.value) : item.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
