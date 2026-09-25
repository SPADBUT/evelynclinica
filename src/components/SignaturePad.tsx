import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  className?: string
  /** Nome para gerar assinatura tipográfica acessível */
  typedName?: string
}

export function SignaturePad({ onChange, className = '', typedName = '' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const onChangeRef = useRef(onChange)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 160
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#2a2224'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 160
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    setHasInk(false)
    onChangeRef.current(null)
  }

  const applyTypedSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const name = typedName.trim()
    if (!canvas || !ctx || !name) return
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 160
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#2a2224'
    ctx.font = "32px 'Cormorant Garamond', Georgia, serif"
    ctx.textBaseline = 'middle'
    ctx.fillText(name, 24, height / 2)
    setHasInk(true)
    onChangeRef.current(canvas.toDataURL('image/png'))
  }

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const emit = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onChangeRef.current(canvas.toDataURL('image/png'))
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
          emit()
          setHasInk(true)
        }}
        onPointerLeave={() => {
          if (drawing.current) {
            drawing.current = false
            emit()
            setHasInk(true)
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Assine com o dedo/mouse ou use a assinatura tipográfica.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!typedName.trim()}
            onClick={applyTypedSignature}
          >
            Usar nome como assinatura
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={clearCanvas}>
            Limpar
          </Button>
        </div>
      </div>
      <span className="sr-only">{hasInk ? 'assinatura presente' : 'sem assinatura'}</span>
    </div>
  )
}
