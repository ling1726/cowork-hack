export type Theme = 'light' | 'dark';

/** Puts the theme on the root element: Tailwind's `dark` class and a `data-theme` attribute. */
export function applyTheme(
  theme: Theme,
  root: Pick<HTMLElement, 'classList' | 'setAttribute'>,
): void {
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
}
