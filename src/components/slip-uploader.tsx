"use client";

import { useActionState } from "react";
import { ImageUp, Loader2, UploadCloud } from "lucide-react";
import { uploadSlipAction, type SlipState } from "@/actions/wallet";
import { Button, Alert } from "@/components/ui";

export function SlipUploader({ reference, disabled }: { reference: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<SlipState, FormData>(uploadSlipAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/50 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-surface-2">
        <UploadCloud className="size-5 text-primary" />
        <span className="text-xs font-semibold text-fg">Attach payment slip</span>
        <span className="text-[10px] text-muted">JPG, PNG or WebP · max 5 MB</span>
        <input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required className="sr-only" />
      </label>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending || disabled} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
        {pending ? "Uploading…" : "Submit slip for review"}
      </Button>
    </form>
  );
}
