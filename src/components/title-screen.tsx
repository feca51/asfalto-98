type Props = { onEnter: () => void };

export function TitleScreen({ onEnter }: Props) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="crt pointer-events-none absolute inset-0" />
      <p className="font-mono text-xs tracking-widest text-gold">COPA NOCTURNA</p>
      <h1 className="mt-3 font-display text-6xl font-bold leading-none text-cream">ASFALTO</h1>
      <p className="font-display text-5xl font-semibold leading-none text-gold">'98</p>
      <p className="mt-5 max-w-xs text-sm leading-relaxed text-mist">
        Armá la grilla, elegí la pista y largá. Al final, un solo nombre y la musiquita del ganador.
      </p>
      <button
        type="button"
        onClick={onEnter}
        className="mt-8 h-14 w-full max-w-xs bg-gold font-display text-lg font-bold text-asphalt"
      >
        ENTRAR A BOXES
      </button>
      <p className="mt-6 max-w-xs text-xs leading-relaxed text-mist">
        Teclado: W acelera, A izquierda, D derecha, S frena. En el teléfono, los botones de abajo.
      </p>
    </main>
  );
}
