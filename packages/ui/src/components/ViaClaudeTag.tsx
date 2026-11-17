import { Sparkles } from 'lucide-react';
import { Badge } from '../primitives/badge.tsx';

/** Marks an entry that Claude produced. `approvedByName` is shown once a human approved it. */
export function ViaClaudeTag({ approvedByName }: { approvedByName?: string }) {
  return (
    <Badge
      data-testid="via-claude"
      variant="outline"
      className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
    >
      <Sparkles aria-hidden />
      {approvedByName ? `via Claude · approved by ${approvedByName}` : 'via Claude'}
    </Badge>
  );
}
