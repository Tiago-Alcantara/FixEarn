import { dict } from './i18n';

describe('i18n', () => {
  it('has matching keys in en and pt', () => {
    expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.pt).sort());
  });

  it('translates a known key', () => {
    expect(dict.pt.getStarted).toBe('Começar');
    expect(dict.en.getStarted).toBe('Get started');
  });
});
