import { Environment, Lightformer } from '@react-three/drei'
import { useDesignStore } from '../../state/designStore'
import { getGarment } from '../../garments/catalog'
import { Garment } from './Garment'

/** Neutral studio: soft key, fill and rim softboxes baked into a local environment (no HDR download). */
function StudioLighting() {
  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[-2.6, 2.4, 3]} scale={[3.2, 2.4, 1]} target={[0, 0.35, 0]} />
        <Lightformer form="rect" intensity={1.1} position={[3.2, 1.2, 2.2]} scale={[2.4, 2.4, 1]} target={[0, 0.35, 0]} />
        <Lightformer form="rect" intensity={1.8} position={[0.4, 2.2, -3.4]} scale={[4.2, 1.6, 1]} target={[0, 0.35, 0]} />
        <Lightformer form="rect" intensity={0.9} position={[-3.4, 0.8, -1.4]} scale={[2, 2.6, 1]} target={[0, 0.35, 0]} />
        <Lightformer form="circle" intensity={1.2} position={[0, 5, 0.5]} scale={4} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.5} color="#f3eee4" position={[0, -2.5, 0]} scale={[8, 8, 1]} rotation-x={-Math.PI / 2} />
      </Environment>
      <ambientLight intensity={0.12} />
      <directionalLight position={[-1.8, 3.2, 2.6]} intensity={0.9} />
      <directionalLight position={[2.4, 1.6, -2.2]} intensity={0.45} />
    </>
  )
}

export function Scene() {
  const productId = useDesignStore((s) => s.design.productId)
  return (
    <>
      <StudioLighting />
      <Garment def={getGarment(productId)} />
    </>
  )
}
