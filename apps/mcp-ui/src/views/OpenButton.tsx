import { Button } from '@app/ui';
import { ExternalLink } from 'lucide-react';

/** "Open in app" / "Review in app": links leave the iframe through the host. */
export function OpenButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onOpen}>
      {label}
      <ExternalLink aria-hidden />
    </Button>
  );
}

/** A real link (so it reads as one) that opens through the host instead of navigating. */
export function HostLink({
  href,
  label,
  onOpen,
}: {
  href: string;
  label: string;
  onOpen: () => void;
}) {
  return (
    <a
      href={href}
      className="hover:underline"
      onClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
    >
      {label}
    </a>
  );
}
