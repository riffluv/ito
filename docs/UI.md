ITO Party Game UI Redesign Plan
Design Goals & Principles
We aim to rebuild the ITO game’s interface from the ground up, focusing on clarity, consistency, and joy. The new UI will feel like a polished console party game – bright, bold, and intuitive for new players – while adhering to modern web best practices. Key goals include:
Full-Screen Layout, No Browser Scrolling: The entire game fits within the viewport at all times. We will use a fixed grid layout (with Chakra UI’s responsive grid) sized to the viewport so that no browser scrollbar appears
GitHub
. Any overflow (e.g. long chat history) will scroll inside its own panel, not the page.
Consistency & Theming: All colors, spacing, and typography will come from a unified theme. We’ll follow a “tokens-first” approach – using Chakra’s theme tokens for colors, font sizes, spacing, etc. – to ensure a consistent look
GitHub
. No arbitrary magic numbers or !important overrides will be used (avoiding the hacks that caused past layout issues)
GitHub
.
Console-Style Readability: Inspired by Nintendo’s UI philosophy, we’ll favor big, bold sans-serif text and simple icons for high readability
reddit.com
. The design will use bright, engaging colors that evoke a cheerful, inviting mood
uxdesign.cc
. While clean and minimal in clutter, the style will not be bland – it will have playful visual touches and a distinct personality.
Visual Feedback & Fun: Every interaction should feel lively and responsive. We will incorporate micro-animations and effects (card flips, confetti on success, gentle shakes on errors) to celebrate the game’s social, lighthearted nature
uxdesign.cc
. The UI will provide clear feedback for actions (e.g. a button press will animate, the active player’s panel will glow) so players instantly understand what’s happening.
Fixed Dimensions & No Overflow: All UI components will be designed with fixed or max dimensions to prevent overflow or reflow issues. Past CSS issues (like text causing container overflow due to fixed heights) will be solved by using flexible layout units (e.g. auto rows and minmax for heights)
GitHub
. For example, we’ll avoid any fixed pixel heights that could break when text scales; instead header and footer rows will size to content with min/max constraints
GitHub
GitHub
.
By following these principles, the redesign will achieve a professional, console-quality interface that remains joyful and easy to use.
Full-Screen Layout Structure
The application will use a responsive 3-column grid layout on desktop, ensuring all key panels are visible without scrolling. On a typical 16:9 or 3:2 monitor (1280×720 up to 1920×1080), the game fills the screen. The grid is defined with explicit areas for each section
GitHub
: 
GitHub
Header: A top row for the game title or room info (auto height). This may include the game logo or room code and a minimal status bar. (On in-game screens, we may hide the global site header to maximize space, per “focus mode” design
GitHub
.)
Left Panel (Sidebar, ~280px): A fixed-width side panel showing the player list and small host controls. This is the “HUD” for participants – listing all players with their names, avatars, and statuses. It remains visible throughout gameplay for quick reference.
Center Panel (Main Area, flex 1fr): The central stage for the game content. This area is fluid (expands to fill remaining width) and will host different content depending on phase: the theme prompt, clue display, the card ordering interface, and the result screen all appear here in their turn. It’s essentially the “game board” area.
Right Panel (~340px): A fixed-width side panel for the chat and game info. This will contain a scrollable chat log so players can communicate and strategize, plus possibly a quick reference section (like current round or mode indicator). The chat panel uses an internal scrollbar if needed, while the overall layout stays static
GitHub
.
Bottom Panel (“Hand” row, min 140px height): A bottom row spanning the full width for player-specific controls
GitHub
. This is where each player interacts with their own hand or inputs. For example, the clue input field, the player’s own number card, and action buttons (Confirm, Play Card, etc.) will appear here, anchored at the bottom of the screen. Using this fixed bottom HUD keeps critical controls in one predictable place, minimizing eye movement between phases
GitHub
.
This grid approach guarantees no outer scrolling. The outer container will be set to minH="100dvh" and overflow="hidden", so it exactly fills the viewport height
GitHub
. Each column panel (left, center, right) can scroll internally (overflowY="auto") for their content if needed
GitHub
. We will also ensure any flex containers have minH={0} so that internal scroll regions shrink properly and do not push the layout (a known fix for preventing overflow)
GitHub
. Overall, this full-screen AppShell grid makes efficient use of space and feels like a console game HUD rather than a web page. Responsive behavior: Although we target desktop, the design will gracefully collapse on smaller screens. At the Chakra md breakpoint (~48em), we use the 3-column layout
GitHub
. Below that, the layout can stack to a single column (Header → Main → Hand), and the right chat panel can become a collapsible element or bottom sheet on mobile
GitHub
. This ensures the UI is usable on any device if needed, without explicit scroll, just reflow.
Visual Style & Theming
Visually, the new ITO UI will be colorful and inviting, yet clean and legible. We draw inspiration from top-tier party games which use friendly aesthetics to welcome players of all ages. Key style elements include:
Color Scheme: A vibrant palette with high contrast for UI elements. We’ll use semantic color tokens from Chakra’s theme (e.g. panelBg for panel backgrounds, accent for highlights) to ensure consistency
GitHub
GitHub
. Each role or state is color-coded for clarity. For example, the host might be indicated with a special color or icon (a gold outline or crown) to denote their role. Active players or the player whose turn it is (in sequential mode) could have their name and panel highlighted in the accent color to stand out. Success and failure states will use semantic tokens like green for success and red for failure, avoiding arbitrary colors
GitHub
.
Typography: We’ll adopt large, bold sans-serif fonts for titles and important game info (e.g. the theme prompt), aligning with Nintendo’s preference for easily readable text
reddit.com
. All font sizes will use the Chakra theme’s fluid typography settings (based on CSS clamp()) so that text scales smoothly with screen size
GitHub
. This avoids any fixed px text that could become too small or large. For instance, the theme name might use a responsive xl or 2xl size, whereas player names use a smaller but still readable md size. We ensure no text overflows its container – using wrapping or ellipsis appropriately – so the interface stays tidy.
Icons & Imagery: We’ll integrate simple, intuitive icons for actions and status. Chakra UI and Lucide provide icon sets (e.g. a crown for host, chat bubble for chat, checkmark for ready). Icons will be used alongside text labels for clarity, and kept stylistically consistent (line-style, flat design, matching the overall UI). The style will be somewhat flat and modern, avoiding overly skeuomorphic elements – similar to Switch games that use clean vector iconography
reddit.com
 – but with a touch of playful embellishment (e.g. maybe subtle drop-shadows or a themed background pattern in panels to add character). Any game-specific graphics (like an ITO logo or illustration) will be placed in the UI in a way that doesn’t distract from functionality.
Component Styling: All interactive components (buttons, cards, panels) will have a polished “Nintendo-esque” feel. Buttons will be large with clear text, and use Chakra’s variants for hover/active styles (for example, a primary button might use Chakra’s brand color with a soft fill, and deepen in color when pressed
GitHub
). We will utilize consistent rounded corners (using theme radii like md or lg – no hard square corners unless for specific emphasis
GitHub
). Panels and cards will have subtle shadows or borders to delineate them from the background. For instance, the main center panel (game board area) might have a slight drop shadow and a distinct background (panelBg) to feel like a contained play area.
Animations & Transitions: The style will come to life with animations that reinforce game actions. We’ll follow a “motion-safe” approach – animations are fun but not overwhelming, and they respect user reduced-motion preferences
GitHub
. For example, when a card is revealed, it might flip over with a smooth animation. Success could trigger a brief confetti burst or a celebratory icon animation. Buttons and interactive elements will have quick hover and click animations (e.g. scaling up slightly or a soft glow on focus) to provide tactile feedback. All animations will use Chakra’s animation tokens or keyframes (e.g. a custom fadeInUp for entering elements) and be kept efficient
GitHub
. These touches make the UI feel “alive” and joyful, matching the lighthearted tone of the game
uxdesign.cc
.
By using the Chakra theme system and adhering to these style guidelines, the interface will look cohesive and professional. It will also be easier to maintain – e.g. if we adjust a theme color or spacing scale, all components update consistently (Single Source of Truth for design values
GitHub
). The end result is a UI that is not only attractive but also reinforces the game’s cooperative, fun atmosphere through its visuals.
Room Lobby (Pre-Game Setup)
Before the game begins, players gather in a room lobby screen. This screen introduces the players and allows the host to configure the game. The layout here uses the same three-column structure:
Left Panel – Player List: A list of all players who have joined the room. Each entry shows the player’s avatar (or initial), name, and an indicator if they are the host or have any special status. We’ll use a clear list style with each player in a card-like row (name in bold and maybe a background highlight if it’s yourself). If the host has special powers, an icon like a crown could appear next to their name. At this stage, since no clues have been given yet, we might display a simple status like “Ready” or “In Lobby” for each player. For example, each player could have a badge showing “待機中 (Waiting)”
GitHub
GitHub
 or similar. (Later, this same list will update to show clues or game statuses, which we’ll cover in the next phases.) The player list in the lobby is scrollable if there are many players (up to 10), but designed to fit without scroll in most cases.
Center Panel – Game Options & Start Button: In the lobby’s main area, the host can select game options. The two game modes – Sequential Judgement and Sort-Then-Reveal – are presented here with descriptions. For instance, we might use two large toggle buttons or cards side by side: one for Sequential (逐次判定) and one for Sort (一括判定), each with a short explanation (e.g. “Place cards one by one with immediate checks” vs “Give all clues then arrange and reveal together”). The host can click to choose the mode (the selected mode card will highlight). We’ll also show any other options: for example, if there are category decks (Family, Everyone, Action) to include or exclude, the host could toggle those here. Once settings are chosen, a prominent “Start Game” button is in this center panel. This button likely appears only to the host (disabled or hidden for others). It should be big and bright (perhaps in the accent color) to clearly indicate it launches the game. Other players see a message like “Waiting for host to start the game...” along with perhaps a summary of chosen options (“Mode: Sequential, Deck: All Categories”) so everyone is on the same page. The overall vibe in the lobby is anticipatory – perhaps an upbeat background graphic or the game logo is displayed lightly in this area to set the mood.
Right Panel – Chat: The chat panel is active here so players can greet each other and discuss before starting. The chat UI will display messages with player names or avatars and timestamps. It will use a muted background (so as not to distract) and keep messages confined so the main area remains focused on setup. A text input at the bottom of the chat panel allows sending messages. We’ll ensure the chat input is always visible above the bottom “hand” row or integrated into it. (Since the “hand” row might not have much use in the lobby, the chat input could effectively sit at the bottom of the right panel). As always, the chat list scrolls internally if it grows long, with the newest messages auto-scrolling into view.
Bottom Panel – (Minimal in Lobby): In the pre-game lobby, the bottom “hand” row might not be heavily used, since most actions are host-driven in the center. We could potentially use the bottom area to display a friendly tip or game rules summary while waiting. For example, a line of text like “Ito is a cooperative game: work together to sort your secret numbers!” as a reminder, or even a small rotating hint about gameplay. If not, this area can remain mostly empty or simply decorative (ensuring it still occupies the 140px min height so the layout is consistent
GitHub
).
Once the host clicks “Start Game,” the lobby phase transitions into the gameplay phases. We’ll provide a smooth transition animation (perhaps a fade-out of the lobby UI or a slide) to signal the game is starting.
Theme Reveal Phase
When the game begins, each player is secretly assigned a number (1–100), and a category prompt (theme) is chosen for the round. The UI will clearly present the category to all players:
Center Panel – Category Display: The center area will prominently show the theme card or prompt. This could be designed as a large card or banner with the category text. For example, if the theme is “Spiciness of Food,” the text “Category: Spiciness of Food” will appear in a bold, large font front-and-center
tokyochase.com
. We might adorn this with a small icon that represents the theme (if we have a library of icons for concepts, e.g. a chili pepper icon for spiciness). The category card can have a distinctive background color or illustration to make it exciting – reminiscent of drawing a category card in a physical game. This display ensures everyone immediately knows the “scale” on which they’ll be giving clues.
Player’s Number (Private): At the same time, each player sees their own secret number. On each client’s view (visible only to themselves), the bottom “hand” panel will show a card with their number. This can be graphically represented as a playing card or tile – for instance, a card with the number in large font and maybe the player’s color or icon. It might say “Your Number: 72” in a decorative way to emulate looking at your card. This reminds the player of their number while keeping it hidden from others (we will not display other players’ numbers anywhere in the UI). The number card could be placed on the left side of the bottom bar or centered in that bottom area for visibility.
Instructions: We will also present a brief instruction prompt like “Think of a clue related to [Category] to indicate how large your number is.” This text can appear just below the category title in the center panel, in a slightly smaller font. It sets the stage for clue giving, so new players understand what to do (even without having to read the rulebook). For example: “Each player, describe your number in terms of Spiciness of Food. (No numbers or direct hints!)” – reinforcing the rules in a friendly way
tokyochase.com
arcanewonders.com
. This can fade in right after the category is revealed.
Acknowledge/Continue: Depending on how we handle pacing, we might require players to click a ready button after they see the theme, or the game might automatically proceed to clue input after a few seconds. A possible UI element is a small “OK” or “Start Clue Phase” button for the host to trigger when everyone seems ready. However, to keep things smooth, we could simply display the category and simultaneously open the clue input fields (described next) so that players can begin typing when they’re ready. The category display would remain visible on the screen as they start writing clues (acting as a reference).
Visually, this phase is about communicating the theme clearly and energetically. We might animate the appearance of the category card (e.g. it flips down onto the screen or fades in with a fun effect). The use of color here can be tied to category type – for instance, if categories have types (Family, Everyone, Action), the card might be color-coded (blue for easy, red for zany “Action” categories, etc.), as hinted by the physical game having different colored category cards
arcanewonders.com
amazon.com
. All players seeing the same central prompt creates a shared focus as they move into giving clues.
Clue Submission Phase
In this phase, each player submits a clue – a word or phrase related to the category that hints at the magnitude of their number
tokyochase.com
. The UI will facilitate each player entering their clue and allow everyone to view the clues once given, all while keeping numbers secret.
Clue Input (Bottom Panel): The bottom “hand” row becomes an input area for your clue. Each player will have a text input box labeled something like “Enter your clue…” or “Your hint:” where they can type their hint for their number
tokyochase.com
. This input will be styled to stand out (perhaps a bordered card or an outlined Chakra Input component) and be large enough to type a short sentence. Next to it, a submit button (or hitting Enter) will confirm the clue. We will make this input very accessible: clearly labeled (with aria-label for screen readers, though this is a secondary concern given the game context) and with a character limit if needed (to encourage brevity). The styling should encourage creativity – maybe a light prompt text like “e.g. ‘Ghost pepper sauce that made me cry for 3 days’” (for a high spice level) as a placeholder to inspire players
tokyochase.com
.
Optional Second Clue: Since the game logic allows for an optional second hint (clue2)
GitHub
GitHub
, we can provide a way to add a second clue. For instance, after submitting the first clue, a smaller second input could appear labeled “(Optional) Another hint:”. This gives players a chance to clarify if they feel one clue isn’t enough. The UI might show a little “+ Add another hint” button next to the first input; clicking it reveals the second input field. We’ll keep the second hint truly optional – perhaps visually slightly less prominent – so as not to overwhelm new players, but it’s there for experienced groups or difficult scales where two hints might help.
Viewing Clues (Center/Left): As players submit their clues, these clues should become visible to everyone. We will display each player’s clue text alongside their name. There are a couple of approaches, and we may use both for maximum clarity:
The player list (left panel) will update each entry to show the player’s clue. For example, under each name, in a smaller font, it could show “Clue: Ghost pepper sauce that made me cry for 3 days”
GitHub
 once that player has submitted. This was partially implemented in the current app (showing one line, truncated)
GitHub
, but in our redesign we will ensure the full clue is easily readable (no excessive truncation). We might allow the text to wrap to a second line or provide a tooltip on hover to see the whole clue if it’s long.
Additionally, the center panel can be used to present all clues more visually once everyone has submitted. For example, we could transform the center area into a “clue board” displaying each clue on a card or speech bubble, arranged perhaps in a grid or around the category card. Each clue card could include the player’s avatar or color for identification. This isn’t strictly necessary (the left list could suffice), but doing so would emphasize the creativity and make the clue review more engaging. It also solves the issue of the left sidebar being narrow – the center could show the clues in larger text for group discussion. For instance, the clues might appear as a series of colorful sticky-notes or chat bubbles on the screen, each labeled with the player’s name.
If we implement the center clue display, we would do it once all players have entered at least their first clue. Possibly an animation like one-by-one the clue cards fly into the center area when submitted, giving immediate feedback. Otherwise, simply showing them in the list in real-time works too.
Discussion & Chat: As clues appear, players will naturally discuss them – either via voice or using the chat panel. The UI should encourage discussion. We will keep the chat panel open and visible during this phase. Players might type things like “Wow, ghost pepper? That must be a really high number!” – which is fine as long as they don’t directly share numbers. The UI won’t restrict chat content (that’s up to house rules), but it will provide the space for it. The chat area remains on the right, functioning as usual.
Status Indications: We will provide subtle signals for clue submission status. For example, a player who has submitted their clue might get a checkmark by their name, or their name could be shown in a different color. The goal is to let everyone see who is still thinking of a clue. We could display a small “...typing” indicator if feasible, or simply mark players as “Ready” once their clue is in. In the player list, perhaps the badge that said “在室” (present) could change to “✔ Clue given” for that player
GitHub
. This way the host (and all players) know when everyone is done.
Overall, the clue submission UI should be self-explanatory: the category is visible, your number is in hand, there’s a clear input for your clue, and you can see others’ clues as they come in. By reading the clues, players start forming a mental picture of roughly where each person’s number lies, setting the stage for the ordering phase. We ensure no UI elements overlap or cause scroll in this phase – the inputs and clue displays are sized to fit within the designated areas (for instance, if 10 players each give a long clue, the left panel list might scroll internally, but the overall layout remains static). After all clues are entered (or possibly when the host decides enough discussion has happened), we move to the next phase.
Card Ordering Phase
Now comes the core gameplay: players must arrange the face-down number cards in ascending order based on the clues. We have two modes to support, and the UI will adapt to each:
Sort-Then-Reveal Mode (一括判定):
In this mode, all clues are given first (as we just did), and then players collectively arrange the cards before any are revealed
tokyochase.com
. The UI for this phase will present a sortable lineup of cards that represent each player’s number card:
Center Panel – Sorting Board: The center area becomes the “table” where cards are arranged. Initially, we will display a series of face-down card slots for each player. One end will represent the lowest number, the other end the highest. We can visually indicate this with a label or icon: e.g. at the far left, a “0” card (the game often uses a Zero card as a starting reference
arcanewonders.com
) and at the far right perhaps an infinity symbol or just the understanding that’s the highest end. A text like “Arrange from lowest (left) to highest (right)” can be shown at the top of this board to remind players of the goal. Each player’s card is shown as a face-down card with an identifier – typically their name or color. For example, we might have cards labeled “Alice”, “Bob”, “Charlie”, etc., or using their avatar on the card back. These start in some default order (maybe random or sorted alphabetically by name) on the board, and players can drag and drop them into the order they collectively think is correct. We will use a robust drag-and-drop library (the app already uses dnd-kit for this
GitHub
) to allow smooth dragging. As a player drags a card, other cards will shift to make space – we’ll likely use a horizontal line layout with slight gaps where a card can be dropped. The card being dragged might enlarge slightly or highlight to show it’s active. We will also use a dashed outline or glow effect at the potential drop positions, consistent with our style guide for drag targets
GitHub
. The entire board has a distinct background (perhaps a subtle pattern or a different shade) to clearly delineate the interactive area for sorting. Importantly, in cooperative sort mode, every player can participate in arranging. Any player should be able to drag any card. This means the UI must reflect changes in real-time for all: when one person moves a card, it shifts on everyone’s screen. We’ll handle this through live updates (the logic is in place to save order to Firestore
GitHub
). The design will optimistically show the movement and finalize positions as updates come in. To avoid chaos, players will likely discuss via chat/voice and move cards one at a time. The UI could include an implicit “lockout” while a card is being dragged by someone (maybe show that card with a tiny padlock or a different color when another user is moving it), but that might be too much detail – at minimum, moves happen quickly enough.
Player Hand (Bottom Panel): In sort mode, once we’re in the arrangement phase, the bottom panel’s role changes. Since all cards are already on the board, players don’t hold cards in hand now (unlike sequential). Instead, the bottom area can show action buttons like a “Confirm” checkbox for each player and possibly a “Finalize” for the host:
Each player gets a “Confirm Order” button or toggle. This allows them to signal “I’m satisfied with the arrangement.” The UI can present this as a nice big button in their bottom bar that says “✅ Confirm Order” (or a Chakra Switch they flip to ready). Once a player confirms, we can disable their ability to drag further (to prevent accidental moves) and mark them as ready. Their confirm button might turn into a label “✔ Waiting...” indicating they are waiting for others. If they change their mind, they could un-confirm (if allowed) by toggling again – but typically, once confirmed we assume they won’t keep fiddling.
The host’s bottom panel will show a “Reveal Result” or “Finalize Result” button, which remains disabled until all players have confirmed. Once the last player hits confirm, the host’s button becomes active (perhaps highlighted to draw attention). The host can then press it to trigger the reveal. (If the host is also a player, they too have to confirm as part of this, or we treat host pressing finalize as implicitly confirming them as well).
We will also surface the confirmation status on the UI: for example, in the player list or somewhere obvious, show a count like “Confirmations: 3/5” so everyone knows how close they are
GitHub
. We could also change the appearance of the player’s name or add a small green checkmark icon next to names of those who locked in. This shared information helps coordinate the group – they might ping the last person in chat “Are we good with the order?” if someone hasn’t confirmed.
Guidance & Constraints: The UI might provide gentle guidance as they arrange. For instance, if a clue was extremely low and another extremely high, players might already know some order. The game doesn’t explicitly forbid any arrangement, but the UI can still ensure clarity: each card remains face-down showing only identifying info, not the number. We might include an ability to highlight or mark certain cards if players want to tag ones they think should go first or last, though that might be unnecessary. Simplicity is preferred: they can simply drag until they all verbally agree it looks right.
No External Scroll: Even if players have long names or many players, the sorting board will fit on screen. If needed, the card elements can shrink or overlap slightly when there are lots of players (to avoid running out of horizontal space). Alternatively, the board could scroll horizontally within the center panel if 10 cards simply can’t fit nicely in one row – but since 10 cards of ~100px width plus gaps might fit within 1920px, we likely can manage without horizontal scrolling. We will test this at lower resolutions and possibly make the card size adaptive (slightly smaller if more players). Ensuring minH=0 on containers and using flex wrap/overflow rules will handle any edge cases gracefully
GitHub
.
In summary, sort mode’s UI allows collaborative dragging of all players’ cards into an order, and then a group confirmation.
Sequential Judgement Mode (逐次判定):
In sequential mode, players will place their cards one by one, with each placement immediately judged in sequence
playerelimination.com
. The UI will have similarities to sort mode but some crucial differences to accommodate turn-by-turn play:
Center Panel – Play Area: The center shows an initially empty sequence (aside from a starting reference card). We will place the “0” card at the leftmost as a starting point (if using that concept)
arcanewonders.com
. The rest of the play area is empty initially, perhaps represented by an outline or slots to the right of the 0 where cards will go. We won’t show all player cards at once here, because they haven’t been placed yet. Instead, each player will effectively hold their card in their hand (on their own screen) until they decide to play it.
Player Hand (Bottom Panel): In sequential mode, the bottom panel for each player will prominently show their own card (with the number hidden from others). It might look like a large card that the player can drag. If it’s not your turn, your card might be slightly grayed out or simply you know to wait. If players can decide the sequence among themselves (there’s no fixed turn order, they collectively choose who goes next based on confidence), we should support that flexibility:
The UI could allow any player to initiate a move when they feel it’s right. They would drag their card from the bottom hand area onto the center play area. Possible drop targets are to the right of the last placed card, or even between two cards if we allow insertion. (The physical rules allow inserting between previously placed cards if they realize their number falls in between
arcanewonders.com
. We can support that by showing drop slots between cards on the table as well.)
When a player starts dragging, perhaps we highlight the potential slots they can drop into (like “between card X and Y” positions showing a glow). Other players might see a small indicator that “Alice is placing a card...” to prevent confusion.
Once the player drops their card into a slot, that card flips face-up to reveal the number immediately (in true sequential mode). The game logic will then check if the sequence so far is correct. We will display the revealed number on that card in the sequence. If the number is in correct order relative to its neighbors, the game continues. If not, we immediately flag a failure.
Immediate Feedback: In sequential mode, because each placement is judged on the spot, our UI will give instant feedback:
If the placed card’s number is higher than the one to its left (and lower than the one to its right, if inserting in middle), we might show a quick positive animation (e.g. the card emits a small “success” glow or a sound). The revealed card stays on the table and the next player can then make a move.
If the card was out of order (i.e. a failure), we will highlight it in red or show a breaking animation (maybe the card shakes or an “X” icon appears). At that moment, the round would end in failure – we’d transition to the result screen (or a fail prompt) without waiting for more placements. The UI needs to handle this abrupt end: likely by revealing all remaining cards (to show what went wrong) or by providing the option to continue (since the app has a “continue after failure” option
GitHub
, see below in Results).
Turn Guidance: Although sequential doesn’t have a strict turn order, the UI can gently guide who might go next. For example, after one card is placed, the players will discuss who has the next smallest number. To assist, we could highlight the player who gave the smallest-sounding clue as a suggestion (but that might give away too much or be seen as the game guiding strategy, which we might avoid). Instead, we will rely on players discussing. However, to facilitate smooth play: once a card is successfully placed, we could temporarily highlight the next slot on the right as “ready for the next card” (a pulsating outline indicating “place the next highest card here”). This at least focuses everyone on the idea that someone needs to play a card.
We might also give the host the ability to “spotlight” a player if needed (not in rules, but as a moderation tool – e.g. the host could click on a player to indicate “you try next”). This is an optional enhancement; otherwise players handle it socially.
Confirm/Undo: Unlike sort mode, we don’t wait for all confirmations here. There is no “confirm order” step for each player; instead the act of placing the card is the confirmation of their guess. We also don’t have a collective finalize button in sequential – the round ends when the last card is placed successfully (all numbers in sequence) or when a wrong placement occurs. However, we might still use the bottom panel for a “Place Card” action. For players who are less comfortable with drag-and-drop or in scenarios where insert positions are small, we could allow a player to click a “Place Card” button which then maybe highlights allowable drop spots and they click to confirm a position. But drag-and-drop is more direct, so we assume that primarily.
Others’ View: While one player is dragging their card, others should see something happening to avoid confusion. Ideally, we show a placeholder card moving on their screens too. E.g., if Alice grabs her card to insert it, Bob and Charlie’s view might show Alice’s card icon moving into that position (with maybe Alice’s name label) before it’s released. This way the UI feels synchronous. After placement, everyone sees the revealed number.
The sequential mode UI emphasizes one-at-a-time drama. Each reveal is a mini-event. The interface should make it easy to identify the sequence on the table and what has been played. We will keep all placed cards visible in the center in their order. For example, after a few turns, you might see: [0] [card: 12] [card: 37] [card: ??] [??] ... (with two placed numbers revealed as 12 and 37, and slots for remaining unknown cards). Actually, we won’t show “??” for unplaced – just empty space or a subtle marker for next position. The already placed cards (12, 37) will show their numbers and maybe the player’s color or initial on them (to know who placed what – not critical, but could be interesting knowledge). If insertion is allowed, we handle that by shifting cards aside when a new one is dropped in the middle. Thanks to our grid layout, even as cards are added, the center panel’s height is fixed and will not cause page push; it may wrap to a new row if too many cards to fit one line, but usually sequential placement can also be visualized in a single row by scaling down card size dynamically. We will test with up to 10 cards plus the zero card. In sequential mode, once the final card is placed correctly (or a fail happens early), we proceed to the result as appropriate.
Result & Reveal Screen
After the ordering phase, the game transitions to a reveal and result stage to check if the team succeeded. The UI now needs to show all the actual numbers on the cards and indicate win/lose, plus provide options for next steps.
Final Reveal Animation: We’ll use a dramatic reveal animation for the numbers. In sort mode, this happens all at once at the end (when host clicks “Reveal Result”). All face-down cards will flip over in sequence, typically from lowest to highest. We can animate one card flipping at a time, left to right, perhaps with a brief pause between each to build suspense
GitHub
. As each card flips, its number is shown. We could also play a short sound for each flip. Since this is cooperative, there’s no adversarial tension, but players will watch carefully to see if the sequence is correct. We will incorporate Framer Motion or Chakra’s useAnimation to make this smooth (the current app mentions using Framer for reveal
GitHub
). In sequential mode, if we haven’t already been revealing, we would now flip any still face-down cards (if, for example, the app waited until now to reveal or if some were not placed before failure). Typically in sequential, by the end all placed cards are already open, so the “reveal” might just be confirming the last card or simply proceeding to result evaluation. Either way, we ensure all numbers are visible to the players at this stage.
Success Case (Win): If all numbers ended up in correct ascending order, the UI will celebrate the success. Once all cards are revealed and it’s verified the order is correct, we show a “Success!” message. This could be a banner in the center panel, or even an overlay that pops up with joyful animation. For example, a big text “Correct Order! You Win!” could appear, accompanied by confetti falling across the screen
uxdesign.cc
 and maybe a cheerful sound or a graphic (like a trophy or fireworks). The revealed number sequence can remain visible below this, possibly with a subtle highlight or glow on each card to indicate they were correctly placed. We might also show a subtext like “Great job! You successfully linked all the numbers.” emphasizing the cooperative achievement. Along with celebrating, we provide a button for the next step. The host (or all players) will see a “Play Again” or “Next Round” button. Clicking this would start a new round (likely resetting to the lobby or directly dealing new numbers and a new category). We’ll make the “Play Again” button prominent (the host’s bottom panel could have it, or center of the screen). If the game supports a Challenge Mode (increasing difficulty, like one player getting two number cards)
arcanewonders.com
, we could offer that as well – e.g. a button “Challenge: Play another round with increased difficulty” – this would be a nice optional prompt to keep playing in a harder mode. The UI could explain the twist (“One player will get two numbers!”) if we include this. However, if not implementing that, simply a restart is fine. The other players might have a smaller note “Waiting for host to start a new game” until the host decides to play again or everyone leaves.
Failure Case (Lose): If the numbers were not in correct order, the result screen will indicate a failure – but in a constructive, encouraging way (since it’s a party game, failure is part of the fun, not a harsh defeat). After reveal, the UI will highlight where things went wrong. For instance, the first pair of cards that are out of order could be marked with a red outline or an “✘” between them. If we want to be very clear, we could display a message like “Oops! The sequence was broken here.” near the spot. All numbers are now visible, so players can discuss “Ah, we placed 72 before 65, that was the mistake.” The interface might subtly animate the incorrect cards (e.g. a shake or a bounce to draw attention to the error). Then we display a “Not Quite!” or “Incorrect Order” message. It’s important to keep the tone light: maybe a playful message like “Close, but not in order. Better luck on the next try!” Because the app allows a Continue after failure option
GitHub
, we will support that. On a failure result, the host is presented with a “Continue” button in addition to “Play Again”. “Continue” in this context means the players will get another chance with the same numbers and clues, without reshuffling, essentially letting them re-attempt the ordering
GitHub
. The UI will clarify this: perhaps a note, “You can adjust and try ordering again with the same clues.” If the host clicks Continue, the game will reset to the ordering phase: we would hide the revealed numbers again (or maybe leave them? But likely hide to maintain challenge) and let them drag the cards again. We must ensure the UI seamlessly transitions back: likely we’d grey out the result message and slide the view back to the arrangement board. The clues remain visible, and players now know roughly where the mistake was, so they can reposition accordingly. This is a somewhat forgiving feature to keep the fun going, and our design accommodates it by basically looping back one phase with state preserved. If instead the host chooses “Play Again” (fresh game), we reset everything: new number distribution, new category, etc. That would take us back to the theme reveal for a new round (or to the lobby if we want to allow changing mode or players).
Results Display: Regardless of win or lose, the center panel will show the final lineup of numbers clearly. We might redesign the card appearance now to differentiate from face-down. For example, during reveal we flip them to a bright side with the number in large text. We can keep those cards on screen in the order they were arranged, as a sort of verification display. If successful, they’re essentially 1–100 sorted (some subset); if failed, they’re the guess order with highlights on wrong order. This helps players visually confirm and talk about it (“We put 65 too high”). The chat panel is still available if players want to type reactions or “gg”. The player list could also indicate something like final ranks or maybe show the numbers next to each player’s name now (since the game is over, secrets can be revealed – e.g. Alice – 72, Bob – 5, etc.). This can be done by temporarily showing the number in the player list entry, perhaps in parentheses or a badge. It’s a nice way to tie the result back to each person (“So Alice had the 72! Her clue makes sense now.”).
UI Reset: In preparation for a new game or round, we’ll ensure all states (clues, ready flags, etc.) are cleared appropriately. The “Play Again” process will re-use the consistent layout – likely taking players to a fresh lobby or directly dealing new numbers. Our design allows for the game flow to repeat without any page reloads: everything is contained in the app shell.
During the result phase, we particularly emphasize expressive visual feedback. Success gets a jubilant treatment (confetti, positive colors like gold or green) and failure is indicated but with a friendly tone (maybe a comic “doh!” animation or a retry encouragement). This emotional payoff is important to make the game feel rewarding regardless of outcome. The UI thereby amplifies the social experience – celebrating together or laughing off a mistake – which is exactly what a party game UI should do.
Persistent UI Elements & Feedback
Across all phases, certain UI elements and feedback mechanisms persist to keep the experience smooth:
Chat Panel: The chat (right panel) is always accessible. Even during intense phases like sorting or sequential placement, players might use it. We ensure the chat input is never obscured by other UI. On smaller screens or if space is tight, we might allow collapsing it, but on desktop it stays open by default. The chat log background will be slightly transparent or a different shade to not steal focus, but readable when you look. New messages might use a subtle highlight to draw attention if players are focused on center. This way, coordination via text is always an option.
Player List Panel: The left panel always shows who’s in the game. We update this panel’s content according to phase: In lobby it might show idle status; in clue phase it shows clues; in ordering it might show confirm status or turn indicators. This panel uses a consistent card style for each player row (a small border and background) to separate them. It’s labeled (maybe an overall heading “Players” at the top of it). If a player disconnects or leaves, we’d remove or grey-out their entry in this list in real time, with the layout adjusting gracefully. The design accounts for dynamic changes in player count mid-game (though typically not allowed mid-round, but just in case).
Responsive Font & Container Behavior: Throughout the UI we apply the “fluid typography” and flexible container rules from our style guide. For example, we won’t set a container to an inflexible px width that could overflow; we use Chakra’s responsive props. We also rely on minH="100dvh" for the app container to include browser UI height correctly (especially on mobile)
GitHub
. We avoid using 100vh which can cause jumps on some devices. These under-the-hood choices ensure the UI doesn’t suffer from the prior issues like subtle scrollbars or reflow jumps. (For instance, using minH="100dvh" plus auto-sizing rows fixed the earlier overflow bug where a 56px fixed header + 160px footer didn’t account for DPI scaling
GitHub
.) All new components will be built with these lessons: no fixed pixel heights for dynamic content, no global CSS hacks – just Chakra’s layout system and theme constants for spacing so everything lines up neatly.
Accessibility Considerations: We will label regions and buttons so that even if someone is using a screen reader or just for good practice, the interface is understandable. For example, the left panel can have role="region" aria-label="Players list"
GitHub
, the center aria-label="Game board" etc., to allow landmark navigation. Buttons like “Start Game” or “Reveal Result” will have descriptive labels. Color contrast for text will be checked (using Chakra’s default theme which is typically accessible, and adjusting if needed). We’ll also respect the prefers-reduced-motion setting: if a user has that, we’ll minimize animations (Chakra allows conditionally disabling them, or we can use @media (prefers-reduced-motion) in CSS)
GitHub
. While these details might not be visible at a glance, they contribute to a polished, professional product feel.
Polish & Micro-Interactions: Little touches will make the UI delightful. For example, hover effects on interactive elements: cards might lift slightly or glow when you hover (indicating you can click/drag). When a clue is submitted, perhaps a tiny sound “woosh” plays or the input field could animate out to show it’s done. When dragging cards, maybe a slight rotation on the card adds a physical feel. None of these will be overdone or affect function, but they add to the “game feel” which is crucial in party games. It should feel fun just to interact with the UI, even moving a cursor around.
By rebuilding the interface with these elements in mind, we end up with an ITO game UI that is engaging, user-friendly, and robust. It harnesses Chakra UI v3’s capabilities for a responsive and theme-consistent design, while drawing on console game UX wisdom to create a lively social gaming environment. Every screen – from the lobby, to clue giving, to the thrilling reveal – is crafted to be self-explanatory and enjoyable, requiring no external instructions to understand. The new design fixes previous layout flaws (no more overflowing panels or misaligned sections) by using a well-defined grid and adhering to the style guide’s best practices
GitHub
. In essence, the redesigned ITO frontend will look and feel like a professional party game application: balanced in layout, joyful in presentation, and crystal clear in communicating the game’s logic at each step. Players can then fully immerse in the creative fun of Ito, with the UI seamlessly facilitating the experience rather than getting in the way.
References and Sources
ITO Game concept and rules (Arcane Wonders/Tokyo Chase) – cooperative hint-based ordering game
tokyochase.com
tokyochase.com
Internal Design Guidelines (Chakra UI v3 usage, responsive layout) – emphasizing token-based design, no fixed heights, and container-based grid
GitHub
GitHub
Layout structure from project documentation – full-screen AppShell grid with header, 3 columns, and bottom hand row
GitHub
GitHub
Nintendo UX principles – focus on bright, readable interfaces and playful interactions
reddit.com
uxdesign.cc
Chakra UI component usage examples from code (for consistent styling of cards, buttons, lists)
GitHub
GitHub
.
引用
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L76-L83
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L7-L15

How Has the UI in Nintendo's Recent Games Affected Your Enjoyment of Their Game's Respective Art/Aesthetic Design? : r/nintendo

https://www.reddit.com/r/nintendo/comments/rsnrjm/how_has_the_ui_in_nintendos_recent_games_affected/

Nintendo & designing humanly. I remember this one time, I was about 9… | by Madeline Ní Coileáin | UX Collective

https://uxdesign.cc/nintendo-designing-humanly-984626b64892?gi=be52419426b7

Nintendo & designing humanly. I remember this one time, I was about 9… | by Madeline Ní Coileáin | UX Collective

https://uxdesign.cc/nintendo-designing-humanly-984626b64892?gi=be52419426b7
GitHub
DESIGN_LAYOUT_DIAGNOSIS.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/DESIGN_LAYOUT_DIAGNOSIS.md#L17-L25
GitHub
DESIGN_LAYOUT_DIAGNOSIS.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/DESIGN_LAYOUT_DIAGNOSIS.md#L10-L19
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L70-L78
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L84-L88
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L80-L88
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L36-L44
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L31-L39
GitHub
RoomCard.tsx

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/components/RoomCard.tsx#L50-L59
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L42-L47
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L48-L56
GitHub
RoomCard.tsx

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/components/RoomCard.tsx#L30-L38
GitHub
RoomCard.tsx

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/components/RoomCard.tsx#L50-L58

Ito Card Game | Tokyo Chase

https://www.tokyochase.com/articles/ito-card-game

https://www.arcanewonders.com/wp-content/uploads/2024/09/ito_Rules_V2.pdf

https://www.arcanewonders.com/wp-content/uploads/2024/09/ito_Rules_V2.pdf

ito – Cooperative Strategy Card Game for Ages 8+ | 2–10 Players ...

https://www.amazon.com/Arcane-Wonders-ito-Strategy-Players/dp/B0DLVFNHD7

Ito Card Game | Tokyo Chase

https://www.tokyochase.com/articles/ito-card-game
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L20-L25
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L22-L25
GitHub
Participants.tsx

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/components/Participants.tsx#L44-L53
GitHub
Participants.tsx

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/components/Participants.tsx#L52-L59

https://www.arcanewonders.com/wp-content/uploads/2024/09/ito_Rules_V2.pdf
GitHub
STYLE_GUIDE.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/STYLE_GUIDE.md#L58-L61
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L37-L39

String Theory – An ito Review - Player Elimination

https://playerelimination.com/2025/02/03/string-theory-an-ito-review/

https://www.arcanewonders.com/wp-content/uploads/2024/09/ito_Rules_V2.pdf
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L36-L39

https://www.arcanewonders.com/wp-content/uploads/2024/09/ito_Rules_V2.pdf
GitHub
README.md

https://github.com/riffluv/ito/blob/11b4da00253cf16aa15df1d5fbc6716c8680fef0/README.md#L90-L94
すべての情報源

github

reddit

uxdesign

tokyochase

arcanewonders

amazon

playerelimination