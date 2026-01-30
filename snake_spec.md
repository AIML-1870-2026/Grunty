# Snake Game Specification

## Overview
A classic Snake game implementation where the player controls a snake that grows longer as it consumes food while avoiding collisions with walls and itself.

## Game Objectives
- Control the snake to eat food items
- Grow the snake's length with each food consumed
- Achieve the highest possible score
- Avoid collisions with walls and the snake's own body

## Core Gameplay Mechanics

### Snake Movement
- The snake moves continuously in its current direction
- Movement is grid-based (discrete cells)
- The snake moves one cell per game tick
- Direction can be changed using arrow keys or WASD
- The snake cannot reverse direction (e.g., cannot go directly from right to left)

### Snake Growth
- Initial snake length: 3-5 segments
- Each food item consumed adds one segment to the tail
- The snake's head always leads movement
- Body segments follow the head's path

### Food System
- One food item appears on the grid at a time
- Food spawns at random unoccupied positions
- New food appears immediately after consumption
- Each food item is worth a fixed number of points (e.g., 10 points)

### Collision Detection
- Game ends if snake collides with:
  - Any wall boundary
  - Its own body segments
- Head position is checked each frame for collisions

## Game Configuration

### Grid/Playing Field
- Recommended size: 20x20 to 30x30 cells
- Fixed boundaries (walls on all sides)
- Cell-based coordinate system

### Difficulty Settings
Multiple difficulty levels that adjust game speed:
- **Easy**: 8-10 frames per second
- **Medium**: 12-15 frames per second
- **Hard**: 18-20 frames per second
- **Expert**: 25+ frames per second

### Scoring System
- Points per food item: 10 points
- Optional: Bonus points for consecutive eating without turning
- Optional: Multiplier based on current snake length
- Display current score and high score

## User Interface Requirements

### Game Screen
- Grid display with visible boundaries
- Snake rendered distinctly from background
- Food item rendered with clear visibility
- Score display (current and high score)
- Optional: Current level/difficulty indicator

### Controls
- **Arrow Keys** or **WASD**: Change snake direction
  - Up/W: Move up
  - Down/S: Move down
  - Left/A: Move left
  - Right/D: Move right
- **Space** or **P**: Pause/unpause game
- **Enter** or **R**: Restart game after game over
- **Esc**: Return to main menu

### Menu System
- **Main Menu**:
  - Start Game
  - Select Difficulty
  - View High Scores
  - Exit
- **Pause Menu**:
  - Resume
  - Restart
  - Main Menu
- **Game Over Screen**:
  - Final score display
  - High score notification (if achieved)
  - Restart option
  - Main Menu option

## Technical Requirements

### Performance
- Consistent frame rate based on difficulty level
- Smooth snake movement without stuttering
- Responsive input handling (no input lag)

### Data Persistence
- Save and load high scores
- Optional: Save difficulty preference
- Optional: Game state saving for pause/resume

### Visual Design
- Clear contrast between snake, food, and background
- Smooth animations for snake movement
- Visual feedback for food consumption
- Game over animation/effect

### Audio (Optional)
- Background music
- Sound effect for eating food
- Sound effect for game over
- Sound effect for menu navigation

## Game States

1. **Main Menu**: Initial state, displays options
2. **Playing**: Active gameplay state
3. **Paused**: Game frozen, can resume or quit
4. **Game Over**: Snake has collided, display final score
5. **High Score Entry**: If player achieved high score

## Edge Cases & Special Conditions

### Food Spawning
- Ensure food never spawns on snake's body
- Handle scenario when grid is nearly full (rare with large grids)

### Input Buffering
- Buffer one directional input to handle rapid key presses
- Prevent multiple direction changes within single frame

### Wall Wrapping (Optional Variant)
- Alternative mode: Snake wraps to opposite side when hitting walls
- Requires separate collision detection logic

## Future Enhancements (Optional)

### Power-ups
- Speed boost (temporary faster movement)
- Slow-mo (temporary slower movement)
- Score multiplier
- Invincibility (temporary)

### Obstacles
- Static obstacles placed on grid
- Moving obstacles

### Multiplayer
- Two-player competitive mode
- Shared grid, separate snakes
- First to crash loses

### Advanced Scoring
- Combo system for quick successive eating
- Time-based scoring
- Length-based multipliers

## Testing Considerations

- Verify collision detection accuracy at all grid boundaries
- Test direction change restrictions
- Validate score calculation
- Test food spawning randomization and collision avoidance
- Verify game state transitions
- Test input responsiveness across different frame rates
- Validate high score persistence

## Success Criteria

A successful implementation should:
- Provide smooth, responsive gameplay
- Accurately detect all collision scenarios
- Maintain consistent game speed at chosen difficulty
- Display score and game state clearly
- Handle edge cases gracefully
- Provide an engaging user experience

---

**Version**: 1.0  
**Last Updated**: January 29, 2026
