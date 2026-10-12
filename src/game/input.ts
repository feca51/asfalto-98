export type TouchPad = {
  left: boolean;
  right: boolean;
  gas: boolean;
  brake: boolean;
};

const held = new Set<string>();

export function bindKeyboard() {
  const down = (event: KeyboardEvent) => {
    held.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
  };
  const up = (event: KeyboardEvent) => {
    held.delete(event.code);
  };
  const clear = () => held.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", clear);
    held.clear();
  };
}

export function setHeldKeys(codes: string[]) {
  held.clear();
  for (const code of codes) held.add(code);
}

export function readInput(touch: TouchPad) {
  let steer = 0;
  if (held.has("KeyA") || held.has("ArrowLeft") || touch.left) steer += 1;
  if (held.has("KeyD") || held.has("ArrowRight") || touch.right) steer -= 1;
  steer = Math.max(-1, Math.min(1, steer));
  const throttle = held.has("KeyW") || held.has("ArrowUp") || touch.gas ? 1 : 0;
  const brake = held.has("KeyS") || held.has("ArrowDown") || held.has("Space") || touch.brake ? 1 : 0;
  return { steer, throttle, brake };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
    };
  }
}

export function installProbe(getYaw: () => number, getSpeed: () => number) {
  const qa =
    import.meta.env.DEV ||
    (typeof location !== "undefined" && new URLSearchParams(location.search).has("qa"));
  if (!qa) return () => {};
  window.__controlsTest = {
    getYaw,
    getSpeed,
    setKeys: setHeldKeys,
  };
  return () => {
    if (window.__controlsTest?.setKeys === setHeldKeys) delete window.__controlsTest;
  };
}
