# 🎯 Expert Mode Feature Review Request

## 📋 Review Objective

Please conduct a comprehensive technical review of the newly implemented **Expert Mode** feature for the Online ITO card game. This feature allows players to choose between two display modes when creating rooms:
- **協力モード (Cooperation Mode)**: Shows all players' cards (default)  
- **エキスパートモード (Expert Mode)**: Shows only the player's own card

## 🎮 Feature Overview

**Business Logic**: Expert mode provides a more authentic "hand of cards" feeling for experienced players by hiding other players' cards in the waiting area, while maintaining full game functionality.

**Implementation Date**: 2025-09-12  
**Status**: ✅ Complete and deployed

## 🔍 Review Scope

Please evaluate the implementation across these key areas:

### 1. **Architecture & Design Patterns**
- [ ] TypeScript type safety and interface design
- [ ] Component composition and props threading
- [ ] State management approach
- [ ] Separation of concerns

### 2. **Code Quality & Best Practices**
- [ ] React component patterns and hooks usage
- [ ] Error handling and edge cases
- [ ] Performance considerations
- [ ] Code readability and maintainability

### 3. **User Experience & UI/UX**
- [ ] Intuitive room creation flow
- [ ] Clear visual feedback for mode selection
- [ ] Consistent with existing Dragon Quest-style design system
- [ ] Responsive behavior across devices

### 4. **Data Flow & Integration**
- [ ] Firebase Firestore integration
- [ ] Real-time synchronization handling
- [ ] Fallback mechanisms for data persistence issues
- [ ] Cross-component communication

### 5. **Security & Robustness**
- [ ] Input validation and sanitization
- [ ] Authorization and access control
- [ ] Graceful degradation
- [ ] Data consistency

## 📁 Key Files to Review

### **Primary Implementation Files**
```
components/CreateRoomModal.tsx          # Room creation UI with mode selection
components/ui/WaitingArea.tsx           # Conditional card display logic
app/rooms/[roomId]/page.tsx            # Display mode determination & props threading
lib/types.ts                           # TypeScript type definitions
```

### **Supporting Files**
```
components/CentralCardBoard.tsx         # Props threading
app/page.tsx                          # Room name display (lobby)
```

### **Removed Files**
```
components/ui/PlayersStatus.tsx         # (Deleted - was redundant counter)
```

## 🔧 Technical Implementation Details

### **Core Logic Flow**
1. **Room Creation**: User selects display mode via toggle buttons
2. **Data Persistence**: Mode stored as room name suffix `[エキスパート]` (Firestore workaround)
3. **Display Logic**: Conditional rendering based on displayMode prop
4. **UI Polish**: Room names shown without `[エキスパート]` suffix in user-facing displays

### **Key Technical Decisions**
- **Firestore Workaround**: Used room name tagging due to security rule limitations with `displayMode` field
- **Fallback Strategy**: `room.options?.displayMode || (room.name?.includes("[エキスパート]") ? "minimal" : "full")`
- **Component Cleanup**: Removed redundant PlayersStatus component for cleaner UX

## ✅ Expected Behaviors to Validate

### **Room Creation Flow**
- [ ] Mode selection buttons work correctly
- [ ] Visual feedback shows selected mode
- [ ] Room creation succeeds for both modes
- [ ] Room names display cleanly (no visible `[エキスパート]` tags)

### **Expert Mode Functionality**
- [ ] Only player's own card displayed in waiting area
- [ ] Other players' cards hidden from view
- [ ] Game progression works normally
- [ ] Real-time updates function correctly

### **Cooperation Mode (Default)**
- [ ] All players' cards visible
- [ ] Backward compatibility maintained
- [ ] No regression in existing functionality

### **Edge Cases**
- [ ] Multiple players joining expert mode rooms
- [ ] Network disconnection/reconnection
- [ ] Room persistence across browser refreshes
- [ ] Cross-device synchronization

## 🚨 Potential Issues to Look For

### **Common Anti-Patterns**
- [ ] Prop drilling without proper abstraction
- [ ] Direct DOM manipulation instead of React patterns
- [ ] Missing error boundaries
- [ ] Unhandled promise rejections

### **Performance Red Flags**
- [ ] Unnecessary re-renders
- [ ] Memory leaks in useEffect hooks
- [ ] Inefficient state updates
- [ ] Large bundle size increases

### **Security Concerns**
- [ ] XSS vulnerabilities in room name handling
- [ ] Client-side only validation
- [ ] Exposed sensitive data in props
- [ ] Insufficient access control

## 📊 Review Deliverables

Please provide:

1. **Overall Assessment**: Rate implementation quality (1-10)
2. **Critical Issues**: Any blocking issues that must be fixed
3. **Improvement Suggestions**: Opportunities for better patterns
4. **Best Practice Compliance**: Adherence to React/Next.js/Firebase best practices
5. **Performance Impact**: Any performance implications
6. **Future Recommendations**: Suggestions for maintainability and extensibility

## 🎯 Success Criteria

**This feature should be considered successful if:**
- ✅ Code follows established project patterns
- ✅ No security vulnerabilities introduced
- ✅ Performance impact is negligible
- ✅ User experience is intuitive and polished
- ✅ Implementation is maintainable and extensible

## 📝 Review Notes

**Context**: This feature was implemented to address user feedback requesting a more authentic "hand of cards" experience for advanced players, while maintaining the cooperative default for beginners.

**Technical Constraints**: Had to work around Firestore security rule limitations that prevented direct `displayMode` field persistence.

**Design Philosophy**: Maintains consistency with existing Dragon Quest-style UI while adding new functionality without disrupting the core game experience.

---

**Reviewer**: Please provide your assessment in a structured format with specific code examples and actionable recommendations.