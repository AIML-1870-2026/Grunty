# Snake 2 - Ultimate Edition

A fully customizable Snake game with multiplayer support and multiple fruit types.

## Play Now

[Play Snake 2](https://aiml-1870-2026.github.io/Grunty/snake-2/)

## Features

### Customization Options

| Setting | Options |
|---------|---------|
| Snake Color | Full color picker for each player |
| Snake Shape | Square, Circle, Triangle, Diamond |
| Game Speed | Slow, Medium, Fast, Insane |
| Field Size | Small (15x15), Medium (20x20), Large (25x25), Huge (30x30) |
| Game Mode | Single Player, Multiplayer (2 Players) |

### Fruit Types

| Fruit | Points | Spawn Rate | Description |
|-------|--------|------------|-------------|
| Apple | 1 | 50% | Common red fruit |
| Orange | 2 | 25% | Citrus bonus |
| Grape | 3 | 15% | Purple cluster |
| Golden | 5 | 8% | Rare golden fruit |
| Rainbow | 10 | 2% | Ultra-rare rainbow fruit |

The snake grows by the number of points the fruit is worth (e.g., eating a Golden fruit adds 5 segments).

## Controls

### Player 1
- **Arrow Up** - Move up
- **Arrow Down** - Move down
- **Arrow Left** - Move left
- **Arrow Right** - Move right

### Player 2 (Multiplayer Mode)
- **W** - Move up
- **S** - Move down
- **A** - Move left
- **D** - Move right

### General
- **Space** - Pause/Resume game

## Gameplay

1. Select your preferred settings from the main menu
2. Click "Start Game" to begin
3. Control your snake to collect fruits
4. Avoid hitting walls, yourself, or the other player (in multiplayer)
5. Higher value fruits are rarer but give more points and growth

## Multiplayer Mode

In 2-player mode:
- Player 1 starts on the left side (green by default)
- Player 2 starts on the right side (red by default)
- First player to crash loses
- Colliding with the other snake counts as a crash

## Technical Details

- Built with vanilla HTML5, CSS3, and JavaScript
- Uses HTML5 Canvas for rendering
- No external dependencies
- Single file architecture

## Author

Created for AIML 1870 - Grunty's Portfolio
