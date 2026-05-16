import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const ORANGE = 0xff5b14
const ORANGE_BRIGHT = new THREE.Color('#FF5B14')
const ORANGE_DARK = new THREE.Color('#2a1a0e')
const BASE_LIGHT_LEVEL = 0.12
const SEG_COUNT = 8
const BAND_COUNT = 12
const SEG_ARC_DEG = 42
const SEG_OUTER = 1.15
const SEG_THICKNESS = 0.08
const FRONT_Z = 0.76

// Six contiguous flat annular slices per segment. Radial extent runs
// edge-to-edge from BAND_INNER to BAND_OUTER (the centers of the previous
// 3-torus version) so neighboring bands share hard edges — no grooves.
const BAND_INNER = 1.0
const BAND_OUTER = 1.15
const BAND_WIDTH = (BAND_OUTER - BAND_INNER) / BAND_COUNT

// All segments breathe in unison; inner→outer ripple per segment remains.
const PERIOD = 6.6667
const BREATH = 6.6667
const BAND_DELAY = 0.1092
const SEG_STAGGER = 0

// Corner-eraser wedge: concave fillet between a sharp 90° corner at the
// origin and a quarter-circle of radius R rounding it.
const CORNER_R = 0.015
const CORNER_Z = FRONT_Z + 0.001
const CORNER_RENDER_ORDER = 10

function BezelSegments({
  segmentsBandsRef,
}: {
  segmentsBandsRef: React.MutableRefObject<(THREE.Mesh | null)[][]>
}) {
  const arc = (SEG_ARC_DEG * Math.PI) / 180
  // 12 o'clock = +Y. Clockwise progression: segment i centered at π/2 - i*(2π/8).
  const centers = Array.from(
    { length: SEG_COUNT },
    (_, i) => Math.PI / 2 - (i * 2 * Math.PI) / SEG_COUNT,
  )

  // One ShapeGeometry shared across all 32 wedges. The arc parameter uses
  // clockwise=true so the sweep is a 90° quarter-circle curving toward
  // origin (CCW from -π/2 to π would trace 270°).
  const wedgeGeom = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(CORNER_R, 0)
    shape.absarc(CORNER_R, CORNER_R, CORNER_R, -Math.PI / 2, Math.PI, true)
    shape.lineTo(0, 0)
    return new THREE.ShapeGeometry(shape)
  }, [])
  // DoubleSide so scale.y = -1 mirrored instances still face the camera.
  const wedgeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#0a0a0a',
        side: THREE.DoubleSide,
      }),
    [],
  )

  return (
    <>
      {centers.map((centerAngle, i) => {
        const thetaStart = centerAngle - arc / 2
        return (
          <group key={i}>
            {Array.from({ length: BAND_COUNT }, (_, j) => {
              const innerR = BAND_INNER + j * BAND_WIDTH
              const outerR = BAND_INNER + (j + 1) * BAND_WIDTH
              return (
                <mesh
                  key={j}
                  ref={(el) => {
                    if (!segmentsBandsRef.current[i])
                      segmentsBandsRef.current[i] = []
                    segmentsBandsRef.current[i][j] = el
                  }}
                  position={[0, 0, FRONT_Z]}
                >
                  <ringGeometry
                    args={[innerR, outerR, 32, 1, thetaStart, arc]}
                  />
                  <meshBasicMaterial color={ORANGE} side={THREE.DoubleSide} />
                </mesh>
              )
            })}
          </group>
        )
      })}
      {/* 32 corner-eraser wedges — 4 per segment, sculpt rounded corners */}
      <group>
        {centers.map((centerAngle, i) => {
          const thetaStart = centerAngle - arc / 2
          const thetaEnd = thetaStart + arc
          const innerLeftPos: [number, number, number] = [
            BAND_INNER * Math.cos(thetaStart),
            BAND_INNER * Math.sin(thetaStart),
            CORNER_Z,
          ]
          const innerRightPos: [number, number, number] = [
            BAND_INNER * Math.cos(thetaEnd),
            BAND_INNER * Math.sin(thetaEnd),
            CORNER_Z,
          ]
          const outerLeftPos: [number, number, number] = [
            BAND_OUTER * Math.cos(thetaStart),
            BAND_OUTER * Math.sin(thetaStart),
            CORNER_Z,
          ]
          const outerRightPos: [number, number, number] = [
            BAND_OUTER * Math.cos(thetaEnd),
            BAND_OUTER * Math.sin(thetaEnd),
            CORNER_Z,
          ]
          return (
            <group key={`wedge-seg-${i}`}>
              <mesh
                geometry={wedgeGeom}
                material={wedgeMaterial}
                position={innerLeftPos}
                rotation={[0, 0, thetaStart]}
                renderOrder={CORNER_RENDER_ORDER}
              />
              <mesh
                geometry={wedgeGeom}
                material={wedgeMaterial}
                position={innerRightPos}
                rotation={[0, 0, thetaEnd]}
                scale={[1, -1, 1]}
                renderOrder={CORNER_RENDER_ORDER}
              />
              <mesh
                geometry={wedgeGeom}
                material={wedgeMaterial}
                position={outerLeftPos}
                rotation={[0, 0, thetaStart + Math.PI]}
                scale={[1, -1, 1]}
                renderOrder={CORNER_RENDER_ORDER}
              />
              <mesh
                geometry={wedgeGeom}
                material={wedgeMaterial}
                position={outerRightPos}
                rotation={[0, 0, thetaEnd + Math.PI]}
                renderOrder={CORNER_RENDER_ORDER}
              />
            </group>
          )
        })}
      </group>
      {/* subtle outer rim accent kept off — depth handled by segments themselves */}
      <mesh position={[0, 0, FRONT_Z - 0.001]}>
        <ringGeometry args={[SEG_OUTER, SEG_OUTER + SEG_THICKNESS * 0.1, 64]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0} />
      </mesh>
    </>
  )
}

const PISTON_AMPLITUDE = 0.4
const PISTON_FREQUENCY_HZ = 0.6
const PISTON_HEAD_BASE_Z = 0.2
const PISTON_RING_BASE_Z = 0.35

function Piston({
  position,
  phase,
}: {
  position: [number, number, number]
  phase: number
}) {
  // LatheGeometry profile points (radial distance r, axial z).
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.13, 0.02),
    new THREE.Vector2(0.13, 0.13),
    new THREE.Vector2(0.1, 0.15),
    new THREE.Vector2(0, 0.15),
  ]
  const headRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const phaseRad = (phase * 2 * Math.PI) / 3
    const z =
      PISTON_AMPLITUDE *
      Math.sin(2 * Math.PI * PISTON_FREQUENCY_HZ * t + phaseRad)
    if (headRef.current) headRef.current.position.z = PISTON_HEAD_BASE_Z + z
    if (ringRef.current) ringRef.current.position.z = PISTON_RING_BASE_Z + z
  })

  return (
    <group position={position} scale={1.5}>
      {/* Piston head — animated */}
      <mesh
        ref={headRef}
        position={[0, 0, PISTON_HEAD_BASE_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <latheGeometry args={[profile, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Ring marker at front of head — animated with head, always on top */}
      <mesh
        ref={ringRef}
        position={[0, 0, PISTON_RING_BASE_Z]}
        renderOrder={999}
      >
        <torusGeometry args={[0.145, 0.008, 12, 48]} />
        <meshBasicMaterial color={ORANGE} transparent depthTest={false} />
      </mesh>
    </group>
  )
}

function HeroForm() {
  const segmentsBandsRef = useRef<(THREE.Mesh | null)[][]>([])

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    for (let i = 0; i < SEG_COUNT; i++) {
      const segArr = segmentsBandsRef.current[i]
      if (!segArr) continue
      for (let j = 0; j < BAND_COUNT; j++) {
        const arcMesh = segArr[j]
        if (!arcMesh) continue
        const t_arc =
          (((time - i * SEG_STAGGER - j * BAND_DELAY) % PERIOD) + PERIOD) %
          PERIOD
        let eased = 0
        if (t_arc <= BREATH) {
          const x = t_arc / BREATH
          const raw = 1 - Math.pow(2 * x - 1, 2)
          eased = raw * raw * (3 - 2 * raw)
        }
        const lerpT = BASE_LIGHT_LEVEL + (1 - BASE_LIGHT_LEVEL) * eased
        ;(arcMesh.material as THREE.MeshBasicMaterial).color.lerpColors(
          ORANGE_DARK,
          ORANGE_BRIGHT,
          lerpT,
        )
      }
    }
  })

  return (
    <group>
      {/* Body cylinder — axis along Z so it's end-on to camera */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 1.5, 64, 1, true]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Pistons (inside body, visible through smoked glass front) */}
      <Piston position={[0, 0.42, 0]} phase={0} />
      <Piston position={[-0.364, -0.21, 0]} phase={1} />
      <Piston position={[0.364, -0.21, 0]} phase={2} />

      {/* Smoked-glass front face */}
      <mesh position={[0, 0, 0.78]}>
        <circleGeometry args={[0.9, 64]} />
        <meshPhysicalMaterial
          color="#0a0a0a"
          transmission={0.85}
          roughness={0.15}
          ior={1.4}
          thickness={0.1}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Bezel ring (8 segments) */}
      <BezelSegments segmentsBandsRef={segmentsBandsRef} />
    </group>
  )
}

export default function App() {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '0vh',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#1d1d1d',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontWeight: 700,
          fontSize: 140,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        DAKSH BAHUGUNA
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#9a9a9a',
          fontFamily: "'JetBrainsMono-Bold', ui-monospace, monospace",
          fontSize: 18,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        coming soon
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          color: '#585858',
          fontFamily: "'JetBrainsMono-Bold', ui-monospace, monospace",
          fontSize: 13,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg
          width="14"
          height="11"
          viewBox="0 0 14 11"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <rect
            x="0.5"
            y="0.5"
            width="13"
            height="10"
            rx="1"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path d="M0.5 0.5L7 6L13.5 0.5" stroke="currentColor" strokeWidth="1" />
        </svg>
        dakshbahuguna@gmail.com
      </div>

      <Canvas
        camera={{ position: [0, 0, 14], fov: 14 }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0)
        }}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[4, 4, 3]}
          intensity={1.4}
          color="#E8E2D4"
        />
        <directionalLight
          position={[-3, 1, 2]}
          intensity={0.6}
          color="#C8D2E0"
        />
        <HeroForm />
      </Canvas>
    </>
  )
}
