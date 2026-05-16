import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const ORANGE = 0xff5b14
const SEG_COUNT = 8
const SEG_ARC_DEG = 40
const SEG_INNER = 1.0
const SEG_OUTER = 1.15
const SEG_THICKNESS = 0.08
const FRONT_Z = 0.76

function BezelSegments({
  segmentsRef,
}: {
  segmentsRef: React.MutableRefObject<(THREE.Mesh | null)[]>
}) {
  // Ring of 8 segments. 12 o'clock = +Y. Clockwise progression.
  // Segment angular center (radians) — start at +π/2, decrease by 2π/8 each step.
  const segments = Array.from({ length: SEG_COUNT }, (_, i) => {
    const centerAngle = Math.PI / 2 - (i * 2 * Math.PI) / SEG_COUNT
    return { i, centerAngle }
  })

  // RingGeometry with thetaStart/thetaLength gives a flat arc segment.
  const arc = (SEG_ARC_DEG * Math.PI) / 180

  return (
    <>
      {segments.map(({ i, centerAngle }) => {
        const thetaStart = centerAngle - arc / 2
        return (
          <mesh
            key={i}
            ref={(el) => {
              segmentsRef.current[i] = el
            }}
            position={[0, 0, FRONT_Z]}
          >
            <ringGeometry
              args={[SEG_INNER, SEG_OUTER, 48, 1, thetaStart, arc]}
            />
            <meshBasicMaterial
              color={ORANGE}
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
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
  const segmentsRef = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const CYCLE = 12
    const SOFTNESS = 0.08
    const t = clock.elapsedTime % CYCLE
    const progress = (1 - Math.cos((2 * Math.PI * t) / CYCLE)) / 2
    segmentsRef.current.forEach((seg, i) => {
      if (!seg) return
      const target = (i + 1) / SEG_COUNT
      const x = Math.min(
        Math.max((progress - (target - SOFTNESS)) / SOFTNESS, 0),
        1,
      )
      const eased = x * x * (3 - 2 * x)
      const opacity = 0.2 + 0.8 * eased
      ;(seg.material as THREE.MeshBasicMaterial).opacity = opacity
    })
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
      <BezelSegments segmentsRef={segmentsRef} />
    </group>
  )
}

export default function App() {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '12vh',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#FF5B14',
          fontFamily: "'JetBrainsMono-Bold', ui-monospace, monospace",
          fontSize: 64,
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
          top: '78vh',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#E3E3E3',
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
          bottom: 24,
          left: 24,
          color: '#585858',
          fontFamily: "'JetBrainsMono-Bold', ui-monospace, monospace",
          fontSize: 13,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
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
