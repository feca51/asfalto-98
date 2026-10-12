import { useEffect, useRef } from "react";

type Props = { carId: string; color: string };

export function CarPreview({ carId, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let destroy = () => {};
    void import("@/game/engine").then((mod) => {
      if (dead || !canvasRef.current) return;
      const handle = mod.mountPreview(canvasRef.current, carId, color);
      destroy = () => handle.destroy();
    });
    return () => {
      dead = true;
      destroy();
    };
  }, [carId, color]);

  return (
    <div className="relative h-48 w-full overflow-hidden border border-line bg-asphalt">
      <div className="crt pointer-events-none absolute inset-0 z-10" />
      <canvas ref={canvasRef} className="ps1 h-full w-full" />
    </div>
  );
}
