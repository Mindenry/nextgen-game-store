"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, ImageUp, Loader2, UploadCloud, X } from "lucide-react";
import { uploadSlipAction, type SlipState } from "@/actions/wallet";
import { Alert, Button } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Slip picker with a visible preview, so the customer can see that the file was
 * actually selected before submitting. Reports its own validation instead of
 * relying on the hidden input's native (invisible) tooltip.
 */
export function SlipUploader({
  reference,
  disabled,
  locale = "th",
}: {
  reference: string;
  disabled?: boolean;
  locale?: "th" | "en";
}) {
  const [state, action, pending] = useActionState<SlipState, FormData>(uploadSlipAction, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ name: string; size: number; preview: string } | null>(null);
  const th = locale === "th";

  // Release the object URL when the preview is replaced or the form unmounts.
  useEffect(() => {
    if (!picked) return;
    const url = picked.preview;
    return () => URL.revokeObjectURL(url);
  }, [picked]);

  useEffect(() => {
    if (state.success) {
      setPicked(null);
      setLocalError(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state.success]);

  function clear() {
    setPicked(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setLocalError(null);
    if (!file) {
      setPicked(null);
      return;
    }
    const isHeic = /\.hei[cf]$/i.test(file.name) || ["image/heic", "image/heif"].includes(file.type);
    if (isHeic) {
      event.target.value = "";
      setPicked(null);
      setLocalError(
        th
          ? "ไฟล์ HEIC จาก iPhone ยังอ่านไม่ได้ — ไปที่ ตั้งค่า > กล้อง > รูปแบบ เป็น \"Most Compatible\" หรือแคปหน้าจอ/แปลงเป็น JPG ก่อนแนบ"
          : "HEIC images from iPhone are not supported yet. Set Camera → Formats to \"Most Compatible\", take a screenshot, or convert the file to JPG first.",
      );
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      event.target.value = "";
      setPicked(null);
      setLocalError(th ? "รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP" : "Only JPG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      event.target.value = "";
      setPicked(null);
      setLocalError(
        th
          ? `ไฟล์ใหญ่ ${formatSize(file.size)} เกินขีดจำกัด 5 MB`
          : `That file is ${formatSize(file.size)}; the limit is 5 MB.`,
      );
      return;
    }
    setPicked({ name: file.name, size: file.size, preview: URL.createObjectURL(file) });
  }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!picked) {
          event.preventDefault();
          setLocalError(th ? "เลือกรูปสลิปก่อนกดส่ง" : "Choose a slip image first.");
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="reference" value={reference} />
      <input
        ref={inputRef}
        id="slip-file-input"
        type="file"
        name="slip"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />

      {picked ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <img
            src={picked.preview}
            alt={picked.name}
            className="size-14 rounded-lg border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-xs font-semibold text-fg">
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
              <span className="truncate">{picked.name}</span>
            </p>
            <p className="mt-0.5 text-[10px] text-muted">
              {formatSize(picked.size)} · {th ? "พร้อมแนบ" : "ready to attach"}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              {th ? "เปลี่ยนรูป" : "Change image"}
            </button>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label={th ? "ลบรูปที่เลือก" : "Remove selected image"}
            className="rounded-lg border border-border p-1.5 text-muted transition hover:border-danger/40 hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor="slip-file-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/50 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-surface-2"
        >
          <UploadCloud className="size-5 text-primary" />
          <span className="text-xs font-semibold text-fg">
            {th ? "แนบสลิปการโอนเงิน" : "Attach payment slip"}
          </span>
          <span className="text-[10px] text-muted">
            {th ? "แตะเพื่อเลือกรูป · JPG, PNG, WebP · ไม่เกิน 5 MB" : "Tap to choose · JPG, PNG or WebP · max 5 MB"}
          </span>
        </label>
      )}

      {localError ? <Alert variant="danger">{localError}</Alert> : null}
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <Button type="submit" variant="secondary" disabled={pending || disabled} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
        {pending
          ? th
            ? "กำลังอัปโหลด…"
            : "Uploading…"
          : th
            ? "ส่งสลิปเพื่อตรวจสอบ"
            : "Submit slip for review"}
      </Button>
    </form>
  );
}
