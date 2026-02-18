# Decision Neuron Chain - Spec

## Overview
An interactive single-page web app that demonstrates how artificial neurons make decisions using the sigmoid activation function. Built as a single `index.html` file with embedded CSS and JavaScript — no dependencies.

**Live URL:** https://aiml-1870-2026.github.io/Grunty/Sleep-Decision-Neuron/

---

## Feature 1: Multi-Scenario Neuron

The neuron is a general-purpose decision machine — not just for sleep decisions.

### Preset Scenarios
| Chip | Neuron 1 | Neuron 2 | Inputs |
|------|----------|----------|--------|
| Sleep / Breakfast | Sleep? | Eat Breakfast? | Wake time, people hanging, tiredness, prev sleep, class time, hunger |
| Choose a College | College? | Commit? | Reputation, campus vibe, financial aid, distance, parent approval, friend going |
| Adopt a Pet | Adopt? | Which Pet? | Free time, living space, allergy level, love for animals, vet budget, partner wants one |
| Road Trip? | Go? | Destination | Days available, car condition, budget, travel buddy, weather, excitement |
| Tech Upgrade | Upgrade? | Which One? | Device age, performance issues, budget, features wanted, brand loyalty, reviews |

### Behavior
- [x] Scenario preset bar with clickable chips at the top of the page
- [x] Applying a scenario updates: input labels, weights, biases, section titles, page title
- [x] Training data and boundary points clear on scenario switch
- [x] Weights reset to scenario defaults on Reset button
- [ ] "Create Your Own Scenario" custom panel (text fields for title, emoji, input names, weights)

---

## Feature 2: Decision Boundary Visualizer

See the "landscape" of the neuron's decision, not just a single point.

- [x] 2D heatmap using two inputs as X/Y axes
- [x] **Cool blue → white → magenta** color scheme (low confidence blue, decision edge white, high confidence magenta)
- [x] **Gold contour line** at the decision threshold (z = 0) with glow effect
- [x] **Gold crosshair dot** tracks current slider position; moving sliders moves the dot in real-time
- [x] Moving bias shifts the entire boundary line
- [x] Dropdown selectors to choose which two inputs map to X and Y axes
- [x] Neuron selector (Sleep or Breakfast)
- [x] Click-to-add labeled data points (Yes/No toggle)
- [x] Clicked points feed into training data automatically
- [x] Points count and accuracy display
- [x] Accuracy color-coded: green (>=80%), yellow (>=50%), red (<50%)

---

## Feature 3: Activation Function Showdown

Sigmoid is one of many — compare it to the step function and ReLU.

- [x] **Sigmoid** (classic) — smooth S-curve, outputs 0–1
- [x] **Step Function** (1958 perceptron) — binary 0 or 1 output
- [x] **ReLU** (modern deep learning) — unbounded positive, zero for negatives
- [x] Selector buttons with active state highlighting
- [x] Output rings, neuron colors, and math equation display update live for each function
- [x] Function curve plot with **moving marker** showing current z value and output
- [x] **Compare mode** toggle overlays all three curves on one canvas with labels
- [x] Info text describes each activation function

---

## Feature 4: Two-Neuron Chain

The smallest glimpse of a network — one neuron's output feeds into another.

- [x] Neuron 1 (Sleep) produces an intermediate output that feeds into Neuron 2 (Breakfast)
- [x] Neuron 2 adds its own inputs (Time Before Class, Hunger) plus its own bias
- [x] Animated chain synapse visualized with dashed bezier curve, thickness varies with signal strength
- [x] Math display shows both calculations: z1 → a1 → z2 → output
- [x] Chain bar shows sleep output percentage feeding into breakfast neuron
- [x] Weight badges on each input update live during training

---

## Feature 5: Sensitivity Analysis

See how much each input actually matters to the neuron's decision.

- [x] **Line chart** sweeping each input 0→1 while holding others fixed at their current slider values
- [x] Each input gets its own colored curve — steep = influential
- [x] **Vertical markers** show current slider values on each curve
- [x] Labels at right edge identify each curve
- [x] Neuron selector to switch between Sleep and Breakfast analysis
- [x] **Influence bar chart** ranks inputs by how much they swing the output (max - min range)
- [x] Bar chart updates live as sliders and weights change

---

## Training System

- [x] **Label buttons** for each neuron: "Yes, Sleep / No, Stay Up" and "Yes, Eat / No, Skip"
- [x] **Step button** — one gradient descent step across all labeled examples
- [x] **Train button** — 100 epochs with animated boundary movement (~50 visual frames)
- [x] **Reset button** — restores scenario default weights, clears all training data and boundary points
- [x] **SGD** with learning rate = 0.5, binary cross-entropy loss
- [x] Live stats in toolbar: Examples count, Epoch count, Loss, Accuracy
- [x] Weight badges update in real-time during training

---

## Themes

Four color themes, switchable via toolbar swatches:

| Theme | Primary | Accent |
|-------|---------|--------|
| Default | Purple `#6c5ce7` | Teal `#00ce9e` |
| Neon | Pink `#fd79a8` | Cyan `#00cec9` |
| Ocean | Blue `#0984e3` | Mint `#55efc4` |
| Ember | Orange `#e17055` | Gold `#fdcb6e` |

- [x] All CSS custom properties update on theme switch
- [x] Canvas visualizations re-render with new theme colors
- [x] Active swatch indicator

---

## Toast Pop-ups

Fun contextual messages triggered by slider extremes:

- [x] 20+ unique messages across tiredness, hunger, wake time, sleep deficit, class time
- [x] Combo triggers (e.g., tired + friends = "Your friends want you but your pillow NEEDS you")
- [x] Output triggers (e.g., >95% sleep = "The neuron has spoken. GO. TO. BED.")
- [x] 8-second cooldown per unique message to prevent spam
- [x] Slide-in/out animation, auto-dismiss after 4.5s
- [x] Color-coded left border: green (sleep), gold (breakfast), red (warning), purple (fun)

---

## Sigmoid Curve Probes

- [x] Two sigmoid curve canvases (Sleep and Breakfast) with hover-to-explore
- [x] Crosshair lines follow mouse position on the curve
- [x] Probe dot shows exact z → σ(z) mapping at hover position
- [x] Status bar shows probe values in monospace

---

## Technical Details

| Property | Value |
|----------|-------|
| File | Single `index.html` (~2500 lines) |
| Dependencies | None |
| Canvas DPR | Handled with logical dimension constants to prevent exponential scaling bug |
| Neuron math | z = Σ(wᵢ · xᵢ) + b, then activation(z) |
| Input normalization | All inputs normalized to [0, 1] range (some inverted for intuitive direction) |
| Training | Stochastic Gradient Descent, LR=0.5, Binary Cross-Entropy |
| Responsive | Flexbox layout, collapses to single column at <900px |

---

## Architecture

```
┌─────────────┐     ┌─────────────┐
│  Wake       │────→│             │     ┌──────────┐
│  Hang       │────→│  σ₁ Sleep   │────→│ p₁ (0-1) │──chain──┐
│  Tiredness  │────→│             │     └──────────┘         │
│  Prev Sleep │────→│  z₁ + b₁   │                          ▼
└─────────────┘     └─────────────┘              ┌─────────────┐     ┌──────────┐
                                                 │  σ₂ Bfast   │────→│ p₂ (0-1) │
                    ┌─────────────┐              │             │     └──────────┘
                    │  Class Time │─────────────→│  z₂ + b₂   │
                    │  Hunger     │─────────────→│             │
                    └─────────────┘              └─────────────┘
```
