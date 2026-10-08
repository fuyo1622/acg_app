import {
  BACKUP_LIMITS,
  DEFAULT_WISHLIST_CURRENCY,
  WISHLIST_CURRENCIES,
  WISHLIST_DEADLINE_SOON_DAYS,
  WISHLIST_LIMITS,
  WISHLIST_PRIORITIES,
  WISHLIST_STATUSES,
} from './constants';
import { getLinkHost, normalizeLinkUrl } from './linkUtils';
import { formatValues, normalizeKey, toValueArray } from './valueUtils';

const CURRENCY_STORAGE_KEY = 'wishlistCurrency';
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PRIORITY_RANK = Object.fromEntries(
  WISHLIST_PRIORITIES.map((priority, index) => [priority, index]),
);

export function createWishlistEntry(fields = {}) {
  const now = new Date();
  return {
    photo: null,
    name: '',
    series: [],
    character: [],
    merchandise_type: '',
    links: [],
    price: null,
    currency: DEFAULT_WISHLIST_CURRENCY,
    shop: '',
    order_deadline: null,
    release: '',
    priority: 'medium',
    status: 'want',
    notes: '',
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

let lastLinkRowKey = 0;

// Form rows need stable keys while they are edited; stored links do not carry them.
export function createLinkRow(link = {}) {
  lastLinkRowKey += 1;
  return { key: lastLinkRowKey, url: link.url ?? '', label: link.label ?? '' };
}

// Empty rows are dropped. A row with only a label is reported instead, because a label
// alone cannot be opened.
export function prepareLinks(rows = []) {
  const links = [];
  const seen = new Set();

  for (const row of rows) {
    const rawUrl = typeof row?.url === 'string' ? row.url.trim() : '';
    const label = typeof row?.label === 'string' ? row.label.trim() : '';
    if (!rawUrl && !label) continue;

    const url = normalizeLinkUrl(rawUrl);
    if (!url) return { links: [], invalidValue: rawUrl || label };
    if (seen.has(url)) continue;

    seen.add(url);
    links.push({ url, label });
  }

  return { links, invalidValue: null };
}

// Returns null for an empty field and NaN for anything that is not a usable price.
// Accepts the way prices are copied from shops or typed with a CJK keyboard: "12,800" or
// full-width "１２，８００".
export function parsePrice(value) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/[０-９．]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s]/g, '');
  if (!text) return null;

  const price = Number(text);
  return Number.isFinite(price) && price >= 0 && price <= WISHLIST_LIMITS.maxPrice
    ? price
    : Number.NaN;
}

// A wishlist entry is often a screenshot to fill in later, so nothing is required beyond
// something to recognize it by: a photo, a name, or a link.
export function prepareWishlistEntry(form) {
  const { links, invalidValue } = prepareLinks(form.links);
  if (invalidValue !== null) {
    return { errorKey: 'wishlistInvalidLink', errorValues: { value: invalidValue } };
  }

  const price = parsePrice(form.price);
  if (Number.isNaN(price)) return { errorKey: 'wishlistInvalidPrice' };

  const name = (form.name ?? '').trim();
  if (!form.photo && !name && links.length === 0) return { errorKey: 'wishlistRequireOne' };

  return {
    entry: {
      name,
      series: toValueArray(form.series),
      character: toValueArray(form.character),
      merchandise_type: (form.merchandise_type ?? '').trim(),
      links,
      price,
      currency: form.currency || DEFAULT_WISHLIST_CURRENCY,
      shop: (form.shop ?? '').trim(),
      order_deadline: isDateKey(form.order_deadline) ? form.order_deadline : null,
      release: (form.release ?? '').trim(),
      priority: WISHLIST_PRIORITIES.includes(form.priority) ? form.priority : 'medium',
      status: WISHLIST_STATUSES.includes(form.status) ? form.status : 'want',
      notes: form.notes ?? '',
    },
  };
}

export function isDateKey(value) {
  const match = typeof value === 'string' ? DATE_KEY_PATTERN.exec(value) : null;
  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function toLocalDateKey(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayNumber(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

// Deadlines are calendar dates, so they are compared in the device's local calendar
// rather than as instants. "soon" covers today and the next few days.
export function getDeadlineState(deadline, today = new Date()) {
  if (!isDateKey(deadline)) return null;

  const daysLeft = dayNumber(deadline) - dayNumber(toLocalDateKey(today));
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= WISHLIST_DEADLINE_SOON_DAYS) return 'soon';
  return 'upcoming';
}

export function formatDateKey(dateKey, locale, today = new Date()) {
  if (!isDateKey(dateKey)) return '';

  const [year, month, day] = dateKey.split('-').map(Number);
  const options = year === today.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(locale, options).format(new Date(year, month - 1, day));
}

export function formatPrice(price, currency, locale) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || DEFAULT_WISHLIST_CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${currency ?? ''}`.trim();
  }
}

export function getWishlistTitle(entry, separator) {
  return entry?.name?.trim()
    || formatValues(entry?.character, separator)
    || formatValues(entry?.series, separator);
}

// The collection has no name, price, or shop fields, so an entry moved there keeps them at
// the top of its notes, within the notes limit that backup import enforces. The price is
// saved with its currency code: a symbol such as "$" means NT$ in Chinese but US$ in
// English, and these notes stay as written whichever language is shown later.
export function notesForCollection(entry, locale) {
  const price = typeof entry?.price === 'number' && Number.isFinite(entry.price)
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(entry.price)} ${entry.currency || DEFAULT_WISHLIST_CURRENCY}`
    : '';
  const purchase = [price, entry?.shop?.trim()].filter(Boolean).join(' · ');
  return [entry?.name?.trim(), purchase, entry?.notes?.trim()]
    .filter(Boolean)
    .join('\n')
    .slice(0, BACKUP_LIMITS.maxNotesLength);
}

// The line under the title: the series when the title already names the item or the
// character, and nothing when the title itself is the series.
export function getWishlistSubtitle(entry, separator) {
  const series = formatValues(entry?.series, separator);
  const character = formatValues(entry?.character, separator);
  if (entry?.name?.trim()) return series || character;
  return character ? series : '';
}

function timeOf(value) {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

const byNewest = (left, right) => timeOf(right.created_at) - timeOf(left.created_at);

// Entries without a deadline sort after every dated one. Date keys compare as strings.
function byDeadline(left, right) {
  const leftDeadline = isDateKey(left.order_deadline) ? left.order_deadline : null;
  const rightDeadline = isDateKey(right.order_deadline) ? right.order_deadline : null;

  if (leftDeadline !== rightDeadline) {
    if (!leftDeadline) return 1;
    if (!rightDeadline) return -1;
    return leftDeadline < rightDeadline ? -1 : 1;
  }
  return byNewest(left, right);
}

function priorityRank(entry) {
  return PRIORITY_RANK[entry.priority] ?? PRIORITY_RANK.medium;
}

const byPriority = (left, right) => priorityRank(left) - priorityRank(right) || byNewest(left, right);

const COMPARATORS = { newest: byNewest, deadline: byDeadline, priority: byPriority };

export function sortWishlist(entries, sortOrder = 'newest') {
  return [...entries].sort(COMPARATORS[sortOrder] ?? byNewest);
}

export function filterWishlist({
  entries,
  searchTerm,
  filterStatus = 'all',
  filterPriority = 'all',
  sortOrder = 'newest',
  getTypeLabel = type => type,
}) {
  if (!entries) return [];

  const searchLower = normalizeKey(searchTerm);
  const matches = entries.filter(entry => {
    if (filterStatus !== 'all' && (entry.status ?? 'want') !== filterStatus) return false;
    if (filterPriority !== 'all' && (entry.priority ?? 'medium') !== filterPriority) return false;
    if (!searchLower) return true;

    const type = entry.merchandise_type || '';
    const searchableValues = [
      entry.name,
      ...toValueArray(entry.series),
      ...toValueArray(entry.character),
      type,
      type ? getTypeLabel(type) : '',
      entry.shop,
      entry.release,
      entry.notes,
      ...(entry.links ?? []).flatMap(link => [link.label, getLinkHost(link.url)]),
    ];
    return searchableValues.some(value => normalizeKey(value).includes(searchLower));
  });

  return sortWishlist(matches, sortOrder);
}

export function readPreferredCurrency() {
  try {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return WISHLIST_CURRENCIES.includes(stored) ? stored : DEFAULT_WISHLIST_CURRENCY;
  } catch {
    return DEFAULT_WISHLIST_CURRENCY;
  }
}

export function savePreferredCurrency(currency) {
  if (!WISHLIST_CURRENCIES.includes(currency)) return;
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Remembering the currency is a convenience; the entry itself is already saved.
  }
}
