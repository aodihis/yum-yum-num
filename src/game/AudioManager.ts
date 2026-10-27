import type { CollectibleType, Target } from "./types";

const NUMBER_WORDS = ["zero", "one", "two", "three"] as const;
const PLURAL: Record<CollectibleType, [string, string]> = {
  banana: ["banana", "bananas"],
  carrot: ["carrot", "carrots"],
  apple: ["apple", "apples"],
};

export type VoiceLine = `ask_${CollectibleType}_${Target}` | `count_${Target}` | "together" | "great_job";

/** Text for every voice line. Also the script for recording clips (see README). */
export function voiceText(line: VoiceLine): string {
  if (line === "together") return "Let's count together!";
  if (line === "great_job") return "Great job!";
  const [kind, a, b] = line.split("_");
  if (kind === "count") {
    const word = NUMBER_WORDS[Number(a)];
    return word[0].toUpperCase() + word.slice(1) + "!";
  }
  const n = Number(b) as Target;
  const [one, many] = PLURAL[a as CollectibleType];
  return `Can you give me ${NUMBER_WORDS[n]} ${n === 1 ? one : many}?`;
}

export type Sfx = "pop" | "whoosh" | "cheer" | "boing" | "tap";

const SOUND_KEY = "yum-yum-num:sound";

/**
 * Plays voice lines and sound effects. Voice uses recorded clips listed in
 * `audio/manifest.json` when available, otherwise browser speech synthesis.
 * Every call is fire-and-forget and never throws: the game works fully muted.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private clips = new Map<string, AudioBuffer>();
  private clipFiles = new Map<string, string>();
  private voiceSource: AudioBufferSourceNode | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private _enabled: boolean;

  constructor(private readonly baseUrl: string) {
    this._enabled = readSoundPref();
    this.pickVoice();
    if ("speechSynthesis" in window) {
      speechSynthesis.addEventListener?.("voiceschanged", () => this.pickVoice());
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopVoice();
      else void this.ctx?.resume().catch(() => {});
    });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      /* storage unavailable: preference lasts for this visit only */
    }
    if (!on) this.stopVoice();
  }

  /** Must be called from a user gesture (the Play button) so mobile browsers allow audio. */
  unlock(): void {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx && Ctor) this.ctx = new Ctor();
      void this.ctx?.resume().catch(() => {});
      void this.loadClips();
    } catch (err) {
      console.warn("Web Audio unavailable", err);
    }
    if ("speechSynthesis" in window) {
      try {
        // iOS only allows speech after one utterance has started inside a gesture.
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    }
  }

  /** Speak a line, interrupting whatever was being said. */
  say(line: VoiceLine): void {
    if (!this._enabled) return;
    this.stopVoice();
    const buffer = this.clips.get(line);
    if (buffer && this.ctx) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.ctx.destination);
        src.start();
        this.voiceSource = src;
        return;
      } catch (err) {
        console.warn("Clip playback failed, using speech synthesis", err);
      }
    }
    this.speak(voiceText(line));
  }

  sfx(kind: Sfx): void {
    const ctx = this.ctx;
    if (!this._enabled || !ctx || ctx.state !== "running") return;
    try {
      const t = ctx.currentTime;
      switch (kind) {
        case "pop":
          this.tone(ctx, "sine", 520, 980, t, 0.12, 0.25);
          break;
        case "tap":
          this.tone(ctx, "triangle", 700, 500, t, 0.08, 0.12);
          break;
        case "whoosh":
          this.tone(ctx, "sine", 300, 700, t, 0.25, 0.08);
          break;
        case "boing":
          this.tone(ctx, "sine", 220, 440, t, 0.18, 0.2);
          this.tone(ctx, "sine", 440, 260, t + 0.18, 0.18, 0.15);
          break;
        case "cheer":
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(ctx, "triangle", f, f, t + i * 0.11, 0.3, 0.2));
          break;
      }
    } catch {
      /* sound effects are optional */
    }
  }

  private tone(ctx: AudioContext, type: OscillatorType, from: number, to: number, start: number, dur: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private stopVoice(): void {
    try {
      this.voiceSource?.stop();
    } catch {
      /* already stopped */
    }
    this.voiceSource = null;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  private speak(text: string): void {
    if (!("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.9;
      u.pitch = 1.25;
      if (this.voice) u.voice = this.voice;
      speechSynthesis.speak(u);
    } catch (err) {
      console.warn("Speech synthesis failed", err);
    }
  }

  private pickVoice(): void {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
    const preferred = ["Samantha", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Karen", "Moira"];
    this.voice =
      preferred.map((name) => voices.find((v) => v.name.includes(name))).find(Boolean) ??
      voices.find((v) => v.localService) ??
      voices[0] ??
      null;
  }

  private loadPromise: Promise<void> | null = null;

  private loadClips(): Promise<void> {
    this.loadPromise ??= (async () => {
      const ctx = this.ctx;
      if (!ctx) return;
      try {
        const res = await fetch(`${this.baseUrl}audio/manifest.json`);
        if (!res.ok) return;
        const manifest = (await res.json()) as { clips?: Record<string, string> | string[] };
        const entries = Array.isArray(manifest.clips)
          ? manifest.clips.map((name) => [name, `${name}.mp3`] as const)
          : Object.entries(manifest.clips ?? {});
        for (const [line, file] of entries) this.clipFiles.set(line, file);
        await Promise.all(
          [...this.clipFiles].map(async ([line, file]) => {
            try {
              const r = await fetch(`${this.baseUrl}audio/${file}`);
              if (!r.ok) return;
              this.clips.set(line, await ctx.decodeAudioData(await r.arrayBuffer()));
            } catch (err) {
              console.warn(`Could not load voice clip ${file}`, err);
            }
          }),
        );
      } catch (err) {
        console.warn("Voice clips unavailable, using speech synthesis", err);
      }
    })();
    return this.loadPromise;
  }
}

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
