# ITO Mock Design Implementation Guide

## Overview

This guide provides complete instructions for implementing the Artifact-inspired ITO game UI design and the innovative "waiting area to submitted area" card flow system. The implementation transforms the current web-app style interface into an immersive, AAA card game experience.

## 🎯 **Reference Mock Implementation**

**IMPORTANT**: The complete working mock implementation is located at:
`C:\Users\hr-hm\Desktop\codex\artifact-style-mock.html`

This HTML file contains:
- ✅ Complete Artifact-inspired visual design
- ✅ Full card flow system implementation (waiting → submitted → judgment)
- ✅ All CSS animations and transitions
- ✅ Artifact-style result presentations
- ✅ JavaScript functionality for card movement and judgment sequences
- ✅ Mobile-responsive design
- ✅ Complete interaction patterns

**📋 Key Features Demonstrated in Mock:**
1. **Wood grain background** with realistic lighting
2. **Purple mystical cards** with golden borders and accents  
3. **Waiting area system** - participants cards at bottom with thinking animations
4. **Word input and submission** - cards animate from bottom to top
5. **Confirmation button** - appears when all players submitted
6. **Judgment sequence** - left-to-right card flipping with color feedback
7. **Artifact-style results** - cosmic overlay with sacred geometry
8. **Minimal chat system** - floating toggle in bottom-right corner
9. **Corner player indicators** - replacing traditional sidebar
10. **Boundary-less immersive layout**

**🔍 How to Use This Mock:**
- Open the HTML file in browser to see full working system
- Try inputting words and clicking "提出" to see card movement
- All placeholder cards will animate from waiting area to submitted area
- Click "確定！順番を発表" button to see judgment sequence
- Experience the full Artifact-style "VICTORY" or "DEFEAT" results

**⚠️ Implementation Priority:**
ALL visual design, animations, and interaction patterns should match this mock implementation exactly. The mock serves as the definitive specification for the desired end result.

**🔧 Key CSS/JavaScript Snippets from Mock:**
The mock contains over 1,400 lines of production-ready code including:
- Complete wood grain SVG background patterns
- Purple card gradients with golden borders
- Smooth card movement animations (`transform: translateY(100px)` → `translateY(0)`)
- Flip animations using `rotateY()` transforms
- Artifact-style cosmic result overlays with rotating sacred geometry
- Mobile-responsive breakpoints
- Complete JavaScript state management for card flow

**📚 Extract Implementation Patterns From:**
```bash
# View the complete mock implementation:
cat C:\Users\hr-hm\Desktop\codex\artifact-style-mock.html
```

This 1,400+ line file contains all the CSS classes, animations, and JavaScript functions needed for the complete implementation.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Design Philosophy](#design-philosophy)  
3. [Core Components to Modify](#core-components-to-modify)
4. [New Card Flow System](#new-card-flow-system)
5. [Visual Design Implementation](#visual-design-implementation)
6. [Artifact-Style Result Animations](#artifact-style-result-animations)
7. [Implementation Steps](#implementation-steps)
8. [Testing Requirements](#testing-requirements)

## Current State Analysis

The current ITO implementation uses a traditional web application layout:

### Current File Structure & Implementation
- `components/CentralCardBoard.tsx` - Main game area with drop zones and card rendering
  - Uses DndKit for sort-submit mode
  - Has OrderList/proposal system for card placement
  - Includes GameResultOverlay for basic success/failure
- `components/Hud.tsx` - Top control panel with phase indicators and host controls
  - Shows room name, phase status, player counts
  - Contains host primary action buttons
- `components/PlayerList.tsx` - Sidebar player list (currently hidden on mobile)
- `components/ChatPanel.tsx` - Chat functionality 
- `components/ui/GameCard.tsx` - Individual card component
  - Has flip variant for sort-submit reveal animations
  - Supports different states: default/success/fail
  - Responsive with container queries
- `components/ui/GameLayout.tsx` - CSS Grid-based layout structure
  - Uses 125% DPI optimizations
  - Grid areas: header/sidebar/main-area/chat/hand
  - Currently uses sidebar-based layout
- `theme/` - Chakra UI theme system (light mode only since 2025-08-27)

### Current Game Flow
1. **Input Phase**: Players enter clues, cards are individually dropped into CentralCardBoard
2. **Sort Phase** (sort-submit): Players collaboratively arrange order using drag-and-drop
3. **Reveal Phase**: Cards flip to reveal numbers with success/fail states
4. **Results**: Basic overlay showing success or failure

### Current Issues to Address
1. **Compartmentalized Layout**: Traditional sidebar/footer boundaries break immersion
2. **Unclear Game Progress**: No visual indication of who has/hasn't submitted clues
3. **Linear Card Flow**: Cards appear in play area immediately, no progression staging
4. **Generic Results**: Simple success/failure overlay lacks drama
5. **Web-app Feel**: Grid layout feels like administrative interface
6. **Separated Controls**: Input controls in separate Hud component, disconnected from game flow

## Design Philosophy

### Inspiration: Artifact Card Game
- **Physical Table Aesthetic**: Wood grain background, realistic lighting
- **Mystical Card Design**: Purple gradients with golden accents
- **Boundary-less Layout**: No rigid separations, immersive experience
- **Minimal Player Info**: Corner indicators instead of full lists
- **Dramatic Results**: Cinematic success/failure animations

### Key Principles
1. **Immersion Over Information**: Show only what's necessary
2. **Physical Metaphors**: Cards "move" from waiting area to play area
3. **Clear State Communication**: Visual progression from waiting → submitted → judged
4. **Cinematic Moments**: Dramatic card reveals and result presentations

## Core Components to Modify

### 1. GameLayout.tsx - Complete Redesign

**Current Structure:**
```
[Header]
[Sidebar] [Central] [Chat]
[Footer Controls]
```

**New Structure:**
```
[Minimal Header with embedded info]
[Player Indicators in corners]
[Full-width Central Area]
[Waiting Area - participants not yet submitted]
[Bottom Controls with word input]
[Minimal Chat - bottom right corner]
```

### 2. CentralCardBoard.tsx - Card Flow System

**New Features to Add:**
- Submitted cards display area (top)
- Waiting cards display area (bottom) 
- Smooth animation between states
- Card flip animations for number reveal
- Color-coded result feedback (green/red borders)

### 3. Visual Theme Overhaul

**Background System:**
- Replace current backgrounds with wood grain texture
- Add realistic lighting effects
- Remove all rigid borders and separations

**Card Styling:**
- Purple mystical gradient backgrounds
- Golden accent colors and borders
- Enhanced shadows and depth
- Flip animation capabilities

## New Card Flow System

### Flow States

#### 1. Initial State
```
Top Area: [Empty placeholders for submitted cards]
Bottom Area: [All participant cards in "thinking" state]
```

#### 2. Submission Process  
```
User inputs word → Clicks submit → Card animates from bottom to top
```

#### 3. All Submitted State
```
Top Area: [All submitted cards with connection words, numbers hidden]
Bottom Area: [Empty or hidden]
Center: ["Confirm! Reveal Order" button appears]
```

#### 4. Judgment Phase
```
Cards flip one by one (left to right):
- Flip animation reveals number
- Border changes color (green=correct, red=incorrect) 
- Once sequence breaks, all remaining cards are red
```

#### 5. Final Result
```
Artifact-style fullscreen overlay:
- SUCCESS: Golden geometry, "VICTORY" text
- FAILURE: Red effects, "DEFEAT" text  
```

### Technical Implementation

#### Current State Structure (to be enhanced)
The current implementation uses:
- `orderList: string[]` - Final card placement order
- `proposal: string[]` - Draft order for sort-submit mode  
- `players: PlayerDoc[]` - Player data with clues and numbers
- `roomStatus: string` - Current game phase
- `resolveMode: string` - "sequential" or "sort-submit"

#### New State Management (to be added)
```typescript
interface CardFlowState {
  waitingPlayers: Player[]; // Players who haven't submitted clues
  submittedCards: SubmittedCard[]; // Cards in play area
  gamePhase: 'input' | 'all-submitted' | 'revealing' | 'complete';
  revealIndex: number; // Current card being revealed
  canConfirm: boolean; // All players have submitted
}

interface SubmittedCard {
  player: Player;
  word: string;
  number: number;
  position: number; // Display order
  state: 'hidden' | 'revealing' | 'correct' | 'incorrect';
  animationState: 'waiting' | 'moving' | 'placed'; // For animations
}

// Enhance existing PlayerDoc interface
interface PlayerDocEnhanced extends PlayerDoc {
  clueSubmitted: boolean; // New: has this player submitted their clue?
  clueTimestamp?: number; // New: when did they submit?
}
```

#### Animation Sequences
```typescript
// Card submission animation
const submitCard = async (word: string) => {
  // 1. Create new card in bottom area
  // 2. Animate upward to top area
  // 3. Remove from waiting area
  // 4. Check if all submitted → show confirm button
};

// Judgment sequence
const startJudgment = async () => {
  for (let i = 0; i < cards.length; i++) {
    await flipCard(cards[i]);
    await evaluateCard(cards[i], previousNumber);
    await pause(1500); // Dramatic timing
  }
  await showFinalResult();
};
```

## Visual Design Implementation

### Background System

```css
body {
  background: 
    radial-gradient(ellipse at center, rgba(139, 115, 85, 0.6) 30%, rgba(101, 67, 33, 0.8) 70%),
    linear-gradient(45deg, 
      rgba(101, 67, 33, 0.15) 0%, 
      rgba(139, 115, 85, 0.2) 25%, 
      rgba(160, 133, 91, 0.15) 50%, 
      rgba(139, 115, 85, 0.2) 75%, 
      rgba(101, 67, 33, 0.15) 100%
    ),
    url('wood-grain-pattern.svg');
  background-size: 1200px 240px;
  box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.3);
}
```

### Card Styling

```css
/* Mystical Card Design */
.game-card {
  background: linear-gradient(135deg,
    rgba(30, 15, 50, 0.95) 0%,
    rgba(50, 25, 80, 0.95) 30%,
    rgba(70, 35, 110, 0.95) 70%,
    rgba(30, 15, 50, 0.95) 100%);
  border: 3px solid rgba(255, 215, 0, 0.8);
  border-radius: 15px;
  box-shadow: 
    0 8px 25px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(255, 215, 0, 0.3),
    inset 0 2px 0 rgba(255, 215, 0, 0.4);
}

/* Waiting State */
.game-card.waiting {
  background: linear-gradient(135deg,
    rgba(60, 30, 90, 0.8) 0%,
    rgba(80, 40, 120, 0.8) 100%);
  border: 2px solid rgba(147, 112, 219, 0.6);
  animation: waitingPulse 2s ease-in-out infinite alternate;
}

/* Result States */
.game-card.correct {
  border-color: rgba(76, 175, 80, 1) !important;
  box-shadow: 0 0 30px rgba(76, 175, 80, 0.6);
  animation: correctPulse 1s ease-in-out;
}

.game-card.incorrect {
  border-color: rgba(244, 67, 54, 1) !important;
  box-shadow: 0 0 30px rgba(244, 67, 54, 0.6);
  animation: incorrectShake 0.8s ease-in-out;
}
```

### Layout Structure

```css
/* Remove all boundaries */
.game-layout {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
}

/* Header - embedded info */
.game-header {
  background: linear-gradient(180deg, 
    rgba(101, 67, 33, 0.9) 0%, 
    rgba(101, 67, 33, 0.3) 100%);
  backdrop-filter: blur(15px);
  border: none;
}

/* Player indicators in corners */
.player-indicator {
  position: fixed;
  background: linear-gradient(135deg,
    rgba(101, 67, 33, 0.9),
    rgba(139, 115, 85, 0.9));
  border: 2px solid rgba(160, 133, 91, 0.7);
  border-radius: 15px;
  backdrop-filter: blur(15px);
  z-index: 15;
}

/* Minimal chat - bottom right */
.minimal-chat {
  position: fixed;
  bottom: 120px;
  right: 20px;
  z-index: 20;
}
```

## Artifact-Style Result Animations

### Fullscreen Result Overlay

```css
.final-result {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 800px;
  height: 600px;
  background: radial-gradient(ellipse at center, 
    rgba(26, 13, 40, 0.98) 0%,
    rgba(12, 6, 20, 1) 100%);
  transform: translate(-50%, -50%) scale(0);
  z-index: 1000;
}

/* Star field background */
.final-result::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background: 
    radial-gradient(2px 2px at 100px 50px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1px 1px at 200px 120px, rgba(255, 255, 255, 0.6), transparent),
    /* ... more stars */;
  animation: starTwinkle 4s ease-in-out infinite alternate;
}

/* Sacred geometry */
.sacred-geometry {
  width: 200px;
  height: 200px;
  border: 2px solid rgba(255, 215, 0, 0.8);
  animation: geometryAppear 2s ease-out 0.5s forwards;
}

/* Typography */
.result-title {
  font-family: 'Cinzel', serif;
  font-size: 72px;
  font-weight: 300;
  letter-spacing: 12px;
  animation: successTextAppear 2s ease-out 1s forwards;
}
```

### Animation Sequences

```typescript
// Result presentation sequence
const showFinalResult = async (success: boolean) => {
  // 1. Fade to space background (1s)
  await showOverlay();
  
  // 2. Stars appear and twinkle (0.5s)
  await showStars();
  
  // 3. Sacred geometry spins in (2s from 0.5s)
  showGeometry();
  
  // 4. Main title appears with blur-to-sharp (2s from 1s)
  setTimeout(() => showTitle(success), 1000);
  
  // 5. Subtitle fades in (2s from 1.5s)
  setTimeout(() => showSubtitle(success), 1500);
  
  // 6. Auto-dismiss after 5s
  setTimeout(() => hideResult(), 5000);
};
```

## Implementation Steps

### Phase 1: Theme and Layout Foundation

1. **Update Theme System** (`theme/index.ts`, `theme/recipes/*.ts`)
   - Replace `canvasBg` token with wood grain CSS background
   - Update color palette: primary colors to purple/gold
   - Replace `borderDefault` with transparent to remove separations
   - Update `panelSubBg` to transparent or wood-toned
   - Modify button recipes to match Artifact styling

2. **Restructure GameLayout.tsx** (Complete Rewrite)
   ```typescript
   // Change from current grid structure:
   gridTemplateAreas: `"header header header" "sidebar main-area chat" "hand hand hand"`
   
   // To new immersive structure:
   gridTemplateAreas: `"header" "main-area" "waiting-area" "bottom-controls"`
   ```
   - Remove sidebar and chat grid areas
   - Add corner-positioned player indicators (position: fixed)
   - Add minimal chat as floating element (position: fixed, bottom-right)
   - Make main-area full-width with no margins

### Phase 2: Card Flow System

3. **Enhance GameCard.tsx** (Build on existing flip variant)
   ```typescript
   // Add new props to existing GameCardProps:
   interface GameCardProps {
     // ... existing props
     cardState?: "waiting" | "submitted" | "revealing" | "correct" | "incorrect";
     animationState?: "idle" | "moving-up" | "moving-down";
     position?: { x: number; y: number }; // For smooth transitions
   }
   ```
   - Extend existing state prop with new "waiting" option
   - Add CSS transitions for position changes
   - Enhance flip animation for reveal sequence

4. **Rebuild CentralCardBoard.tsx** (Major Restructure)
   ```typescript
   // Add to existing component structure:
   return (
     <Box>
       {/* Existing instruction header */}
       
       {/* New: Submitted cards area (top) */}
       <Box className="submitted-area">
         {submittedCards.map(card => renderCard(card))}
         {/* Empty placeholders for remaining cards */}
       </Box>
       
       {/* New: Waiting area (bottom) */}
       <Box className="waiting-area">
         {waitingPlayers.map(player => renderWaitingCard(player))}
       </Box>
       
       {/* New: Confirm button (when all submitted) */}
       {canConfirm && (
         <Button onClick={startRevealSequence}>確定！順番を発表</Button>
       )}
     </Box>
   )
   ```
   - Keep existing DndKit integration for sort-submit mode
   - Add waiting area below submitted area
   - Implement card movement animations between areas

5. **Create New State Management Hooks**
   - `useCardFlowState()` - Manages waiting/submitted player states
   - `useCardMovementAnimation()` - Handles smooth card transitions
   - `useRevealSequence()` - Controls judgment timing (enhance existing useRevealAnimation)

### Phase 3: Interactive Features

6. **Word Input System** (Integrate into CentralCardBoard)
   - Move input from Hud.tsx to bottom of CentralCardBoard
   - Create inline word input area:
   ```typescript
   <Box className="word-input-area">
     <Input placeholder="連想ワードを入力..." value={currentWord} />
     <Button onClick={submitWord}>提出</Button>
   </Box>
   ```
   - On submit: animate card from waiting area to submitted area
   - Show confirmation button only when `waitingPlayers.length === 0`

7. **Judgment Sequence** (Enhance existing reveal system)
   ```typescript
   const startRevealSequence = async () => {
     // Use existing revealIndex from useRevealAnimation
     for (let i = 0; i < submittedCards.length; i++) {
       await flipCard(submittedCards[i]); // Use existing flip variant
       await evaluateSequence(i); // New: implement ITO rules
       if (sequenceBroken) {
         // Mark all remaining cards as incorrect
         markRemainingIncorrect(i + 1);
         break;
       }
     }
     await showArtifactResults(); // New: replace GameResultOverlay
   };
   ```
   - Build on existing flip animation system
   - Implement proper ITO rule: once sequence breaks, all remaining = incorrect
   - Replace simple GameResultOverlay with Artifact-style results

### Phase 4: Result Presentation

8. **Artifact-Style Results** (Replace GameResultOverlay.tsx)
   Create new `components/ui/ArtifactResultOverlay.tsx`:
   ```typescript
   interface ArtifactResultProps {
     success: boolean;
     correctCount: number;
     totalCount: number;
     onClose: () => void;
   }
   ```
   - Fullscreen overlay with cosmic background (not inline like current)
   - Sacred geometry SVG animations using framer-motion or CSS animations
   - "VICTORY" vs "DEFEAT" typography with dramatic reveals
   - Replace current simple success/fail overlay in CentralCardBoard

### Phase 5: Polish and Optimization

9. **Mobile Responsiveness**
   - Adapt layout for smaller screens
   - Optimize animations for touch devices
   - Ensure all interactions work on mobile

10. **Performance and Accessibility**
    - Optimize animation performance
    - Add proper ARIA labels
    - Test with screen readers
    - Ensure keyboard navigation

## Testing Requirements

### Functional Testing
- [ ] Card submission moves from waiting to submitted area
- [ ] "Confirm" button appears only when all players submitted
- [ ] Judgment sequence reveals cards in correct order
- [ ] ITO rules properly implemented (sequence break = all wrong)
- [ ] Success/failure results display correctly
- [ ] Chat functionality maintained
- [ ] Player join/leave handling

### Visual Testing
- [ ] Smooth animations on all devices
- [ ] Proper card positioning and sizing
- [ ] Theme consistency across all components
- [ ] No layout breaks on different screen sizes
- [ ] Result overlay displays correctly

### User Experience Testing
- [ ] Clear progression feedback
- [ ] Intuitive interaction patterns
- [ ] Appropriate timing for animations
- [ ] Accessible to all users
- [ ] Performance remains smooth with 8+ players

## Files to Modify

### Primary Components (Major Changes)
- `components/ui/GameLayout.tsx` - **COMPLETE REDESIGN**: Remove sidebar grid, add fixed positioning
- `components/CentralCardBoard.tsx` - **MAJOR RESTRUCTURE**: Add waiting area, card movement system
- `components/ui/GameCard.tsx` - **ENHANCE**: Add waiting state, movement animations
- `components/Hud.tsx` - **SIMPLIFY**: Remove most controls, keep only essential phase info

### Theme and Styling (Comprehensive Update)
- `theme/index.ts` - **UPDATE**: All background tokens, color palette to purple/gold
- `theme/recipes/button.recipe.ts` - **MODIFY**: Match Artifact styling
- `theme/recipes/gameCard.recipe.ts` - **ENHANCE**: Add waiting/submitted/result states
- `components/ui/GameResultOverlay.tsx` - **REPLACE**: With Artifact-style cosmic overlay

### New Components to Create
- `components/ui/WaitingArea.tsx` - Bottom participant cards with thinking animations
- `components/ui/MinimalChat.tsx` - Floating toggle chat in corner
- `components/ui/PlayerIndicators.tsx` - Fixed positioned corner status indicators
- `components/ui/ArtifactResultOverlay.tsx` - Cosmic space result presentation
- `components/ui/WordInputArea.tsx` - Inline submission interface

### Enhanced Hooks (Build on Existing)
- Enhance `components/hooks/useRevealAnimation.tsx` - Add waiting area support
- Create `components/hooks/useCardFlowState.tsx` - Manage submission states
- Create `components/hooks/useCardMovement.tsx` - Handle animations between areas

### State Management Integration
- Extend existing room state to track clue submission status
- Add animation state management to existing context providers
- Integrate with existing `lib/game/room.ts` functions

## Success Criteria

The implementation is successful when:

1. **Visual Transformation**: The UI looks like an immersive card game, not a web app
   - Wood grain background replaces flat colors
   - Purple mystical cards with golden accents
   - No visible boundaries or rigid separations
   - Corner player indicators instead of sidebar lists

2. **Clear Progression**: Players can instantly see who has/hasn't submitted
   - Waiting area shows unsubmitted players with thinking animations
   - Submitted area shows completed clue cards
   - Confirmation button appears only when all players ready

3. **Smooth Interactions**: Card movements feel natural and responsive  
   - Cards animate smoothly from waiting to submitted area
   - Flip animations reveal numbers with perfect timing
   - No jarring transitions or layout shifts

4. **Dramatic Results**: Success/failure feels cinematic and impactful
   - Fullscreen cosmic overlay with star field
   - Sacred geometry animations
   - "VICTORY" or "DEFEAT" with dramatic typography
   - Auto-dismiss after appropriate dramatic timing

5. **Maintained Functionality**: All existing game features continue to work
   - All current game modes (sequential/sort-submit) function unchanged
   - Existing multiplayer synchronization works
   - Mobile responsiveness preserved
   - Accessibility features maintained

6. **Cross-Device Compatibility**: Works beautifully on desktop and mobile
   - Responsive design scales appropriately
   - Touch interactions work smoothly
   - Performance remains excellent on all devices
   - 125% DPI scaling continues to work correctly

## Final Implementation Checklist

- [ ] All existing tests pass
- [ ] New card flow system works in both game modes
- [ ] Artifact-style results display correctly
- [ ] Mobile experience is polished
- [ ] Performance benchmarks meet standards
- [ ] Accessibility audit completed
- [ ] User testing validates improved experience

## Integration Notes

### Working with Existing Systems
This implementation builds on and enhances existing functionality rather than replacing it:

1. **Preserve Existing Game Logic**: All current game rules, room management, and multiplayer sync remain unchanged
2. **Enhance DndKit Integration**: Keep existing drag-and-drop for sort-submit mode, add card movement animations
3. **Build on Theme System**: Extend current Chakra UI theme rather than replacing it
4. **Maintain Mobile Compatibility**: Current responsive design patterns should be preserved and enhanced

### Migration Strategy
1. **Phase 1**: Update theme and layout foundation (visual changes only)
2. **Phase 2**: Add waiting area and card movement (functional enhancements)
3. **Phase 3**: Integrate word input and judgment sequence (gameplay improvements)
4. **Phase 4**: Add Artifact-style results (polish and drama)

### Backwards Compatibility
- All existing props and interfaces should be preserved
- New features should be additive, not replacement
- Existing tests should continue to pass
- Current game modes (sequential/sort-submit) must work unchanged

This implementation will transform ITO from a functional web application into an engaging, immersive card game experience that rivals professional gaming products while maintaining all existing functionality and reliability.