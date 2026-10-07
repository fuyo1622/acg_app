import { describe, expect, it } from 'vitest';
import { getLinkHost, getLinkLabel, isWebUrl, normalizeLinkUrl } from './linkUtils';
import { WISHLIST_LIMITS } from './constants';

describe('normalizeLinkUrl', () => {
  it('keeps full web addresses and adds https to bare ones', () => {
    expect(normalizeLinkUrl('https://www.amiami.com/eng/detail?gcode=FIGURE-1'))
      .toBe('https://www.amiami.com/eng/detail?gcode=FIGURE-1');
    expect(normalizeLinkUrl('  amiami.com/eng/detail  ')).toBe('https://amiami.com/eng/detail');
    expect(normalizeLinkUrl('HTTP://Example.COM')).toBe('http://example.com/');
  });

  it('takes the URL out of shared text', () => {
    expect(normalizeLinkUrl('預購開始！https://example.com/item/1。'))
      .toBe('https://example.com/item/1');
    expect(normalizeLinkUrl('Pre-order now: https://example.com/item/1.'))
      .toBe('https://example.com/item/1');
  });

  it('keeps an address whose parameter is another URL', () => {
    expect(normalizeLinkUrl('example.com/redirect?to=https://other.example/x'))
      .toBe('https://example.com/redirect?to=https://other.example/x');
  });

  it('rejects addresses that are not http or https web pages', () => {
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkUrl('javascript://example.com/%0aalert(1)')).toBeNull();
    expect(normalizeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeLinkUrl('ftp://example.com/file')).toBeNull();
    expect(normalizeLinkUrl('not a link')).toBeNull();
    expect(normalizeLinkUrl('localhost')).toBeNull();
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl(42)).toBeNull();
  });

  it('rejects credentials that disguise the real host', () => {
    expect(normalizeLinkUrl('https://shop.example@evil.example/')).toBeNull();
  });

  it('rejects addresses over the stored length limit', () => {
    const longPath = 'a'.repeat(WISHLIST_LIMITS.maxUrlLength);
    expect(normalizeLinkUrl(`https://example.com/${longPath}`)).toBeNull();
  });
});

describe('isWebUrl', () => {
  it('accepts only canonical-looking http and https URLs', () => {
    expect(isWebUrl('https://example.com/')).toBe(true);
    expect(isWebUrl('http://example.com/a?b=c')).toBe(true);
    expect(isWebUrl('example.com')).toBe(false);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl(null)).toBe(false);
  });
});

describe('link labels', () => {
  it('uses the label when present and the host without www otherwise', () => {
    expect(getLinkLabel({ url: 'https://www.amiami.com/x', label: ' AmiAmi ' })).toBe('AmiAmi');
    expect(getLinkLabel({ url: 'https://www.amiami.com/x', label: '' })).toBe('amiami.com');
    expect(getLinkHost('not a url')).toBe('');
  });
});
