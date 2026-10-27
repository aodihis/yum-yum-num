import "./ui/styles.css";
import { AudioManager } from "./game/AudioManager";
import { Game } from "./game/Game";
import type { Level } from "./game/types";
import { HUD } from "./ui/HUD";

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get("seed"));
const seed = Number.isFinite(seedParam) && params.has("seed") ? seedParam : Math.floor(Math.random() * 1e9);
const levelParam = Number(params.get("level"));
const startLevel = ([1, 2, 3].includes(levelParam) ? levelParam : 1) as Level;
// Logged so any odd sequence can be reproduced with ?seed=<n>.
console.info(`Yum Yum Num seed=${seed}`);

const audio = new AudioManager(import.meta.env.BASE_URL);
let game: Game | null = null;

const hud = new HUD({
  onPlay: () => {
    audio.unlock();
    hud.hideStart();
    game?.start();
  },
  onReplay: () => game?.replayInstruction(),
  onSound: () => {
    audio.setEnabled(!audio.enabled);
    hud.setSound(audio.enabled);
    if (audio.enabled) audio.unlock();
  },
  onUndo: () => game?.undo(),
  onNext: () => game?.skipCelebration(),
});
hud.setSound(audio.enabled);

try {
  game = new Game(hud, audio, { seed, startLevel });
} catch (err) {
  console.error(err);
  hud.stage.innerHTML =
    '<p style="padding:24px;font-size:22px;text-align:center">This device cannot show 3D graphics. Please try another browser.</p>';
}

if (params.has("test")) {
  (window as unknown as { __yum: unknown }).__yum = { game, audio };
}
