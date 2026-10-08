import { WISHLIST_LIMITS } from './constants';

const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const EMBEDDED_URL_PATTERN = /https?:\/\/[^\s<>"'，。、；：！？「」『』（）【】]+/i;
const URL_CHARACTER_PATTERN = /[\w\-.~/?#[\]@!$&'()*+,;=%]/;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/;
const HAS_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

// Wishlist links are the only user-supplied addresses the app renders as anchors. Only
// http(s) URLs qualify: a stored javascript: or data: URL would run inside the app when
// tapped. Credentials are refused because "https://shop.example@evil.example" reads as
// one site and opens another.
export function isWebUrl(value) {
  if (typeof value !== 'string' || value.length > WISHLIST_LIMITS.maxUrlLength) return false;

  try {
    const url = new URL(value);
    return WEB_PROTOCOLS.has(url.protocol)
      && url.hostname.includes('.')
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

// Accepts what people paste: a full URL, an address without a scheme ("amiami.com/x"),
// or share text that contains a URL ("預購開始！https://..."). Returns the canonical URL,
// or null when the value is not a web address.
export function normalizeLinkUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Take the first http(s) URL out of share text, unless that URL is only a parameter of
  // the address itself, as in "shop.example/redirect?to=https://...".
  const match = EMBEDDED_URL_PATTERN.exec(trimmed);
  const isParameter = Boolean(match)
    && match.index > 0
    && URL_CHARACTER_PATTERN.test(trimmed[match.index - 1]);
  const candidate = match && !isParameter
    ? match[0].replace(TRAILING_PUNCTUATION_PATTERN, '')
    : trimmed;
  const withScheme = HAS_SCHEME_PATTERN.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const { href } = new URL(withScheme);
    return isWebUrl(href) ? href : null;
  } catch {
    return null;
  }
}

export function getLinkHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getLinkLabel(link) {
  return link?.label?.trim() || getLinkHost(link?.url);
}
