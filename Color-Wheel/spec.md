# Color Wheel — Project Spec

## Overview

A single-file interactive color theory tool built with vanilla HTML/CSS/JS and the HTML5 Canvas API. No external dependencies. Designed to fit entirely within one viewport without scrolling.

**File:** `Color-Wheel/index.html`

---

## Layout

Three-column grid (`290px | 248px | 1fr`) inside a fixed `100vh` container:

| Column | Contents |
|---|---|
| Left | Petal Wheel canvas + color swatches |
| Center | Controls panel |
| Right | Tabbed panel (Blend / Contrast / Colorblind / Accessible) |

Header bar (42px) sits above the 3-column area.

---

## Features

### 1. Petal Color Wheel

- **Canvas size:** 278×278px (plus a transparent overlay canvas)
- Each ring is drawn as N bezier-curve petals using `moveTo` + `bezierCurveTo` for symmetric petal shapes
- Multiple rings with increasing petal count per ring (`36 + r×12`)
- Lightness varies across rings (inner = darker, outer = lighter)
- Overlay canvas draws harmony dots with radial glows and dashed connectors between them

### 2. Color Harmony Modes

Eight modes selectable via dropdown:

| Mode | Description |
|---|---|
| Complementary | Base + opposite (180°) |
| Analogous | Base + ±30° neighbors |
| Triadic | Base + 120° + 240° |
| Tetradic | Base + 60° + 120° + 180° |
| Split-Complementary | Base + 150° + 210° |
| Square | Base + 90° + 180° + 270° |
| Monochromatic | Base hue at multiple lightness levels |
| Custom | User-defined angle offset |

### 3. Controls Panel (Center Column)

- **Base Hue** slider (0–360°) with live hex preview
- **Saturation** slider (0–100%)
- **Lightness** slider (0–100%)
- **Harmony Mode** dropdown
- **Rings** slider (1–6 rings on the wheel)
- **Angle** slider — custom angle offset (visible in Custom mode)
- **Color swatches** displayed below the wheel for the current palette

### 4. Blend Canvas (Tab 1)

An interactive canvas where palette colors appear as soft radial gradient blobs layered with canvas composite operations.

#### Blob Rendering

- Each blob is a radial gradient with a flat-then-fade profile:
  - `0% → 35%`: fully opaque (solid core)
  - `35% → 72%`: fades to 45% opacity
  - `72% → 100%`: fades to transparent
- First blob uses `source-over`; subsequent blobs use the selected blend mode
- Custom extra blobs always use the current blend mode

#### Blend Controls

| Control | Range | Default |
|---|---|---|
| Blend Mode | 14 canvas composite ops | `normal` |
| Opacity | 0–1 | 0.88 |
| Blob Size | 0–1 | 0.75 |
| R / G / B Multipliers | 0–2 | 1.0 each |
| Animate toggle | on/off | off |

**14 available blend modes:** normal, screen, multiply, overlay, hard-light, soft-light, color-dodge, color-burn, difference, exclusion, hue, luminosity, saturation, color

#### Draggable Blobs

- Each palette color blob has a drag handle (white border circle with crosshair)
- Custom extra blobs have purple-border handles (`#ddaaff`)
- **Click + drag** any handle to reposition the blob
- **Double-click** blank area of blend canvas to reset palette blob positions to default orbit
- Hit radius for selection: `Math.min(W,H) × 0.09`
- Default orbit radius: `Math.min(W,H) × 0.13`
- When Animate is ON, palette blob positions are overwritten each frame by orbital motion; dragging is disabled during animation

#### Extra Blobs

- **+ Add Blob** button appends a custom blob with a freely choosable hue
- Each extra blob row shows: color swatch, rainbow hue slider (0–360°), × remove button
- Extra blobs participate in blending and can be dragged on the canvas

#### Blended Color Readout

Center pixel of the blend canvas is sampled via `getImageData` and displayed as a hex color swatch labeled "Blended."

---

### 5. Contrast Checker (Tab 2)

- Calculates WCAG 2.1 relative luminance using the IEC 61966-2-1 linearization formula
- Contrast ratio = `(L1 + 0.05) / (L2 + 0.05)` where L1 > L2
- Shows each palette color vs white and vs black
- Shows all pairwise combinations as text-on-background preview cards
- Pass/fail badges for WCAG AA (4.5:1 normal text) and AAA (7:1)

---

### 6. Colorblind Simulator (Tab 3)

Simulates four vision deficiency types using Vienot 1999 sRGB approximate matrices applied to each palette color:

| Type | Description |
|---|---|
| Normal | No simulation |
| Protanopia | Red-blind (L-cone absent) |
| Deuteranopia | Green-blind (M-cone absent) |
| Tritanopia | Blue-blind (S-cone absent) |
| Achromatopsia | Complete color blindness (luminance only: `L = 0.299R + 0.587G + 0.114B`) |

The simulation matrices (Vienot 1999):

```
Protanopia:   [[0.56667, 0.43333, 0], [0.55833, 0.44167, 0], [0, 0.24167, 0.75833]]
Deuteranopia: [[0.625,   0.375,   0], [0.7,     0.3,     0], [0, 0.3,     0.7    ]]
Tritanopia:   [[0.95,    0.05,    0], [0,       0.43333, 0.56667], [0, 0.475, 0.525]]
```

---

### 7. Accessible Palette (Tab 4)

For each palette color, finds WCAG AA-compliant variants (4.5:1 contrast ratio) using binary search on lightness:

- **On Dark**: finds minimum lightness that achieves 4.5:1 on black background
- **On Light**: finds maximum lightness that achieves 4.5:1 on white background
- If the original color already passes, a checkmark is shown
- Shows original vs accessible swatches side by side with hex values

---

## State Variables

```js
let baseHue = 0;          // 0–360
let sat = 100;            // 0–100
let lit = 50;             // 0–100
let mode = 'complementary';
let rings = 3;            // 1–6
let angle = 30;           // custom angle offset

let blendMode = 'normal';
let blendOpacity = 0.88;
let blendBlobSize = 0.75;
let blendAnimating = false;
let blendAngle = 0;
let blendAnimId = null;

let rgbMult = [1, 1, 1];  // R, G, B channel multipliers
let cbType = 'normal';     // colorblind simulation type
let activeTab = 'blend';

let blobPositions = [];    // [{x, y}] — one per palette color
let customBlobs = [];      // [{h, s, l, x, y}] — free extra blobs
let blobDrag = { active: false, source: 'palette', index: -1, ox: 0, oy: 0 };
let hoveredBlob = null;    // null | {source, index}
```

---

## Key Functions

| Function | Purpose |
|---|---|
| `drawPetalRing(innerR, outerR, lightness, n)` | Draws N bezier-curve petals for one ring |
| `drawWheel()` | Renders all rings of the petal wheel |
| `getHarmonyHues(base)` | Returns array of hue angles for current mode |
| `drawOverlay()` | Draws harmony dots + glow + dashed connectors |
| `getPaletteColors()` | Returns `[{h, s, l, rgb, hex}]` for current palette |
| `drawBlend()` | Renders radial gradient blobs with composite ops |
| `hitBlob(x, y)` | Returns `{source, index}` or `null` for click position |
| `blobPos(hit)` | Reads `{x, y}` from correct array (palette or custom) |
| `setBlobPos(hit, x, y)` | Writes position to correct array |
| `defaultBlobPositions(n)` | Returns orbit positions for N blobs |
| `addCustomBlob(h?)` | Adds a new custom blob |
| `removeCustomBlob(i)` | Removes custom blob at index i |
| `rebuildFreeBlobsUI()` | Re-renders the extra blobs UI list |
| `buildContrastPanel()` | Renders WCAG contrast checker cards |
| `buildCBPanel()` | Renders colorblind simulation swatches |
| `buildAccessiblePanel()` | Renders accessible palette variants |
| `findLightnessOnDark(h, s)` | Binary search: min L for 4.5:1 on black |
| `findLightnessOnLight(h, s)` | Binary search: max L for 4.5:1 on white |
| `luminance(r, g, b)` | WCAG relative luminance |
| `contrastRatio(rgb1, rgb2)` | WCAG contrast ratio |
| `simulateCB(rgb, type)` | Applies colorblind simulation matrix |
| `resizeBlendCanvas()` | Syncs canvas pixel size to CSS layout size |

---

## Interactions

| Interaction | Effect |
|---|---|
| Drag blob handle | Move blob on blend canvas |
| Double-click blend canvas | Reset palette blob positions to default orbit |
| Animate toggle | Orbital animation of palette blobs |
| + Add Blob | Append extra custom blob |
| Hue slider on extra blob | Change that blob's color |
| × button on extra blob | Remove that blob |
| Blend Mode dropdown | Change canvas composite operation |
| Tab clicks | Switch between Blend / Contrast / Colorblind / Accessible |
| Colorblind type selector | Re-simulate palette for selected vision type |

---

## Technical Notes

- **Single file**: All HTML, CSS, and JS in `index.html`
- **No dependencies**: Pure browser APIs only
- **Canvas sizing**: `resizeBlendCanvas()` sets `canvas.width = canvas.offsetWidth` to match layout; called on window resize and on tab switch to blend
- **Overflow prevention**: `body { height: 100vh; overflow: hidden }` with `min-height: 0` on all flex/grid children
- **Tab panels**: `position: absolute; inset: 0` inside a `position: relative` container; active tab removes `hidden` class
- **Petal shape**: Each petal uses two cubic bezier curves meeting at a tip point, symmetric about the radial axis
