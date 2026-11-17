import { Input } from '@app/ui';
import { Search } from 'lucide-react';
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
    <div className="relative w-full sm:w-64">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Search alerts"
        placeholder="Search alerts…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
