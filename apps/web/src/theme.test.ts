import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme.ts';

function fakeRoot() {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  return {
    classes,
    attrs,
    root: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          const on = force ?? !classes.has(name);
          if (on) classes.add(name);
          else classes.delete(name);
          return on;
        },
      } as unknown as DOMTokenList,
      setAttribute: (name: string, value: string) => void attrs.set(name, value),
    },
  };
}

describe('applyTheme', () => {
  it('sets the dark class and data-theme, and clears them for light', () => {
    const { root, classes, attrs } = fakeRoot();
    applyTheme('dark', root);
    expect(classes.has('dark')).toBe(true);
    expect(attrs.get('data-theme')).toBe('dark');
    applyTheme('light', root);
    expect(classes.has('dark')).toBe(false);
    expect(attrs.get('data-theme')).toBe('light');
  });
});
