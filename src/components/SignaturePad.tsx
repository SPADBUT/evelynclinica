import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  className?: string
}

export function SignaturePad({ onChange, className = '' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#2a2224'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      setHasInk(false)
      onChange(null)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [onChange])

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const emit = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-xl border border-border bg-white"
        onPointerDown={(e) => {
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')
          if (!canvas || !ctx) return
          canvas.setPointerCapture(e.pointerId)
          drawing.current = true
          const p = pointFromEvent(e)
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = canvasRef.current?.getContext('2d')
          if (!ctx) return
          const p = pointFromEvent(e)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
          if (!hasInk) setHasInk(true)
        }}
        onPointerUp={() => {
          drawing.current = false
          if (hasInk) emit()
          else {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext('2d')
            if (canvas && ctx) {
              // check if anything was drawn in this stroke
              emit()
              setHasInk(true)
            }
          }
        }}
        onPointerLeave={() => {
          if (drawing.current) {
            drawing.current = false
            emit()
            setHasInk(true)
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Assine com o dedo ou mouse dentro da área.</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext('2d')
            if (!canvas || !ctx) return
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
            setHasInk(false)
            onChange(null)
          }}
        >
          Limpar
        </Button>
      </div>
    </div>
  )
}
