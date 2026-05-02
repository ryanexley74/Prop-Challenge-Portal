export type SoundChoice = "chime" | "whistle" | "airhorn" | "register" | "broadcast";

export const SOUND_OPTIONS: { value: SoundChoice; label: string; description: string }[] = [
  { value: "chime",     label: "🔔 Chime",        description: "Soft two-note bell" },
  { value: "whistle",   label: "🏈 Whistle",       description: "Referee whistle blast" },
  { value: "airhorn",   label: "📣 Air Horn",      description: "Loud stadium air horn" },
  { value: "register",  label: "💰 Ding",          description: "Cash register ding" },
  { value: "broadcast", label: "📺 Broadcast",     description: "3-note TV chime" },
];

function ctx(): AudioContext {
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

function chime(ac: AudioContext) {
  [523.25, 659.25].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    osc.start(t); osc.stop(t + 1.3);
  });
}

function whistle(ac: AudioContext) {
  const osc  = ac.createOscillator();
  const g    = ac.createGain();
  const lfo  = ac.createOscillator();
  const lfoG = ac.createGain();
  lfo.frequency.value = 9;
  lfoG.gain.value = 14;
  lfo.connect(lfoG); lfoG.connect(osc.frequency);
  osc.connect(g); g.connect(ac.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(2900, ac.currentTime);
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(0.38, ac.currentTime + 0.02);
  g.gain.setValueAtTime(0.38, ac.currentTime + 0.45);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.7);
  lfo.start(ac.currentTime); lfo.stop(ac.currentTime + 0.7);
  osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.7);
}

function airhorn(ac: AudioContext) {
  const osc    = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const g      = ac.createGain();
  osc.connect(filter); filter.connect(g); g.connect(ac.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(108, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(118, ac.currentTime + 0.65);
  filter.type = "bandpass";
  filter.frequency.value = 850;
  filter.Q.value = 0.9;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(0.55, ac.currentTime + 0.03);
  g.gain.setValueAtTime(0.55, ac.currentTime + 0.58);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.85);
  osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.85);
}

function register(ac: AudioContext) {
  [1318.5, 1567.98].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.13;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.55);
  });
}

function broadcast(ac: AudioContext) {
  // Descending major triad: G5 → E5 → C5
  [783.99, 659.25, 523.25].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.24;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.38, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    osc.start(t); osc.stop(t + 1.5);
  });
}

export function playPropSound(choice: string = "chime"): void {
  try {
    const ac = ctx();
    switch (choice) {
      case "whistle":   whistle(ac);   break;
      case "airhorn":   airhorn(ac);   break;
      case "register":  register(ac);  break;
      case "broadcast": broadcast(ac); break;
      default:          chime(ac);     break;
    }
  } catch {
    // AudioContext unavailable (no user gesture yet, or restricted environment)
  }
}
