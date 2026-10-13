"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

const noopSubscribe = () => () => {};

/** Uses the native BarcodeDetector API (Chrome on Android, etc.). No extra libraries. */
export function BarcodeScanner({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const t = useTranslations("prices");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanError, setError] = useState<string | null>(null);
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => !!(globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector && !!navigator.mediaDevices?.getUserMedia,
    () => true,
  );
  const error = supported ? scanError : t("scanUnsupported");
  const handleOpenChange = (v: boolean) => {
    if (!v) setError(null);
    onOpenChange(v);
  };

  useEffect(() => {
    if (!open) return;
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            const code = codes.find((c) => /^[0-9]{8,14}$/.test(c.rawValue));
            if (code) {
              onDetected(code.rawValue);
              return;
            }
          } catch {
            // Frame not ready yet.
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError(t("scanError"));
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [open, onDetected, t]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent side="bottom">
        <DialogHeader>
          <DialogTitle>{t("scanBarcode")}</DialogTitle>
          <DialogDescription>{error ?? t("scanTitle")}</DialogDescription>
        </DialogHeader>
        {!error && (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-deal shadow-[0_0_12px_var(--deal)]" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
