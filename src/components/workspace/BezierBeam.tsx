'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface BezierBeamProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  onDone: () => void
}

export function BezierBeam({ from, to, onDone }: BezierBeamProps) {
  // Control points: from curves left, to curves right — creates an S-curve going right-to-left
  const cx1 = from.x - 80
  const cy1 = from.y
  const cx2 = to.x + 80
  const cy2 = to.y
  const d = `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`

  useEffect(() => {
    const t = setTimeout(onDone, 1200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-50"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
    >
      <motion.path
        d={d}
        stroke="var(--accent)"
        strokeWidth={2}
        fill="none"
        strokeDasharray="6 4"
        initial={{ pathLength: 0, opacity: 0.9 }}
        animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }}
        transition={{
          duration: 0.9,
          ease: 'easeInOut',
          opacity: { times: [0, 0.7, 1], duration: 1.1 },
        }}
      />
      <motion.circle
        cx={to.x}
        cy={to.y}
        r={5}
        fill="var(--accent)"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 1.5, 1], opacity: [1, 1, 0] }}
        transition={{ delay: 0.85, duration: 0.35 }}
      />
    </svg>
  )
}
