import { DECISION_SURFACE_LABELS, type DecisionSurface } from '@app/domain';
import { Sparkles } from 'lucide-react';
import { Badge } from '../primitives/badge.tsx';

/**
 * Marks an entry that Claude produced. `approvedByName` is shown once a human approved it, and
 * `decidedIn: 'cowork'` says the approval happened on a card in Cowork.
 */
export function ViaClaudeTag({
  approvedByName,
  decidedIn,
}: {
  approvedByName?: string;
  decidedIn?: DecisionSurface;
}) {
  const where = decidedIn === 'cowork' ? ` ${DECISION_SURFACE_LABELS.cowork}` : '';
  return (
    <Badge
      data-testid="via-claude"
      variant="outline"
      className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
    >
      <Sparkles aria-hidden />
      {approvedByName ? `via Claude · approved by ${approvedByName}${where}` : 'via Claude'}
    </Badge>
  );
}
