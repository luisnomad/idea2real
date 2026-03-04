import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage, useGLTF } from '@react-three/drei'

interface ModelViewerProps {
  url: string | null
  format?: 'glb' | 'stl'
}

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

function ViewerFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  )
}

export default function ModelViewer({ url }: ModelViewerProps) {
  if (!url) {
    return (
      <div
        data-testid="viewer-empty"
        className="flex items-center justify-center h-64 border border-dashed border-surface-border dark:border-surface-dark-border rounded-lg"
      >
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
          No model to display
        </p>
      </div>
    )
  }

  return (
    <div data-testid="model-viewer" className="h-80 rounded-lg overflow-hidden border border-surface-border dark:border-surface-dark-border bg-black/5 dark:bg-white/5">
      <Canvas camera={{ position: [0, 2, 5], fov: 45 }}>
        <Suspense fallback={<ViewerFallback />}>
          <Stage environment="city" intensity={0.5}>
            <GLBModel url={url} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
