# Readability Explorer — Project Specification

## Overview

Readability Explorer is an interactive, single-page tool for exploring how typography and color choices affect text legibility. It provides real-time WCAG 2.1-compliant contrast analysis, RGB color controls, typographic sliders, and colorblindness simulation — all in one panel-based interface.

---

## Goals

- Help designers and developers understand the relationship between color, font size, and readability
- Make WCAG 2.1 contrast compliance visible and interactive
- Simulate how content appears to users with various types of color vision deficiency
- Provide an educational reference for accessibility standards

---

## Features

### Background Color Controls
- RGB sliders (R, G, B each 0–255) with color-coded tracks and thumbs
- Live color swatch preview
- Readonly hex value display (e.g. `#1a1a2e`)
- 12 preset swatches covering light, dark, warm, and cool backgrounds

### Text Color Controls
- Same RGB slider interface as background
- Independent swatch, hex display, and preset grid
- Presets include common text colors across multiple palettes

### Typography Controls
| Control | Range | Default |
|---|---|---|
| Font Size | 10–48px | 18px |
| Line Height | 1.0–3.0 | 1.60 |
| Letter Spacing | −0.05em to 0.30em | 0em |
| Max Width | 280–1100px | 680px |
| Font Family | 9 options | System UI |

Font family options: System UI, Georgia, Courier New, Comic Sans MS, Arial, Trebuchet MS, Verdana, Palatino, Impact

### Vision Simulation
Applies SVG `feColorMatrix` filters to the preview pane to simulate color vision deficiencies:

| Mode | Type | Prevalence |
|---|---|---|
| Normal Vision | No filter | — |
| Protanopia | Red cone absent | ~1% of males |
| Protanomaly | Red cone weakened | ~1% of males |
| Deuteranopia | Green cone absent | ~1% of males |
| Deuteranomaly | Green cone weakened | ~5% of males |
| Tritanopia | Blue cone absent | Rare |
| Tritanomaly | Blue cone weakened | Rare |
| Achromatopsia | No color (rod monochromacy) | Very rare |
| Achromatomaly | Blue cone monochromacy | Very rare |

Filters use `color-interpolation-filters="sRGB"` per SVG spec.

### Accessibility Metrics Panel
All calculations follow **WCAG 2.1 Success Criterion 1.4.3**.

**Contrast Ratio Card**
- Displays ratio to 2 decimal places (e.g. `4.87:1`)
- Context-aware WCAG badge (AAA / AA / AA Large / Fail) based on the **current font size**
- Text size tag showing current px and Large/Normal classification
- Logarithmic contrast bar (1:1 → 21:1 scale) with three tick marks at WCAG threshold positions:
  - 3.0:1 — AA Large text minimum
  - 4.5:1 — AA Normal / AAA Large minimum
  - 7.0:1 — AAA Normal minimum
- Explanatory text note stating the applicable thresholds for the current font size

**Four Reference Cards** (always shown regardless of font size)
| Card | Threshold | Applies To |
|---|---|---|
| AA · Normal text | ≥ 4.5:1 | Font size < 24px |
| AA · Large text | ≥ 3.0:1 | Font size ≥ 24px |
| AAA · Normal text | ≥ 7.0:1 | Font size < 24px |
| AAA · Large text | ≥ 4.5:1 | Font size ≥ 24px |

**Luminance Cards**
- Relative luminance for BG and FG (4 decimal places)
- Visual marker on a black-to-white gradient track showing position on the 0–1 luminance scale

### Preview Pane
Four sample content tabs:
- **Article** — Headings, body paragraphs, blockquote, bulleted list
- **UI Snippet** — Alert card, form input, button, caption text, info box
- **Code Block** — Monospaced code sample with WCAG math
- **Custom** — Editable `contenteditable` area for user-supplied text

All preview text responds live to all color and typography controls.

---

## WCAG 2.1 Implementation

### Relative Luminance (§1.4.3)
```
L = 0.2126 × R_lin + 0.7152 × G_lin + 0.0722 × B_lin
```
Where each channel is linearized from 8-bit sRGB:
```
C_sRGB = C_8bit / 255
C_lin  = C_sRGB / 12.92              if C_sRGB ≤ 0.04045
C_lin  = ((C_sRGB + 0.055) / 1.055) ^ 2.4   otherwise
```
Threshold used: **0.04045** (WCAG 2.1 corrected value, not the deprecated 0.03928).

### Contrast Ratio
```
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

### Large Text Definition (WCAG 2.1)
- ≥ 18pt (24px) at normal weight
- ≥ 14pt (~18.67px) at bold weight

The tool tracks font size only (not bold), so the 24px boundary is used as the large-text threshold.

---

## Technical Stack

- **Language:** Vanilla HTML / CSS / JavaScript — no dependencies, no build step
- **Color simulation:** Inline SVG `<filter>` with `feColorMatrix` elements
- **Vision filters:** Applied via CSS `filter: url(#id)` on the preview container
- **Layout:** CSS Grid (two-column: fixed 340px control panel + fluid preview)
- **Single file:** `index.html` — fully self-contained

---

## Architecture

```
index.html
├── <style>          — All CSS, CSS custom properties, media query
├── <svg defs>       — 8 feColorMatrix vision filters (invisible)
├── <header>         — Title bar
├── #controls        — Left panel (scrollable)
│   ├── Background Color section  (RGB sliders + presets)
│   ├── Text Color section        (RGB sliders + presets)
│   ├── Typography section        (range sliders + font select)
│   ├── Vision Simulation section (9 toggle buttons)
│   └── Accessibility Metrics section (contrast + luminance cards)
├── #preview         — Right panel
│   ├── .preview-toolbar  (tab buttons)
│   └── .preview-area     (4 tab content divs, vision filter target)
└── <script>
    ├── DATA         — HTML strings for tabs, preset color arrays
    ├── DOM REFS     — All element handles
    ├── INIT         — Inject tab HTML
    ├── COLOR UTILS  — hexToRgb, linSRGB, relativeLuminance, contrastRatio
    ├── STATE        — Single state object {bg, fg, fontSize, ...}
    ├── PRESETS      — buildPresets(), syncColorInputs(), highlightActivePreset()
    ├── SYNC         — rgbToHex(), syncColorInputs(), syncFromSliders()
    ├── UPDATE       — Main render function, called on every state change
    ├── LISTENERS    — RGB sliders, typography sliders, tabs, vision buttons
    └── INIT RENDER  — Initial update() call
```

### State Object
```js
{
  bg:            '#ffffff',   // background hex color
  fg:            '#000000',   // foreground/text hex color
  fontSize:      18,          // px
  lineHeight:    1.6,         // unitless multiplier
  letterSpacing: 0,           // em
  maxWidth:      680,         // px
  fontFamily:    '...'        // CSS font-family string
}
```

---

## File Structure

```
Readability-Explorer/
├── index.html    — Complete application
└── spec.md       — This document
```

---

## Open Questions / Future Enhancements

- **Bold weight toggle** — Would allow precise large-text classification at 14pt/18.67px for bold
- **Simulated contrast for vision filters** — Currently metrics show raw color contrast; perceived contrast under each CVD filter is not re-calculated
- **HSL / HSB color input modes** — Alternative to RGB sliders
- **Export / copy** — Copy color pair as CSS variables or design token
- **APCA contrast** — Alternative contrast algorithm (WCAG 3.0 candidate)
- **Side-by-side vision comparison** — Show Normal and filtered views simultaneously
