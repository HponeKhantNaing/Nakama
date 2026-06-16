'use client';

import { useState, useTransition } from 'react';
import { saveProofOfDelivery } from '@/app/actions/tms';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

async function uploadFileToS3(requestId: string, file: File, type: 'proof' | 'delivery') {
  const presign = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      filename: file.name,
      contentType: file.type,
      type,
    }),
  }).then((r) => r.json());

  if (!presign.uploadUrl || !presign.publicUrl) throw new Error(presign.error ?? 'Upload failed');

  await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  return presign.publicUrl as string;
}

export function ProofOfDeliveryModal({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);

  function onSave() {
    setError(null);
    startTransition(async () => {
      try {
        const photoUrl = photo ? await uploadFileToS3(requestId, photo, 'delivery') : undefined;
        const signatureUrl = signature
          ? await uploadFileToS3(requestId, signature, 'proof')
          : undefined;

        const result = await saveProofOfDelivery(requestId, { photoUrl, signatureUrl, notes });
        if (!result.success) {
          setError(result.error ?? 'Failed to save');
          return;
        }
        onOpenChange(false);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to save');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle>Proof of Delivery</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Delivery Photo</Label>
            <Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>

          <div className="space-y-2">
            <Label>Customer Signature</Label>
            <Input type="file" accept="image/*" onChange={(e) => setSignature(e.target.files?.[0] ?? null)} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={onSave}>
              {isPending ? 'Saving...' : 'Save POD'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

