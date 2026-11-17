import { Field } from '@fluentui/react-components';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

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
      <Field
        label="File"
        required
        hint="Up to 5 MB"
        validationState={tooLarge ? 'error' : 'none'}
        validationMessage={tooLarge ? 'This file is larger than 5 MB' : undefined}
      >
        <input
          type="file"
          aria-label="File"
          onChange={(e) => setFile(e.target.files?.[0] ?? undefined)}
        />
      </Field>
    </ActionDialog>
  );
}
