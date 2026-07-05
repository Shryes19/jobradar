# JobRadar v2 — Redesign Changes

## What Changed

### Visual Identity
- **Font**: Switched from `Inter` to `Plus Jakarta Sans` (display) + `DM Mono` (code/data) for a more distinctive, modern feel
- **Color accent**: Replaced green (`#22c55e`) with violet/purple (`#8b5cf6`) + hot pink secondary — gives the app a unique identity instead of the generic "AI startup green" look
- **Background**: Deeper dark (`#050507` vs `#09090b`) with richer surface layering
- **Logo**: Changed from emoji 🎯 to a geometric `◎` glyph rendered in gradient — feels more like a real product icon
- **Brand badge**: Added `v2` pill to the navbar brand

### Landing Page
- Animated orbital background blobs now float continuously (CSS `orb` keyframe)
- Gradient headline uses a violet → purple → pink → amber ramp instead of green monochrome
- CTA buttons use the violet accent instead of green
- Stats strip redesigned with individual color-coded numbers
- Step cards have a subtle top border gradient shimmer

### Navigation
- Active tab now uses a bottom-border accent line instead of a filled background pill — cleaner, more like a real SaaS nav
- Inactive tabs use a deeper muted color (`--t3` = `#5c5c72`) for higher contrast between states
- Version badge added next to brand name

### Components
- All accent colors migrated from `--green` → `--accent` (violet)
- Chip/badge colors updated from green tones to violet/purple
- Score badges (AI match scores) kept in green (semantic: good = green) for clarity
- Salary/money values kept in green (universal money color convention)
- Interview prep filter pill `active` state: violet instead of green
- Follow-up dates: amber warning color unchanged (correct semantic)
- Settings panel tab active state: violet underline

### CSS Architecture
- Token names simplified: `--text-1/2/3` → `--t1/2/3` for cleaner authoring
- New tokens: `--accent-text`, `--spring` easing, `--t3` for deep mute
- `DM Mono` font family applied to: platform badges, step numbers, prep question numbers, API key inputs
- Removed `--green-glow` in favor of `--accent-glow` (violet)

## Files Replaced
| File | Status |
|------|--------|
| `src/index.css` | ✅ Redesigned |
| `src/App.css` | ✅ Redesigned (complete token + component overhaul) |
| `src/App.tsx` | ✅ Redesigned (new landing copy, icon chars, brand) |
| `index.html` | ✅ Updated (new fonts, meta description) |
| `src/api.ts` | ➡ Unchanged (no modifications needed) |
| `src/main.tsx` | ➡ Unchanged |
| All component files (`UploadCV`, `JobFeed`, `Tracker`, `Dashboard`, `Settings`) | ➡ Drop in as-is — all CSS classes exist in the new App.css |

## How to Apply

1. Replace your `src/index.css` with the new one
2. Replace your `src/App.css` with the new one  
3. Replace your `src/App.tsx` with the new one
4. Replace your `index.html` with the new one
5. Run `npm install` then `npm run dev`

Your component files (`UploadCV.tsx`, `JobFeed.tsx`, `Tracker.tsx`, `Dashboard.tsx`, `Settings.tsx`) need **no changes** — the new CSS uses the same class names, just redesigned tokens.
