// End-to-end check in headless Chromium with phone emulation and real touch events.
// Usage: npm run build && npm run test:e2e   (needs Playwright + Chromium available)
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 4179;
const OUT = process.env.E2E_OUT ?? "e2e-screens";
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe" });
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => String(d).includes(String(PORT)) && resolve());
  server.on("exit", () => reject(new Error("preview server exited")));
});

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function openPhone(viewport, name) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?seed=42&test`);
  await page.waitForFunction(() => window.__yum?.game);
  return { ctx, page, errors, name };
}

// Play/Next buttons bounce forever, so Playwright never sees them as "stable": tap by position.
const tapButton = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};
const noOverflow = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll("button:not([hidden]), .slot")].every((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= vw + 0.5;
    });
  });
const snap = (page) => page.evaluate(() => window.__yum.game.debugSnapshot());
const waitPhase = (page, phase, timeout = 10000) =>
  page.waitForFunction((p) => window.__yum.game.debugSnapshot().phase === p, phase, { timeout });
const tapItem = async (page, index) => {
  const s = await snap(page);
  const it = s.items.find((i) => i.index === index);
  await page.touchscreen.tap(it.x, it.y);
};

// ---------- full play-through on a typical phone ----------
{
  const { ctx, page, errors } = await openPhone({ width: 390, height: 844 }, "phone");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-start.png` });

  await tapButton(page, "#play");
  await waitPhase(page, "COUNTING");
  await page.screenshot({ path: `${OUT}/02-challenge.png` });

  const seenTargets = new Set();
  for (let round = 0; round < 6; round++) {
    await waitPhase(page, "COUNTING");
    let s = await snap(page);
    const { target, available, item } = s.challenge;
    seenTargets.add(target);
    check(s.count === 0, `round ${round}: starts at 0 (${target} ${item}, ${available} shown)`);
    const numeral = await page.textContent("#target-num");
    check(numeral === String(target), `round ${round}: HUD numeral shows ${target}`);
    check((await page.locator(".slot").count()) === target, `round ${round}: ${target} progress slots`);

    // Tap the first object twice quickly: it must count once.
    await tapItem(page, 0);
    await page.touchscreen.tap(s.items[0].x, s.items[0].y);
    s = await snap(page);
    if (target === 1) {
      check(s.phase === "CELEBRATING" && s.count === 1, `round ${round}: one tap completes target 1`);
    } else {
      check(s.count === 1, `round ${round}: double tap on one object counts once`);
      check(await page.isVisible("#undo"), `round ${round}: undo visible after a selection`);
      if (round === 1) {
        await page.screenshot({ path: `${OUT}/03-one-collected.png` });
        check(await noOverflow(page), `round ${round}: all controls fit on screen with undo and 3 slots`);
        await page.tap("#undo");
        await page.waitForTimeout(1000);
        s = await snap(page);
        check(s.count === 0 && !s.items[0].collected, `round ${round}: undo returns the object`);
        await tapItem(page, 0);
        await page.waitForTimeout(200);
      }
      for (let i = 1; i < target; i++) {
        await page.waitForTimeout(250);
        await tapItem(page, i);
      }
      // An extra tap right after completion must be ignored.
      await tapItem(page, target);
      s = await snap(page);
      check(s.phase === "CELEBRATING" && s.count === target, `round ${round}: completes at exactly ${target}, extra tap ignored`);
      check((await page.locator(".slot.filled").count()) === target, `round ${round}: all slots filled`);
    }
    if (round === 0) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/04-celebrate.png` });
    }
    if (round === 2) {
      await page.waitForSelector("#next:not([hidden])");
      await tapButton(page, "#next");
    }
    await page.waitForFunction((id) => window.__yum.game.debugSnapshot().challenge?.id !== id, s.challenge.id, { timeout: 10000 });
  }
  check(seenTargets.size === 3, `targets 1, 2 and 3 all appeared (${[...seenTargets].sort()})`);

  // Help: tap the basket.
  await waitPhase(page, "COUNTING");
  const b = (await snap(page)).basket;
  await page.touchscreen.tap(b.x, b.y);
  check((await snap(page)).phase === "COUNTING", "tapping the basket gives help without changing state");

  // Sound toggle and replay.
  const before = await page.getAttribute("#sound", "aria-pressed");
  await page.tap("#sound");
  const after = await page.getAttribute("#sound", "aria-pressed");
  check(before === "true" && after === "false", "sound toggle switches off");
  await page.tap("#replay");
  await page.tap("#sound");
  check((await page.getAttribute("#sound", "aria-pressed")) === "true", "sound toggle switches back on");

  check(errors.length === 0, `no console errors (${errors.join(" | ")})`);
  await ctx.close();
}

// ---------- layout on other screen sizes ----------
for (const [w, h, name] of [
  [320, 568, "small"],
  [430, 932, "large"],
  [844, 390, "landscape"],
  [768, 1024, "tablet"],
]) {
  const { ctx, page, errors } = await openPhone({ width: w, height: h }, name);
  await tapButton(page, "#play");
  await waitPhase(page, "COUNTING");
  const s = await snap(page);
  const stage = await page.locator("#stage").boundingBox();
  const inside = (p) => p.x > stage.x && p.x < stage.x + stage.width && p.y > stage.y && p.y < stage.y + stage.height;
  check(s.items.every(inside) && inside(s.basket) && inside(s.animal), `${name} ${w}x${h}: animal, objects and basket inside the play area`);
  await page.screenshot({ path: `${OUT}/05-${name}.png` });
  await tapItem(page, 0);
  check((await snap(page)).count === 1, `${name}: touch selection works`);
  check(await noOverflow(page), `${name}: all controls fit on screen`);
  check(errors.length === 0, `${name}: no console errors`);
  await ctx.close();
}

await browser.close();
server.kill();
console.log(failures === 0 ? "\nAll e2e checks passed" : `\n${failures} e2e check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
