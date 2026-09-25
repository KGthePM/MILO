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
//
// `eggs="idle"` opts in to the occasional easter egg drifting past while the
// backdrop idles (sign-in, landing hero). Leave it off anywhere text is being
// read over the canvas. `skip` jumps a running warp straight to its exit flash.
export default function NeonHorizon({ phase = 'idle', variant = 'full', eggs = false, skip = false, className = '' }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createNeonHorizon(canvasRef.current, { variant, eggs });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [variant, eggs]);

  // Phase rides a separate effect so changing it never tears down and
  // restarts the animation loop.
  useEffect(() => {
    engineRef.current?.setPhase(phase);
  }, [phase]);

  useEffect(() => {
    if (skip) engineRef.current?.skip();
  }, [skip]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block w-full h-full pointer-events-none ${className}`}
    />
  );
}
