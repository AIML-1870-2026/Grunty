# Spike Jumper — Spec

## Overview
A side-scrolling rhythm platformer inspired by Geometry Dash. The player controls a stickman that auto-runs through obstacle courses. One input (click or spacebar) launches the stickman into a front flip. Stick the landing, keep running. Hit a spike, die. Reach the end, win.

---

## Core Mechanic

- **Auto-scroll**: The world moves left at a constant speed; the stickman stays fixed horizontally
- **Single input**: Spacebar or click/tap = front flip jump
- **Gravity**: The stickman falls back down after each flip; no double-jump
- **Death = restart**: Any collision with a spike or ceiling resets the attempt
- **Goal**: Survive from start to finish line

---

## Player Stickman

- Fixed X position (~20% from left edge)
- Drawn with Canvas 2D lines: circle head, line torso, line arms, line legs
- **Running animation**: Legs and arms swing in a walk/run cycle while on the ground
- **Jump animation**: Full 360° front flip — the entire body rotates around the stickman's center of mass, completing exactly one rotation per jump arc (timed to gravity)
- **Landing**: Snaps back to neutral run pose on touchdown
- Cannot move left/right — only up/down
- **States**: `running`, `flipping`, `dead`

### Flip Details
- Rotation origin: center of the stickman's torso
- Rotation speed: calculated so the flip completes ~90% of 360° at the apex and finishes on landing
- Arms tucked slightly inward during the flip (tighter silhouette)
- A small motion-blur trail fades behind the stickman during the flip

---

## Obstacles

| Type | Description |
|---|---|
| Floor Spike | Upward-pointing triangle on the ground — most common |
| Ceiling Spike | Downward-pointing triangle — forces low path |
| Spike Cluster | Group of 2–4 spikes back to back |
| Platform | Elevated floor segment the cube can land on |
| Gap | Missing floor section — fall in = die |

---

## Level Structure

- **3 levels** of increasing difficulty
- Each level is a fixed, hand-crafted layout (not procedurally generated)
- Level ends when the stickman crosses the **finish portal**

### Level Themes
1. **Green Zone** — sparse spikes, gentle intro, slow speed
2. **Lava Run** — tighter gaps, clusters, medium speed
3. **The Gauntlet** — ceiling + floor spike combos, fast speed, gaps

---

## Visuals

- **Style**: Flat neon on dark background (Geometry Dash aesthetic)
- Background: Solid dark color (`#1a1a2e`) with a parallax starfield (2 layers)
- Stickman: Bright neon white lines, circle head — simple and clean
  - Motion-blur ghost frames (3 semi-transparent copies) trail behind during a flip
  - On death: stickman ragdolls — limbs fly off in random directions with gravity
- Spikes: Contrasting accent color (e.g. hot pink or electric blue)
- Platforms: Same accent color as spikes, slightly muted
- Finish portal: Pulsing white/gold vertical gate

### HUD
- **Attempt counter** (top-left): "Attempt 4"
- **Progress bar** (top): Shows % of level completed
- **Best %** (top-right): Highest % reached this session

---

## Audio

- Background track: Looping chiptune/EDM beat (Web Audio API generated or a short audio file)
- Jump sound: Short whoosh (air displacement feel)
- Death sound: Glitchy crunch + splat, screen flash red
- Win sound: Ascending fanfare

> All audio should be generated via Web Audio API to avoid external file dependencies

---

## Game States

| State | Description |
|---|---|
| `menu` | Title screen, level select, instructions |
| `playing` | Active gameplay |
| `dead` | Brief death flash, "Attempt X" shown, auto-restart after 1s |
| `win` | "Level Complete" overlay with % and attempt count |
| `levelSelect` | Choose level 1–3 |

---

## Controls

| Input | Action |
|---|---|
| `Space` | Jump |
| `Click / Tap` | Jump |
| `R` | Restart current attempt |
| `Escape` | Return to menu |

---

## Physics

- **Gravity**: Constant downward acceleration (~1800 px/s²)
- **Jump velocity**: Fixed upward impulse (~700 px/s)
- **Scroll speed**: Varies by level (e.g. 300 / 400 / 550 px/s)
- **Collision**: AABB against the stickman's bounding box (torso region only — limbs pass through harmlessly) with a small inner margin (~4px) to forgive near-misses

---

## Scoring / Feedback

- No traditional score — completion % is the metric
- **Personal best** stored in `localStorage` per level
- Death shows "XX% — So close!" or "XX% — Try again!"
- Win shows final attempt count and a star rating:
  - 1 star: finished
  - 2 stars: finished in ≤ 10 attempts
  - 3 stars: finished in ≤ 3 attempts

---

## Technical

- **Single HTML file** (`index.html`)
- Canvas 2D for rendering
- `requestAnimationFrame` game loop with delta-time
- No external libraries or assets — fully self-contained
- Target 60 fps on modern browsers
- Mobile-friendly: touch events map to jump

---

## Stretch Goals (optional)

- Custom stickman color picker
- Speed multiplier toggle (0.5× practice mode)
- Coin collectibles hidden in levels
- Level editor (click to place/remove spikes)
- Online leaderboard via a simple API
