import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'

// BarcodeDetector todavía no está en los tipos de TypeScript
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

/** Lectura de códigos de barras con la cámara del teléfono (M1 / M2) */
export default function Scanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    let stream: MediaStream | undefined
    let raf = 0
    let stopped = false

    const start = async () => {
      if (!window.BarcodeDetector) {
        setError('Este navegador no permite leer códigos con la cámara. Probá con Chrome en Android, o usá un lector USB (escribe el código en el buscador).')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped || !video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const detector = new window.BarcodeDetector({ formats: FORMATS })
        const tick = async () => {
          if (stopped || !video.current) return
          try {
            const codes = await detector.detect(video.current)
            if (codes[0]?.rawValue) {
              onCode(codes[0].rawValue)
              return
            }
          } catch {
            // sigue intentando en el próximo cuadro
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setError('No se pudo acceder a la cámara. Revisá los permisos del navegador.')
      }
    }
    start()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, onCode])

  return (
    <Modal open={open} onClose={onClose} title="Escanear con la cámara">
      {error ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/80" />
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Apuntá al código de barras del producto. Se agrega solo al leerlo.</p>
    </Modal>
  )
}
