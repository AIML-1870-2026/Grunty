# Blackjack — Project Specification

## Overview

A single-file browser-based Blackjack game built for the AIML 1870 portfolio. Implements standard Vegas-style rules with cryptographically secure shuffling, animated card dealing, winning particle effects, and responsible gambling safeguards.

---

## Goals

- Deliver a fully playable Blackjack game in a single `index.html` file
- Use cryptographically secure RNG (Web Crypto API) for provably fair shuffling
- Animate the deal, dealer reveal, and win events for a polished experience
- Meet responsible gambling and regulatory disclosure requirements

## Non-Goals

- No server-side logic or real-money transactions
- No user accounts, login, or persistent data beyond the current session
- No mobile-native packaging (web only)

---

## Background & Context

Created as an AIML 1870 portfolio assignment. Demonstrates front-end game development skills including: secure randomness, CSS animation choreography, canvas-based particle systems, and ethical design for gambling-adjacent entertainment software.

---

## Requirements

### Functional Requirements

- **Deck**: 6-deck shoe; reshuffles when fewer than 52 cards remain
- **Betting**: No upper limit; minimum bet $1; starting balance $1,000
- **Actions**: Hit, Stand, Double Down, Split (up to 4 hands), Insurance
- **Split Aces**: Auto-stand after one card each; no Blackjack credit on split
- **Dealer**: Hits on soft 17; hole card flipped with animation before dealer plays
- **Payouts**: Blackjack pays 3:2; insurance pays 2:1; push returns bet
- **Dealing animation**: 4 cards dealt sequentially with 180 ms delays
- **Post-deal animation**: Score pop + hand glow + button cascade after deal
- **Dealer animation**: Hole-card flip, then extra cards revealed 600 ms apart
- **Win particles**: 90 confetti pieces on win; 160 on Blackjack
- **Responsible gambling**: Session timer, loss limit modal, 30-minute break overlay
- **Regulatory disclosures**: "For Entertainment Only", 18+, RTP ~99.5%, house edge ~0.5%

### Non-Functional Requirements

- Single HTML file (no external dependencies)
- Content Security Policy: `default-src 'none'`
- `safeCall()` error wrapper around all game actions
- No PII in code or comments

---

## Design & Architecture

### Tech Stack

| Layer | Approach |
|---|---|
| Structure | Semantic HTML5 |
| Styling | Inline `<style>` with CSS custom properties and `@keyframes` |
| Logic | Vanilla ES6+ JS in a single `<script>` block |
| RNG | `crypto.getRandomValues` with rejection-sampling Fisher-Yates; `Math.random` fallback |
| Particles | Fixed-position `<canvas>` with `requestAnimationFrame` loop |

### State Model

```
balance, bet, deck[], playerHands[], activeIdx, dealerCards[]
inRound, isDealing, animateHints{}, revealingHole
sessionStart, sessionLosses, lossLimit, lastBreakPrompt
particles[], animFrameId
```

### Animation Pipeline

```
deal() → dealSequential()
           └─ 4× setTimeout(180ms) → render() per card
           └─ post-deal: score-pop + hand-glow + btn-appear

stand() / bust → revealAndFinish()
                  └─ flip hole card (revealingHole flag)
                  └─ runDealerAnimation(extraCards[])
                       └─ N× setTimeout(600ms) → render() per card
                       └─ resolveOutcome()
                            └─ balance update, session stats
                            └─ launchWinParticles() if won
                                 └─ tickParticles() rAF loop
```

### CSS Animations

| Name | Trigger | Description |
|---|---|---|
| `deal-from-top` | Player cards on deal | Slides in from above |
| `deal-from-bottom` | Dealer cards on deal | Slides in from below |
| `hole-flip` | Dealer hole card reveal | 3D Y-axis flip |
| `score-pop` | Score badge after deal | Scale + fade in |
| `btn-appear` | Action buttons after deal | Staggered slide-up |
| `hand-glow` | Active hand indicator | Pulsing box-shadow |

---

## Responsible Gambling Features

| Feature | Behavior |
|---|---|
| Session timer | Displays elapsed time; shown in stats bar |
| Loss limit | User sets a limit; modal fires when hit |
| Break overlay | Triggers at 30 min; 30-second countdown before dismissal |
| Helpline footer | 1-800-522-4700 (National Problem Gambling Helpline) |
| 18+ notice | Displayed in regulatory footer |
| "For Entertainment Only" | Prominent label; no real-money implication |

---

## Implementation Plan

| Step | Description | Status |
|------|-------------|--------|
| 1 | Core game logic: deck, hand value, actions | Done |
| 2 | Fair RNG: Web Crypto API + Fisher-Yates | Done |
| 3 | Responsible gambling: session timer, loss limit, breaks | Done |
| 4 | Regulatory disclosures and CSP | Done |
| 5 | Remove betting limit ceiling | Done |
| 6 | Dealing animation (sequential 4-card deal) | Done |
| 7 | Post-deal animations (score, buttons, glow) | Done |
| 8 | Dealer reveal animation (hole flip + sequential draw) | Done |
| 9 | Winning particle effect (canvas confetti) | Done |
| 10 | Spec documentation | Done |

---

## Open Questions

- [ ] Add sound effects for card deal, win, lose?
- [ ] Persist balance across page refreshes via `localStorage`?
- [ ] Add a shoe burn card indicator / true count display?

---

## Out of Scope

- Real-money wagering or payment processing
- Multiplayer or network play
- Native mobile app packaging
- Side bets (Perfect Pairs, 21+3, etc.)

---

## Live URL

```
https://aiml-1870-2026.github.io/Grunty/Blackjack/
```

---

## References

- [Wizard of Odds — Blackjack Basic Strategy](https://wizardofodds.com/games/blackjack/)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
- [NCPG Helpline](https://www.ncpgambling.org/help-treatment/national-helpline/)
- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
