"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// BarcodeDetector is only available in Chrome/Edge/Android Chrome.
// Safari (including all iOS browsers) does NOT support it — we fall back to jsQR.
type BarcodeResult = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<BarcodeResult[]> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorInstance;
type BarcodeWindow = Window & typeof globalThis & { BarcodeDetector?: BarcodeDetectorCtor };

type CameraStatus = "idle" | "starting" | "scanning" | "unsupported" | "error";

function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && !!(window as BarcodeWindow).BarcodeDetector;
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "Camera permission denied. Allow camera access in your browser settings, then try again.";
    if (error.name === "NotFoundError")
      return "No camera found on this device.";
    if (error.name === "NotReadableError")
      return "Camera is already in use by another app.";
    if (error.name === "OverconstrainedError")
      return "Could not access the rear camera. Trying front camera…";
  }
  return "Camera unavailable. Use the fallback code below.";
}

export default function CameraScanner({
  disabled,
  onDetected,
  onManualEntry,
}: {
  disabled: boolean;
  onDetected: (value: string) => void;
  /** Rendered as a "Enter code manually" link in the mobile/tablet full-screen overlay. */
  onManualEntry?: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const detectedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Hidden canvas for jsQR frame capture on browsers without BarcodeDetector
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  function stopCamera() {
    if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => stopCamera, []);

  async function startCamera() {
    if (disabled || status === "starting" || status === "scanning") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setMessage("Camera access is not available. Make sure you're on HTTPS and using a supported browser.");
      return;
    }

    setStatus("starting");
    setMessage(null);
    detectedRef.current = false;

    try {
      // Try rear camera first, fall back to any available camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        // OverconstrainedError on some devices — retry without facing mode constraint
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      const video = videoRef.current;
      if (!video) { stopCamera(); return; }

      streamRef.current = stream;
      video.srcObject = stream;

      // iOS Safari requires the video to be muted+playsInline (set in JSX) and
      // play() must be called after srcObject is set. We wait for loadedmetadata
      // before playing to avoid AbortError on iOS. Guard against the metadata
      // having already loaded (fast cameras / cached permission), in which case
      // the event would never fire again, and add a timeout so a missed event
      // can never wedge the camera in "starting".
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
          return;
        }
        const done = () => {
          video.onloadedmetadata = null;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(done, 3000);
        video.onloadedmetadata = done;
      });
      await video.play();

      setStatus("scanning");
      setMessage(null);

      if (hasBarcodeDetector()) {
        // Fast path: native BarcodeDetector (Chrome, Edge, Android)
        const BarcodeDetectorCtor = (window as BarcodeWindow).BarcodeDetector!;
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });

        const scanFrame = async () => {
          if (!videoRef.current || detectedRef.current) return;
          if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              const results = await detector.detect(videoRef.current);
              const value = results[0]?.rawValue?.trim();
              if (value) {
                detectedRef.current = true;
                stopCamera();
                setStatus("idle");
                onDetected(value);
                return;
              }
            } catch {
              setStatus("error");
              setMessage("Camera scanning stopped. Use the fallback code below.");
              stopCamera();
              return;
            }
          }
          frameRef.current = requestAnimationFrame(scanFrame);
        };
        frameRef.current = requestAnimationFrame(scanFrame);
      } else {
        // Fallback path: jsQR + canvas (Safari, Firefox, iOS all browsers)
        const canvas = canvasRef.current ?? document.createElement("canvas");

        const scanFrame = () => {
          const vid = videoRef.current;
          if (!vid || detectedRef.current) return;

          if (vid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && vid.videoWidth > 0) {
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: "dontInvert",
                });
                if (code?.data?.trim()) {
                  detectedRef.current = true;
                  stopCamera();
                  setStatus("idle");
                  onDetected(code.data.trim());
                  return;
                }
              } catch {
                // Frame decode error — skip this frame and continue
              }
            }
          }
          frameRef.current = requestAnimationFrame(scanFrame);
        };
        frameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      setStatus("error");
      setMessage(cameraErrorMessage(error));
      stopCamera();
    }
  }

  // Auto-start camera on mount (skip the "Start camera scan" button)
  useEffect(() => {
    if (!disabled) {
      void startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = status === "scanning" || status === "starting";

  const cornerBrackets = (size: string, color: string) =>
    [
      "top-0 left-0 border-t-2 border-l-2 rounded-tl",
      "top-0 right-0 border-t-2 border-r-2 rounded-tr",
      "bottom-0 left-0 border-b-2 border-l-2 rounded-bl",
      "bottom-0 right-0 border-b-2 border-r-2 rounded-br",
    ].map((cls) => (
      <span key={cls} className={`absolute ${size} ${color} ${cls}`} />
    ));

  return (
    <>
      {/* Hidden canvas used by jsQR fallback */}
      <canvas ref={canvasRef} className="hidden" />

      {/*
        One camera subtree, restyled per breakpoint via CSS rather than
        duplicated into a mobile overlay + a desktop box. A <video> element
        can only ever be mounted in one place — an earlier version rendered
        two separate <video> JSX nodes (one per layout) and, because both
        wrapper divs are simultaneously in the DOM (only one hidden via CSS,
        Tailwind's `hidden`/`lg:block` never unmounts the other), React could
        only actually attach the live stream to one of them. Left the camera
        dark on whichever breakpoint lost that race.
      */}
      <div className="fixed inset-0 z-40 bg-zinc-900 lg:static lg:z-auto lg:overflow-hidden lg:rounded-xl lg:border lg:border-line lg:bg-white">
        <div className="relative h-full w-full lg:aspect-video lg:h-auto">
          <video
            aria-label="QR camera preview"
            className="h-full w-full object-cover"
            muted
            playsInline
            ref={videoRef}
          />

          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 px-6">
              <div className="relative h-32 w-32">
                {cornerBrackets("h-6 w-6", "border-white/30")}
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-widest text-white/20 uppercase">
                  QR
                </span>
              </div>
              {message ? (
                <p className="text-center text-xs leading-5 text-white/50">{message}</p>
              ) : (
                <p className="text-xs text-white/25">Camera inactive</p>
              )}
              <button
                className="mt-1 rounded-lg border border-white/20 px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 lg:hidden"
                disabled={disabled}
                onClick={startCamera}
                type="button"
              >
                Retry camera
              </button>
            </div>
          )}

          {status === "scanning" && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-6 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
                <span className="rounded-full bg-black/40 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
                  Scan the QR code
                </span>
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-48 w-48">
                  {cornerBrackets("h-8 w-8", "border-white")}
                </div>
              </div>
            </>
          )}

          {/* Mobile/tablet exit + fallback actions */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden">
            <a
              aria-label="Exit scanner"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
              href="/venuedashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <div className="flex items-center gap-4 text-xs font-medium">
              <a className="text-white/70 underline-offset-2 hover:text-white hover:underline" href="/smsbackup">
                SMS backup
              </a>
              {onManualEntry && (
                <>
                  <span className="text-white/30">·</span>
                  <button
                    className="text-white/70 underline-offset-2 hover:text-white hover:underline"
                    onClick={onManualEntry}
                    type="button"
                  >
                    Enter code manually
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop-only controls row below the camera box */}
        <div className="hidden items-center gap-3 px-4 py-3 lg:flex">
          {isActive ? (
            <>
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                Scanning…
              </span>
              <button
                className="ml-auto rounded-lg border border-line px-4 py-1.5 text-xs font-medium text-muted transition hover:border-foreground/20 hover:text-foreground"
                onClick={() => { stopCamera(); setStatus("idle"); setMessage(null); }}
                type="button"
              >
                Stop
              </button>
            </>
          ) : (
            <button
              className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-50 disabled:opacity-40"
              disabled={disabled}
              onClick={startCamera}
              type="button"
            >
              Start camera scan
            </button>
          )}
        </div>
      </div>
    </>
  );
}

