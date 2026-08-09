import { describe, it, expect } from 'vitest';
import { decodeHTMLEntities } from '../src/plugins/news/crawler';

describe('decodeHTMLEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHTMLEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeHTMLEntities('a &lt; b &gt; c')).toBe('a < b > c');
    expect(decodeHTMLEntities('&quot;quoted&apos;&quot;')).toBe('"quoted\'"');
  });

  it('decodes numeric hex references', () => {
    expect(decodeHTMLEntities('&#x27;')).toBe("'");
    expect(decodeHTMLEntities('&#x1F600;')).toBe('😀');
  });

  it('decodes numeric decimal references', () => {
    expect(decodeHTMLEntities('&#233;')).toBe('é');
    expect(decodeHTMLEntities('&#169;')).toBe('©');
  });

  it('decodes punctuation-style named entities', () => {
    expect(decodeHTMLEntities('&nbsp;&ndash;&mdash;')).toBe('\u00A0\u2013\u2014');
    expect(decodeHTMLEntities('&lsquo;&rsquo;')).toBe('\u2018\u2019');
    expect(decodeHTMLEntities('&ldquo;&rdquo;&hellip;')).toBe('\u201C\u201D\u2026');
    expect(decodeHTMLEntities('&laquo;&raquo;')).toBe('\u00AB\u00BB');
    expect(decodeHTMLEntities('&bull;&middot;')).toBe('\u2022\u00B7');
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeHTMLEntities('&unknown;')).toBe('&unknown;');
    expect(decodeHTMLEntities('&ampx;')).toBe('&ampx;');
  });

  it('decodes mixed text with entities', () => {
    expect(decodeHTMLEntities('R&amp;D &amp; &#233;&#xE9;')).toBe('R&D & éé');
  });

  it('returns empty string for empty input', () => {
    expect(decodeHTMLEntities('')).toBe('');
  });
});