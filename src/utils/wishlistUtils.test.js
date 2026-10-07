import { afterEach, describe, expect, it } from 'vitest';
import {
  createWishlistEntry,
  filterWishlist,
  formatDateKey,
  formatPrice,
  getDeadlineState,
  getWishlistSubtitle,
  getWishlistTitle,
  isDateKey,
  parsePrice,
  prepareLinks,
  prepareWishlistEntry,
  readPreferredCurrency,
  savePreferredCurrency,
  sortWishlist,
} from './wishlistUtils';

const photo = new Blob(['screenshot'], { type: 'image/png' });

function form(fields = {}) {
  return {
    photo: null,
    name: '',
    series: [],
    character: [],
    merchandise_type: '',
    links: [],
    price: '',
    currency: 'JPY',
    shop: '',
    order_deadline: '',
    release: '',
    priority: 'medium',
    status: 'want',
    notes: '',
    ...fields,
  };
}

describe('createWishlistEntry', () => {
  it('fills every field with an empty default and keeps overrides', () => {
    const entry = createWishlistEntry({ photo, currency: 'JPY' });

    expect(entry).toEqual(expect.objectContaining({
      photo,
      name: '',
      links: [],
      price: null,
      currency: 'JPY',
      order_deadline: null,
      priority: 'medium',
      status: 'want',
    }));
    expect(entry.created_at).toBeInstanceOf(Date);
  });
});

describe('prepareLinks', () => {
  it('drops empty rows, normalizes addresses and removes duplicates', () => {
    expect(prepareLinks([
      { url: '', label: '' },
      { url: 'amiami.com/item', label: ' AmiAmi ' },
      { url: 'https://amiami.com/item', label: 'Again' },
      { url: 'https://x.com/post/1', label: '' },
    ])).toEqual({
      links: [
        { url: 'https://amiami.com/item', label: 'AmiAmi' },
        { url: 'https://x.com/post/1', label: '' },
      ],
      invalidValue: null,
    });
  });

  it('reports the first row that cannot be opened', () => {
    expect(prepareLinks([{ url: 'javascript:alert(1)', label: '' }]).invalidValue)
      .toBe('javascript:alert(1)');
    expect(prepareLinks([{ url: '', label: 'Shop page' }]).invalidValue).toBe('Shop page');
  });
});

describe('parsePrice', () => {
  it('reads plain, grouped and full-width prices', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('  ')).toBeNull();
    expect(parsePrice('12800')).toBe(12800);
    expect(parsePrice('12,800')).toBe(12800);
    expect(parsePrice('１２８００')).toBe(12800);
    expect(parsePrice('１２，８００')).toBe(12800);
    expect(parsePrice('19.99')).toBe(19.99);
    expect(parsePrice('１９．９９')).toBe(19.99);
  });

  it('rejects negative, non-numeric and absurd prices', () => {
    expect(parsePrice('-1')).toBeNaN();
    expect(parsePrice('¥12800')).toBeNaN();
    expect(parsePrice('1e12')).toBeNaN();
  });
});

describe('prepareWishlistEntry', () => {
  it('requires a photo, a name, or a link', () => {
    expect(prepareWishlistEntry(form())).toEqual({ errorKey: 'wishlistRequireOne' });
    expect(prepareWishlistEntry(form({ photo })).entry).toBeDefined();
    expect(prepareWishlistEntry(form({ name: 'Asuka figure' })).entry).toBeDefined();
    expect(prepareWishlistEntry(form({ links: [{ url: 'x.com/post/1', label: '' }] })).entry)
      .toBeDefined();
  });

  it('names the link that is not a web address', () => {
    expect(prepareWishlistEntry(form({ photo, links: [{ url: 'not a link', label: '' }] })))
      .toEqual({ errorKey: 'wishlistInvalidLink', errorValues: { value: 'not a link' } });
  });

  it('rejects a price that cannot be stored', () => {
    expect(prepareWishlistEntry(form({ photo, price: '-5' })))
      .toEqual({ errorKey: 'wishlistInvalidPrice' });
  });

  it('trims text, normalizes values and falls back for unknown choices', () => {
    const { entry } = prepareWishlistEntry(form({
      name: '  Asuka figure  ',
      series: ['Evangelion', 'evangelion '],
      shop: ' AmiAmi ',
      price: '12,800',
      order_deadline: '2026-02-30',
      priority: 'urgent',
      status: 'unknown',
    }));

    expect(entry).toEqual(expect.objectContaining({
      name: 'Asuka figure',
      series: ['Evangelion'],
      shop: 'AmiAmi',
      price: 12800,
      currency: 'JPY',
      order_deadline: null,
      priority: 'medium',
      status: 'want',
    }));
    expect(entry).not.toHaveProperty('photo');
  });
});

describe('deadlines', () => {
  const today = new Date(2026, 9, 1, 23, 30);

  it('accepts only real calendar dates', () => {
    expect(isDateKey('2026-10-15')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-1-5')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('classifies deadlines by local calendar days', () => {
    expect(getDeadlineState('2026-09-30', today)).toBe('overdue');
    expect(getDeadlineState('2026-10-01', today)).toBe('soon');
    expect(getDeadlineState('2026-10-08', today)).toBe('soon');
    expect(getDeadlineState('2026-10-09', today)).toBe('upcoming');
    expect(getDeadlineState(null, today)).toBeNull();
  });

  it('shows the year only when it differs from the current one', () => {
    expect(formatDateKey('2026-10-15', 'en', today)).toBe('Oct 15');
    expect(formatDateKey('2027-03-01', 'en', today)).toBe('Mar 1, 2027');
    expect(formatDateKey('', 'en', today)).toBe('');
  });
});

describe('formatPrice', () => {
  it('formats with the currency and without needless decimals', () => {
    expect(formatPrice(12800, 'JPY', 'en')).toBe('¥12,800');
    expect(formatPrice(1200, 'TWD', 'en')).toBe('NT$1,200');
    expect(formatPrice(null, 'JPY', 'en')).toBe('');
  });

  it('falls back to plain text for a currency code Intl rejects', () => {
    expect(formatPrice(12, 'XX', 'en')).toBe('12 XX');
  });
});

describe('titles', () => {
  it('prefers the name, then characters, then series', () => {
    expect(getWishlistTitle({ name: 'Figure', character: ['Asuka'] }, ', ')).toBe('Figure');
    expect(getWishlistTitle({ name: '', character: ['Asuka', 'Rei'] }, ', ')).toBe('Asuka, Rei');
    expect(getWishlistTitle({ name: '', series: ['Evangelion'] }, ', ')).toBe('Evangelion');
    expect(getWishlistTitle({ name: '' }, ', ')).toBe('');
  });

  it('adds the series beneath a name or character title, but never repeats it', () => {
    expect(getWishlistSubtitle({ name: 'Figure', series: ['Evangelion'] }, ', ')).toBe('Evangelion');
    expect(getWishlistSubtitle({ name: 'Figure', character: ['Asuka'] }, ', ')).toBe('Asuka');
    expect(getWishlistSubtitle({ character: ['Asuka'], series: ['Evangelion'] }, ', ')).toBe('Evangelion');
    expect(getWishlistSubtitle({ series: ['Evangelion'] }, ', ')).toBe('');
  });
});

describe('sorting and filtering', () => {
  const entries = [
    {
      id: 1,
      name: 'Asuka figure',
      shop: 'AmiAmi',
      priority: 'low',
      status: 'want',
      order_deadline: '2026-11-01',
      links: [{ url: 'https://www.amiami.com/item', label: '' }],
      created_at: new Date('2026-09-01'),
    },
    {
      id: 2,
      name: 'Rei plush',
      merchandise_type: 'plush',
      priority: 'high',
      status: 'ordered',
      order_deadline: null,
      links: [{ url: 'https://x.com/post/1', label: 'Announcement' }],
      created_at: new Date('2026-09-03'),
    },
    {
      id: 3,
      name: 'Shinji badge',
      notes: 'Event exclusive',
      priority: 'high',
      status: 'want',
      order_deadline: '2026-10-10',
      links: [],
      created_at: new Date('2026-09-02'),
    },
  ];
  const ids = list => list.map(entry => entry.id);

  it('sorts by newest, deadline with undated last, and priority', () => {
    expect(ids(sortWishlist(entries, 'newest'))).toEqual([2, 3, 1]);
    expect(ids(sortWishlist(entries, 'deadline'))).toEqual([3, 1, 2]);
    expect(ids(sortWishlist(entries, 'priority'))).toEqual([2, 3, 1]);
  });

  it('searches names, shops, notes, link hosts, link labels and type labels', () => {
    const search = searchTerm => ids(filterWishlist({
      entries,
      searchTerm,
      getTypeLabel: type => (type === 'plush' ? 'Plush toy' : type),
    }));

    expect(search('amiami')).toEqual([1]);
    expect(search('EXCLUSIVE')).toEqual([3]);
    expect(search('x.com')).toEqual([2]);
    expect(search('announcement')).toEqual([2]);
    expect(search('plush toy')).toEqual([2]);
  });

  it('filters by status and priority', () => {
    expect(ids(filterWishlist({ entries, filterStatus: 'want' }))).toEqual([3, 1]);
    expect(ids(filterWishlist({ entries, filterPriority: 'high' }))).toEqual([2, 3]);
    expect(filterWishlist({ entries: undefined })).toEqual([]);
  });
});

describe('preferred currency', () => {
  afterEach(() => localStorage.clear());

  it('remembers a listed currency and ignores anything else', () => {
    expect(readPreferredCurrency()).toBe('TWD');
    savePreferredCurrency('JPY');
    expect(readPreferredCurrency()).toBe('JPY');

    localStorage.setItem('wishlistCurrency', 'DOGE');
    expect(readPreferredCurrency()).toBe('TWD');
  });
});
