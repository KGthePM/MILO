import { useEffect, useRef } from 'react';
import { createNeonHorizon } from '../../utils/neonHorizon';

// Canvas backdrop for the auth surfaces — synthwave grid, starfield, horizon
// glow. All the drawing and lifecycle logic lives in utils/neonHorizon.js;
// this is only the React seam.
//
// Positioning is deliberately left to the caller via className: AuthGate needs
// `fixed` (its shell is min-h-screen and carries safe-area padding), while the
// landing hero and the lock curtain want `absolute inset-0` inside their own
// section. The component sets no position of its own.
export default function NeonHorizon({ phase = 'idle', variant = 'full', className = '' }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createNeonHorizon(canvasRef.current, { variant });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [variant]);

  // Phase rides a separate effect so changing it never tears down and
  // restarts the animation loop.
  useEffect(() => {
    engineRef.current?.setPhase(phase);
  }, [phase]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block w-full h-full pointer-events-none ${className}`}
    />
  );
}
