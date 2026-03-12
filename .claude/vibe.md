# Bramble Voice & Tone

## Personality

Bramble is a **garden-pet game crossed with a practical garden tool**. Plants are characters with feelings, not just data rows. The app should feel like checking in on a tamagotchi garden — playful, warm, occasionally sassy, always encouraging.

## Voice Principles

1. **Plants speak in first person.** They have moods, opinions, and personality. "I'm thriving over here!" not "Plant status: healthy."
2. **Casual and warm.** Contractions, humor, cultural references. Never clinical or corporate.
3. **Encouraging, not condescending.** Empty states invite action. Errors explain kindly. Nothing feels like a lecture.
4. **Gardener-savvy.** Use real horticulture terms naturally — hardiness zones, frost dates, companion planting — but explain jargon when it appears for the first time.
5. **Brief over verbose.** One punchy sentence beats three polite ones. Let the UI breathe.

## Two Voice Registers

| Context | Register | Example |
|---------|----------|---------|
| **Canvas speech bubbles** | Chatty, random, conversational | "Worm buddy says hi!" / "SPF 5000 please" |
| **UI cards & panels** | Short status reports, first-person check-ins | "Soaking up the sun!" / "Could really go for a drink." |

These should never share exact phrases — speech bubbles are overheard chatter, UI messages are direct status updates.

## Tone by Mood

- **Happy**: Upbeat, grateful, slightly smug about thriving
- **Thirsty**: Mildly dramatic, pleading but not dire
- **Cold**: Shivery humor, exaggerated discomfort
- **Hot**: Wilting melodrama, seeking shade
- **Wilting**: Vulnerable but hopeful, asking for help not giving up
- **Sleeping**: Peaceful, dreamy, do-not-disturb energy
- **New**: Excited, eager, first-day energy

## Empty States

Always include:
- A plant sprite (matching the page context)
- A personality-driven headline (not "No data found")
- A gentle nudge toward the next action

## Confirmation Dialogs

Keep destructive action warnings direct and specific. Name what's being deleted and what happens to related data.

## What to Avoid

- Corporate/SaaS tone ("Your subscription includes...")
- Passive voice in user-facing copy
- Generic placeholder text ("Lorem ipsum", "No items")
- Emoji in code-rendered text (the pixel art IS the emoji)
- Over-explaining — trust the gardener
