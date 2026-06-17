import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { ChevronLeft, Camera } from 'lucide-react'

// Camera barcode scanner. iOS notes (researched): home-screen PWAs can use
// getUserMedia, but the camera permission isn't persisted and scanning must be a
// user gesture — so this opens from an explicit "Scan" button, handles denial
// gracefully, and always offers manual barcode entry as a fallback.
export function BarcodeScanner({
  onDetected,
  onBack,
}: {
  onDetected: (code: string) => void
  onBack: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | undefined
    let done = false

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result) => {
        if (result && !done) {
          done = true
          controls?.stop()
          onDetected(result.getText())
        }
      })
      .then((c) => {
        controls = c
      })
      .catch((e: unknown) => {
        const name = e instanceof Error ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission denied. Enter the barcode number below instead.'
            : 'Camera unavailable. Enter the barcode number below instead.',
        )
      })

    return () => {
      done = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft size={16} /> Back
      </button>

      {error ? (
        <p className="rounded-lg border border-[var(--color-warn)] bg-[var(--color-warn)]/10 px-3 py-2 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--color-brand)]/80" />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">
            <Camera size={12} className="mr-1 inline" /> Point at a barcode
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const code = manual.trim()
          if (code) onDetected(code)
        }}
        className="flex gap-2"
      >
        <input
          inputMode="numeric"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type the barcode number"
          aria-label="Barcode number"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <button type="submit" className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-black">
          Look up
        </button>
      </form>
    </div>
  )
}
