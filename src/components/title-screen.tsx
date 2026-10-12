type Props = {
  onSolo: () => void;
  onLobby: () => void;
};

export function TitleScreen({ onSolo, onLobby }: Props) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="crt pointer-events-none absolute inset-0" />
      <p className="font-mono text-xs tracking-widest text-gold">COPA NOCTURNA</p>
      <h1 className="mt-3 font-display text-6xl font-bold leading-none text-cream">ASFALTO</h1>
      <p className="font-display text-5xl font-semibold leading-none text-gold">'98</p>
      <p className="mt-5 max-w-xs text-sm leading-relaxed text-mist">
        Autos, motos, titos y tuk-tuks. Pistas de verdad. Solo o en grupo.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button type="button" onClick={onSolo} className="h-14 bg-gold font-display text-lg font-bold text-asphalt">
          CARRERA
        </button>
        <button type="button" onClick={onLobby} className="h-14 border border-gold font-display text-lg font-bold text-gold">
          LOBBY
        </button>
      </div>
      <p className="mt-6 max-w-xs text-xs leading-relaxed text-mist">
        W acelera, A izquierda, D derecha, S frena. El auto no dobla solo: girá el volante en cada curva.
      </p>
    </main>
  );
}
