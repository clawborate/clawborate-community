'use client'
import { useEffect, useRef } from 'react'

const SENTENCES = [
  ["AI",       "agents",   "in",      "harmony"],
  ["chaos",    "becomes",  "order"],
  ["each",     "finds",    "its",     "place"],
  ["minds",    "aligned",  "as",      "one"],
  ["together", "we",       "build"],
  ["\u4EBA",   "\u5DE5",   "\u667A",  "\u80FD"],
]

const FONT    = 'bold 17px system-ui, -apple-system, sans-serif'
const CUBE_H  = 52
const DEPTH   = 13
const PAD_X   = 20
const GAP     = DEPTH + 4
const K       = 0.074
const DAMP    = 0.72
const STAGGER = 6

const PRECLIMB_DUR = 65
const SQUISH_DUR   = 22
const HOP_DUR      = 62
const LAND_DUR     = 28
const CLIMB_DUR    = SQUISH_DUR + HOP_DUR + LAND_DUR
const ARC_H        = CUBE_H + DEPTH + 6

const HOLD_FRAMES    = 230
const SCATTER_FRAMES = 52
const GRAVITY = 0.52
const BOUNCE  = 0.40
const FADE_IN_FRAMES = 35

interface Cube {
  word: string; cw: number; x: number; y: number; vx: number; vy: number
  landed: boolean; atx: number; aty: number; wtx: number; wty: number
  tx: number; ty: number; delay: number; age: number; wobble: number
  wobbleSpeed: number; isClimber: boolean; isDisplaced: boolean
  rotation: number; isRolling: boolean; sx: number; sy: number
  hopX: number; hopY: number; p1x: number; p1y: number; p2x: number; p2y: number
}

export default function CubeAssembly() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0

    function resize() {
      const parent = canvas!.parentElement
      if (!parent) return
      canvas!.width = parent.clientWidth
      canvas!.height = parent.clientHeight
    }
    resize()

    const W = () => canvas!.width
    const H = () => canvas!.height

    // Measure words with canvas
    const wordWidths: Record<string, number> = {}
    function measureWord(word: string) {
      if (wordWidths[word]) return wordWidths[word]
      ctx!.font = FONT
      wordWidths[word] = Math.ceil(ctx!.measureText(word).width) + PAD_X * 2
      return wordWidths[word]
    }
    SENTENCES.flat().forEach(measureWord)

    function rowTargets(words: string[]) {
      const totalW = words.reduce((s, w) => s + measureWord(w), 0) + GAP * (words.length - 1)
      let x = (W() - totalW) / 2
      return words.map(word => {
        const t = { x, y: H() / 2 - CUBE_H / 2 }
        x += measureWord(word) + GAP
        return t
      })
    }

    function makeCubes(words: string[]): Cube[] {
      const targets = rowTargets(words)
      const hasSwap = words.length >= 4
      // When D (climber) lands at C's wrong position, it may overlap C
      // if D is wider. Add just enough gap so their edges don't touch.
      const extraRightGap = hasSwap
        ? Math.max(0, measureWord(words[3]) - measureWord(words[2]))
        : 0

      return words.map((word, ci) => {
        const di = hasSwap ? (ci === 2 ? 3 : ci === 3 ? 2 : ci) : ci
        const targetX = targets[di].x + (hasSwap && ci === 2 ? extraRightGap : 0)
        return {
          word, cw: measureWord(word),
          x: targetX, y: -120 - Math.random() * 180,
          vx: 0, vy: 0, landed: false,
          atx: targetX, aty: targets[di].y,
          wtx: targetX, wty: targets[di].y,
          tx: targets[ci].x, ty: targets[ci].y,
          delay: di * STAGGER, age: 0,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.022 + Math.random() * 0.01,
          isClimber: hasSwap && ci === 3,
          isDisplaced: hasSwap && ci === 2,
          rotation: hasSwap && ci === 3 ? Math.PI : 0,
          isRolling: false, sx: 1, sy: 1,
          hopX: 0, hopY: 0, p1x: 0, p1y: 0, p2x: 0, p2y: 0,
        }
      })
    }

    let sentenceIdx = 0
    let cubes: Cube[] = []
    let phase = 'falling'
    let phaseAge = 0
    let climbAge = 0
    let sceneAlpha = 1
    let dragging: { cube: Cube; offX: number; offY: number } | null = null
    let didDrag = false

    const easeInOut = (t: number) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
    const easeOut = (t: number) => 1-(1-t)*(1-t)
    const easeIn = (t: number) => t*t
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    function springStep(cur: number, tgt: number, vel: number) {
      const dist = Math.abs(tgt - cur)
      const k = K * (0.3 + 0.7 * Math.min(dist / 120, 1))
      vel = (vel + (tgt - cur) * k) * DAMP
      return { v: cur + vel, vel }
    }

    function allSettled() {
      return cubes.every(c =>
        c === dragging?.cube ||
        (Math.abs(c.x - c.atx) < 0.9 && Math.abs(c.y - c.aty) < 0.9 &&
         Math.abs(c.vx) < 0.09 && Math.abs(c.vy) < 0.09)
      )
    }

    function scatter() {
      if (phase === 'scattering') return
      phase = 'scattering'
      phaseAge = 0
      for (const c of cubes) { c.rotation = 0; c.sx = 1; c.sy = 1 }
    }

    function hitTest(mx: number, my: number): Cube | null {
      for (let i = cubes.length - 1; i >= 0; i--) {
        const c = cubes[i]
        if (mx >= c.x && mx <= c.x + c.cw && my >= c.y && my <= c.y + CUBE_H) return c
      }
      return null
    }

    function pointerDown(mx: number, my: number) {
      didDrag = false
      const hit = hitTest(mx, my)
      if (hit) {
        dragging = { cube: hit, offX: mx - hit.x, offY: my - hit.y }
        canvas!.style.cursor = 'grabbing'
      }
    }
    function pointerMove(mx: number, my: number) {
      if (dragging) {
        didDrag = true
        dragging.cube.x = mx - dragging.offX
        dragging.cube.y = my - dragging.offY
        dragging.cube.vx = 0
        dragging.cube.vy = 0
        return
      }
      canvas!.style.cursor = hitTest(mx, my) ? 'grab' : 'default'
    }
    function pointerUp() {
      if (dragging) { dragging.cube.rotation = 0; dragging.cube.sx = 1; dragging.cube.sy = 1 }
      dragging = null
      canvas!.style.cursor = 'default'
    }

    const r = () => canvas!.getBoundingClientRect()
    const onMouseDown = (e: MouseEvent) => pointerDown(e.clientX - r().left, e.clientY - r().top)
    const onMouseMove = (e: MouseEvent) => pointerMove(e.clientX - r().left, e.clientY - r().top)
    const onMouseUp = () => pointerUp()
    const onClick = () => { if (!didDrag) scatter() }
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; pointerDown(t.clientX - r().left, t.clientY - r().top) }
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; pointerMove(t.clientX - r().left, t.clientY - r().top) }
    const onTouchEnd = () => { if (!didDrag) scatter(); pointerUp() }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    function initSentence() {
      cubes = makeCubes(SENTENCES[sentenceIdx])
      phase = 'falling'
      phaseAge = 0
      climbAge = 0
    }
    initSentence()

    const climber = () => cubes.find(c => c.isClimber)
    const displaced = () => cubes.find(c => c.isDisplaced)

    function drawFaces(cw: number, word: string, tint: boolean) {
      const h = CUBE_H, d = DEPTH
      ctx!.strokeStyle = '#111'
      ctx!.lineWidth = 2

      ctx!.beginPath()
      ctx!.moveTo(0,0); ctx!.lineTo(d,-d); ctx!.lineTo(cw+d,-d); ctx!.lineTo(cw,0)
      ctx!.closePath()
      ctx!.fillStyle = tint ? '#fde8c0' : '#ededed'
      ctx!.fill(); ctx!.stroke()

      ctx!.beginPath()
      ctx!.moveTo(cw,0); ctx!.lineTo(cw+d,-d); ctx!.lineTo(cw+d,h-d); ctx!.lineTo(cw,h)
      ctx!.closePath()
      ctx!.fillStyle = tint ? '#f0c878' : '#d2d2d2'
      ctx!.fill(); ctx!.stroke()

      ctx!.beginPath(); ctx!.rect(0, 0, cw, h)
      ctx!.fillStyle = tint ? '#fffbf2' : '#fff'
      ctx!.fill(); ctx!.stroke()

      ctx!.fillStyle = '#111'; ctx!.font = FONT
      ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'
      ctx!.fillText(word, cw/2, h/2 + 1)
    }

    function drawCube(cube: Cube, yOff: number, tint: boolean) {
      const cw = cube.cw
      const cx = cube.x + cw / 2
      const cy = cube.y + yOff + CUBE_H / 2

      if (cube.isRolling) {
        // Mid-spin: flat face only (no 3D depth), rotated
        ctx!.save()
        ctx!.translate(cx, cy)
        ctx!.rotate(cube.rotation)
        ctx!.scale(cube.sx, cube.sy)
        ctx!.translate(-cw / 2, -CUBE_H / 2)
        ctx!.strokeStyle = '#111'; ctx!.lineWidth = 2
        ctx!.beginPath(); ctx!.rect(0, 0, cw, CUBE_H)
        ctx!.fillStyle = tint ? '#fffbf2' : '#fff'
        ctx!.fill(); ctx!.stroke()
        ctx!.fillStyle = '#111'; ctx!.font = FONT
        ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'
        ctx!.fillText(cube.word, cw / 2, CUBE_H / 2 + 1)
        ctx!.restore()
      } else {
        // Normal or upside-down: full 3D shell in correct orientation,
        // text rotated independently inside the front face.
        ctx!.save()
        ctx!.translate(cx, cy)
        ctx!.scale(cube.sx, cube.sy)
        ctx!.translate(-cw / 2, -CUBE_H / 2)

        const h = CUBE_H, d = DEPTH
        ctx!.strokeStyle = '#111'; ctx!.lineWidth = 2

        // Top face
        ctx!.beginPath()
        ctx!.moveTo(0,0); ctx!.lineTo(d,-d); ctx!.lineTo(cw+d,-d); ctx!.lineTo(cw,0)
        ctx!.closePath()
        ctx!.fillStyle = tint ? '#fde8c0' : '#ededed'
        ctx!.fill(); ctx!.stroke()

        // Right face
        ctx!.beginPath()
        ctx!.moveTo(cw,0); ctx!.lineTo(cw+d,-d); ctx!.lineTo(cw+d,h-d); ctx!.lineTo(cw,h)
        ctx!.closePath()
        ctx!.fillStyle = tint ? '#f0c878' : '#d2d2d2'
        ctx!.fill(); ctx!.stroke()

        // Front face
        ctx!.beginPath(); ctx!.rect(0, 0, cw, h)
        ctx!.fillStyle = tint ? '#fffbf2' : '#fff'
        ctx!.fill(); ctx!.stroke()

        // Text — rotated around front face center if upside-down
        ctx!.save()
        ctx!.translate(cw / 2, h / 2)
        ctx!.rotate(cube.rotation)
        ctx!.fillStyle = '#111'; ctx!.font = FONT
        ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'
        ctx!.fillText(cube.word, 0, 1)
        ctx!.restore()

        ctx!.restore()
      }
    }

    function frame() {
      ctx!.fillStyle = '#fff'
      ctx!.fillRect(0, 0, W(), H())

      phaseAge++
      const cl = climber()
      const di = displaced()
      const hasSwap = !!cl
      const isClimbPhase = phase === 'pre-climb' || phase === 'climbing'

      if (phase === 'falling') {
        if (cubes.every(c => c.landed)) {
          phase = 'assembling-wrong'; phaseAge = 0
          cubes.forEach(c => { c.age = 0; c.vx = 0; c.vy = 0 })
        }
      } else if (phase === 'assembling-wrong') {
        if (allSettled()) {
          phase = hasSwap ? 'pre-climb' : 'holding'; phaseAge = 0
          if (!hasSwap) cubes.forEach(c => c.wobble = 0)
        }
      } else if (phase === 'pre-climb' && cl) {
        cl.rotation = Math.PI
        if (phaseAge > PRECLIMB_DUR) {
          phase = 'climbing'; phaseAge = 0; climbAge = 0
          cl.rotation = Math.PI
          cl.hopX = cl.x; cl.hopY = cl.y
          cl.p1x = cl.hopX; cl.p1y = cl.hopY - ARC_H
          cl.p2x = cl.tx; cl.p2y = cl.hopY - ARC_H
        }
      } else if (phase === 'climbing' && cl && di) {
        climbAge++
        const sub = climbAge
        const RISE_END = 0.30, DROP_START = 0.70

        if (sub <= SQUISH_DUR) {
          const t = easeOut(sub / SQUISH_DUR)
          cl.sx = 1 + t * 0.32; cl.sy = 1 - t * 0.38; cl.rotation = Math.PI
        } else if (sub <= SQUISH_DUR + HOP_DUR) {
          const t = (sub - SQUISH_DUR) / HOP_DUR
          const sq = Math.max(0, 1 - t / (RISE_END * 0.8))
          cl.sx = 1 + sq * 0.32; cl.sy = 1 - sq * 0.38

          if (t <= RISE_END) {
            const rt = easeOut(t / RISE_END)
            cl.x = cl.hopX; cl.y = lerp(cl.hopY, cl.p1y, rt)
          } else if (t <= DROP_START) {
            const ct = easeInOut((t - RISE_END) / (DROP_START - RISE_END))
            cl.x = lerp(cl.p1x, cl.p2x, ct); cl.y = cl.p1y
            cl.sx = 1; cl.sy = 1
            if (t >= (RISE_END + DROP_START) / 2) di.atx = di.tx
          } else {
            const dt = easeIn((t - DROP_START) / (1 - DROP_START))
            cl.x = cl.tx; cl.y = lerp(cl.p1y, cl.hopY, dt)
            const impact = Math.max(0, dt - 0.6) / 0.4
            cl.sx = 1 + impact * 0.18; cl.sy = 1 - impact * 0.22
          }
          cl.vx = 0; cl.vy = 0
          const totalDx = cl.tx - cl.hopX
          const curDx = Math.max(0, Math.min(cl.x - cl.hopX, totalDx))
          const rollFrac = totalDx > 0 ? curDx / totalDx : t
          cl.rotation = Math.PI + rollFrac * Math.PI
          cl.isRolling = rollFrac > 0 && rollFrac < 1
        } else {
          const t = (sub - SQUISH_DUR - HOP_DUR) / LAND_DUR
          const squash = Math.sin(t * Math.PI)
          cl.x = cl.tx; cl.y = cl.ty; cl.rotation = 0
          cl.sx = 1 + squash * 0.28; cl.sy = 1 - squash * 0.32
        }

        if (climbAge >= CLIMB_DUR) {
          cl.rotation = 0; cl.sx = 1; cl.sy = 1; cl.isRolling = false
          cl.x = cl.tx; cl.y = cl.ty; cl.atx = cl.tx; cl.aty = cl.ty
          di.atx = di.tx; di.aty = di.ty
          phase = 'holding'; phaseAge = 0
          cubes.forEach(c => c.wobble = 0)
        }
      } else if (phase === 'holding') {
        if (phaseAge > HOLD_FRAMES) scatter()
      } else if (phase === 'scattering') {
        if (phaseAge > SCATTER_FRAMES) {
          sentenceIdx = (sentenceIdx + 1) % SENTENCES.length
          initSentence()
        }
      }

      const drawOrder = [...cubes].sort((a, b) => {
        if (isClimbPhase && a.isClimber !== b.isClimber) return a.isClimber ? 1 : -1
        return a.x - b.x
      })

      if (phase === 'scattering') {
        sceneAlpha = Math.max(0, 1 - phaseAge / SCATTER_FRAMES)
      } else if (phase === 'falling') {
        sceneAlpha = Math.min(1, phaseAge / FADE_IN_FRAMES)
      } else {
        sceneAlpha = 1
      }
      ctx!.globalAlpha = sceneAlpha

      for (const cube of drawOrder) {
        cube.age++
        const isDragged = dragging?.cube === cube
        const isClimberNow = cube.isClimber && phase === 'climbing'

        if (!isDragged && !isClimberNow) {
          if (phase === 'falling') {
            if (!cube.landed) {
              cube.vy += GRAVITY; cube.vx *= 0.994
              cube.x += cube.vx; cube.y += cube.vy
              const floor = H() / 2 - CUBE_H / 2
              if (cube.y >= floor) {
                cube.y = floor
                const nextVy = cube.vy * -BOUNCE
                if (Math.abs(nextVy) < 4.0) { cube.vy = 0; cube.landed = true }
                else { cube.vy = nextVy }
              }
            }
          } else if (phase !== 'scattering' && cube.age > cube.delay) {
            const rx = springStep(cube.x, cube.atx, cube.vx)
            const ry = springStep(cube.y, cube.aty, cube.vy)
            cube.x = rx.v; cube.vx = rx.vel
            cube.y = ry.v; cube.vy = ry.vel
          }
        }

        let yOff = 0
        if (phase === 'holding') {
          cube.wobble += cube.wobbleSpeed
          yOff = Math.sin(cube.wobble) * 2.8
        }

        const tint = isClimbPhase && cube.isClimber
        drawCube(cube, yOff, tint)
      }

      ctx!.globalAlpha = 1
      animId = requestAnimationFrame(frame)
    }

    frame()

    const resizeObs = new ResizeObserver(() => { resize(); initSentence() })
    resizeObs.observe(canvas!.parentElement!)

    return () => {
      cancelAnimationFrame(animId)
      resizeObs.disconnect()
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
}
