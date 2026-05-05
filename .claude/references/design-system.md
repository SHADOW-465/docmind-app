# DocMind — Design System Reference

## CSS Variable Tokens

All colours and spacing use CSS custom properties defined in `src/app/globals.css`. **Never hardcode hex values for UI colours** — always use these tokens.

### Colour Tokens

| Token | Purpose |
|-------|---------|
| `var(--bg)` | Page background |
| `var(--bg-raised)` | Card/panel background (slightly elevated) |
| `var(--bg-sunken)` | Recessed area (inputs, code blocks) |
| `var(--bg-hover)` | Hover state background |
| `var(--bg-active)` | Active/selected state background |
| `var(--text)` | Primary text |
| `var(--text-soft)` | Secondary text (less emphasis) |
| `var(--text-muted)` | Tertiary text (placeholders, timestamps) |
| `var(--border)` | Default border colour |
| `var(--border-strong)` | Prominent border (dividers, active outlines) |
| `var(--accent)` | Brand colour (primary CTAs, active states) |
| `var(--accent-soft)` | Light tint of accent (backgrounds, chips) |
| `var(--accent-deep)` | Darker accent (text on accent-soft bg) |

### Light Mode Values (approximate)
- Background: warm off-white (not pure white) — `#faf9f7` range
- Text: warm dark — `#1a1916` range
- Accent: warm muted red/brick — `#c85a3b` range
- Borders: subtle warm grey

### Dark Mode
Applied via `[data-theme="dark"]` on the `<html>` element (not via `prefers-color-scheme` media query). Toggle in app shell sets this attribute.

---

## Typography

### Font Stack
- **UI text:** system-ui (sans-serif) — all interface elements
- **Serif content:** `.font-serif` (Georgia or similar) — document summaries, chat messages, generated content

### Text Size Scale (Tailwind)
The app uses very tight type sizes for information density:

| Usage | Class | Size |
|-------|-------|------|
| Section headers | `text-sm font-semibold` | 14px |
| Body / chat text | `text-[12.5px]` | 12.5px |
| Labels, metadata | `text-xs` | 12px |
| Chips, badges | `text-[11px]` | 11px |
| Mode labels | `text-[10px]` | 10px |
| Micro labels | `text-[9px]` | 9px |

### Serif Usage
Use `font-serif` class for document-derived content (summary bullets, chat messages, generated output). Regular sans-serif for UI chrome.

---

## Animation Keyframes

Defined in `globals.css`:

| Name | Usage | Applied via |
|------|-------|-------------|
| `fadeIn` | Message appear, content reveal | `animate-fadeIn` |
| `slideUp` | Panel entry, generated content | `animate-slideUp` |
| `shimmer` | Loading skeleton | `animate-shimmer` |
| `pulse` | Typing dots in chat | `animate-pulse` |
| `typing` | Chat thinking indicator | `animate-typing` |

---

## Component Patterns

### Card
```tsx
import { Card } from '@/components/ui/primitives'
<Card className="p-4">content</Card>
```
Renders a bordered rounded container using `var(--bg-raised)` and `var(--border)`.

### Button / Btn
```tsx
import { Btn } from '@/components/ui/primitives'

// Solid (primary action)
<Btn variant="solid" size="lg" icon={<I.Sparkle size={14}/>}>Generate</Btn>

// Ghost (icon button, toolbar)
<Btn variant="ghost" size="sm" icon={<I.Copy size={12}/>}/>

// Outline (secondary action)
<Btn variant="outline" size="md">Cancel</Btn>
```
Sizes: `sm`, `md`, `lg`. All variants use token colours.

### Segmented Control
```tsx
import { Segmented } from '@/components/ui/primitives'
<Segmented
  value={length}
  onChange={setLength}
  options={[
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' },
  ]}
/>
```
Used in GenerateTab for length/tone selectors. Renders a pill-group radio control.

### Tooltip
```tsx
import { Tooltip } from '@/components/ui/primitives'
<Tooltip label="Copy">
  <Btn variant="ghost" size="sm" icon={<I.Copy size={12}/>}/>
</Tooltip>
```

### Chip
```tsx
import { Chip } from '@/components/ui/primitives'
<Chip label="Finance" color="blue"/>
```

---

## Layout Conventions

### Three-Panel Shell
```
flex h-full overflow-hidden
├── DocListPanel   w-60 shrink-0 border-r
├── Viewer         flex-[2] min-w-0
└── AIPanel        flex-1 min-w-0
```

### Panel Inner Layout
All panels use the same structure:
```
flex flex-col h-full overflow-hidden
├── header     px-4 py-3 border-b shrink-0
└── content    flex-1 overflow-y-auto
```

### Scrollbars
- `scrollbar-thin` — thin custom scrollbar (defined in Tailwind plugin / globals)
- `scrollbar-none` — hidden scrollbar (workspace chips strip)

---

## Mode Colour Coding

Document mode is shown as a small uppercase label in the doc list. Colour is set via `var(--accent)`. Mode chips in headers use `Chip` component with `bg-[var(--accent-soft)] text-[var(--accent)]`.

Thumbnail colours for doc cards (in `DocListPanel`):
```ts
const THUMB_COLORS = ['#c85a3b', '#6b7eb5', '#5a8e6e', '#b58b4f', '#8a7a9e']
// assigned by index: doc index % THUMB_COLORS.length
```

---

## Dark Mode Implementation

The dark theme is controlled by a `data-theme="dark"` attribute on `<html>`. The CSS variable values are overridden in:
```css
[data-theme="dark"] {
  --bg: #1a1916;
  --bg-raised: #211f1c;
  /* ... */
}
```

Dark mode state is currently not persisted (resets on page reload). A `localStorage` implementation is on the future features list.

---

## Tailwind CSS 4

This project uses Tailwind v4 which has differences from v3:
- No `tailwind.config.js` — configuration is in CSS via `@theme` directive in `globals.css`
- Arbitrary values still work: `text-[12.5px]`, `w-[26px]`, `gap-0.75`, etc.
- CSS variable tokens work natively in Tailwind v4 classes: `bg-[var(--accent)]`
- The `clsx` utility is used for conditional class merging (not `cn` from shadcn)
