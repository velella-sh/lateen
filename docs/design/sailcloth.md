# Lateen sailcloth standard

> **Replaced in part (2026-11-27).** [Design system v2](system-v2.md) replaces the rules "no colored frames" and "no accent change" below, and the hand-written token table maps to the new tokens there. The rest stands until each later task lands.

Visual contract for Lateen. Matches the Untitled HTML mockups.

## Direction

Quiet Foam/Night fields. Lateen Blue for identity and links. Mist as a whisper on labels. Beauty from type, space, and soft light — not glow kits. ("Not frames" is replaced by system-v2.)

Atmosphere uses soft radial washes only. No hard `mask` fade edges on page backgrounds.

## Brand tokens (locked)

| Token | Hex | Role |
| --- | --- | --- |
| Night | `#23212C` | Dark text / dark background / dark buttons |
| Night Raised | `#393743` | Raised dark panels, code |
| Sail | `#DCD7EB` | Text on dark, soft highlights |
| Mist | `#8F8CD8` | Accent for tip labels and charts |
| Mist Edge | `#8481C7` | Hairlines on Foam |
| Foam | `#F4F4F9` | Light page background |
| Foam Sunk | `#E7E7ED` | Inset light surfaces |
| Shell | `#EDE6D8` | Status chips |
| Lateen Blue | `#4C6F9A` | Links and focus (light) |
| Lateen Blue Lift | `#8FB0D4` | Links and focus (dark) |
| Ink Soft | `#4A4658` | Secondary text (light) |
| Sail Soft | `#B7B2C9` | Secondary text (dark) |

Type: **Manrope** for UI and prose. **JetBrains Mono** for code. **Vazirmatn** only for Arabic/Persian samples.

## Stack

Mizzen + Node + TypeScript + Preact + Tailwind CSS + vanilla islands + Lucide + Chart.js.

Author visuals in `styles/src/ui.css`, compiled with Tailwind to `styles/generated.css`, and in Lucide/Chart.js islands.

## Surfaces

~~No colored frames around cards.~~ *Replaced by [system-v2](system-v2.md), 2026-11-27.* Separation from spacing, hairlines, and type. Callouts use a quiet inset edge and kind label color only.
