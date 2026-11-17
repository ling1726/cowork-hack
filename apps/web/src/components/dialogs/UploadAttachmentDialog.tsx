import { Input } from '@app/ui';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';
import { FormField } from './FormField.tsx';

const MAX_BYTES = 5 * 1024 * 1024;

export function UploadAttachmentDialog({
  alertId,
  onClose,
}: {
  alertId: string;
  onClose: () => void;
}) {
  const { uploadAttachment } = useAlertMutations(alertId);
  const [file, setFile] = useState<File>();
  const tooLarge = file !== undefined && file.size > MAX_BYTES;
  return (
    <ActionDialog
      title="Upload attachment"
      submitLabel="Upload"
      canSubmit={Boolean(file) && !tooLarge}
      onSubmit={() => uploadAttachment.mutateAsync(file as File)}
      onClose={onClose}
    >
      <FormField
        label="File"
        hint="Up to 5 MB"
        error={tooLarge ? 'This file is larger than 5 MB' : undefined}
      >
        {(id) => (
          <Input
            id={id}
            type="file"
            aria-label="File"
            aria-invalid={tooLarge || undefined}
            onChange={(e) => setFile(e.target.files?.[0] ?? undefined)}
          />
        )}
      </FormField>
    </ActionDialog>
  );
}
