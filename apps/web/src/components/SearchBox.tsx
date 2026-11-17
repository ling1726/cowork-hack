import { SearchBox as FluentSearchBox } from '@fluentui/react-components';
import { useEffect, useState } from 'react';

export interface SearchBoxProps {
  /** The committed value (from the URL). */
  value: string;
  onCommit: (text: string) => void;
  delayMs?: number;
}

/** Local text state, committed to the URL after a pause so each keystroke isn't a navigation. */
export function SearchBox({ value, onCommit, delayMs = 300 }: SearchBoxProps) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);

  // Follow external changes (back button, Clear filters, deep links). The URL holds the trimmed
  // text, so an echo of what the user just typed must not overwrite it.
  if (value !== seen) {
    setSeen(value);
    if (value !== text.trim()) setText(value);
  }

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onCommit(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, value, delayMs, onCommit]);

  return (
    <FluentSearchBox
      aria-label="Search alerts"
      placeholder="Search alerts"
      value={text}
      onChange={(_e, d) => setText(d.value)}
      style={{ minWidth: 280 }}
    />
  );
}
