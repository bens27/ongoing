import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './safe-path';

describe('safeReturnTo', () => {
  it('keeps an in-app path', () => {
    expect(safeReturnTo('/p/alpha?q=kind%3Aproject')).toBe('/p/alpha?q=kind%3Aproject');
  });

  it('refuses a protocol-relative path to another host', () => {
    expect(safeReturnTo('//evil.example/steal')).toBe('/');
  });

  it('refuses an absolute URL, an empty value, and no value', () => {
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo('')).toBe('/');
    expect(safeReturnTo(null)).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
  });
});
