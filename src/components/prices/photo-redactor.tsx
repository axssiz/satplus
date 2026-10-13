"use client";

import { Eraser, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/validation";

const MAX_SIDE = 1600;

/**
 * Loads a photo into a canvas, lets the user paint over personal data, and exports
 * a re-encoded JPEG. Re-encoding through canvas drops all EXIF metadata (incl. GPS).
 */
export function PhotoRedactor({
  onChange,
  onError,
  onBusy,
  namespace = "addPrice",
}: {
  onChange: (file: { blob: Blob; redacted: boolean } | null) => void;
  onError: (message: string) => void;
  /** True while a photo is being decoded or re-encoded; forms keep submit disabled until it is ready. */
  onBusy?: (busy: boolean) => void;
  /** Message namespace providing photo, photoHint, redact* and errors.photo* texts. */
  namespace?: "addPrice" | "newsSuggest" | "promotionReport" | "businessSuggest" | "serviceForm";
}) {
  const t = useTranslations(namespace);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const original = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [redacted, setRedacted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const exportBlob = useCallback(
    (isRedacted: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      onBusy?.(true);
      canvas.toBlob(
        (blob) => {
          onBusy?.(false);
          if (!blob) return;
          if (blob.size > MAX_PHOTO_BYTES) onError(t("errors.photoTooLarge"));
          else onChange({ blob, redacted: isRedacted });
        },
        "image/jpeg",
        0.85,
      );
    },
    [onBusy, onChange, onError, t],
  );

  const drawOriginal = useCallback(() => {
    const img = original.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => () => {
    if (original.current?.src.startsWith("blob:")) URL.revokeObjectURL(original.current.src);
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return onError(t("errors.photoType"));
    if (file.size > 20 * 1024 * 1024) return onError(t("errors.photoTooLarge"));
    const img = new Image();
    onBusy?.(true);
    img.onload = () => {
      original.current = img;
      setLoaded(true);
      setRedacted(false);
      requestAnimationFrame(() => {
        drawOriginal();
        exportBlob(false);
      });
    };
    img.onerror = () => {
      onBusy?.(false);
      onError(t("errors.photoType"));
    };
    img.src = URL.createObjectURL(file);
  };

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext("2d")!;
    const r = Math.max(14, canvas.width / 30);
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <div className="space-y-3">
      {!loaded ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-6 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary-soft/30"
        >
          <ImagePlus className="size-6 text-primary" aria-hidden />
          <span className="font-medium text-foreground">{t("photo")}</span>
          <span className="text-xs">{t("photoHint")}</span>
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("redactTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("redactHint")}</p>
          <canvas
            ref={canvasRef}
            className="max-h-[60vh] w-full touch-none rounded-xl border border-border bg-surface object-contain"
            onPointerDown={(e) => {
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              paint(e);
            }}
            onPointerMove={(e) => drawing.current && paint(e)}
            onPointerUp={() => {
              if (!drawing.current) return;
              drawing.current = false;
              setRedacted(true);
              exportBlob(true);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                drawOriginal();
                setRedacted(false);
                exportBlob(false);
              }}
              disabled={!redacted}
            >
              <Eraser aria-hidden /> {t("redactClear")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoaded(false);
                original.current = null;
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <Trash2 aria-hidden /> {t("removePhoto")}
            </Button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
