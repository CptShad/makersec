# Themes

MakerSec has one layout and many looks. A theme changes how the site *feels* —
colour, type, corners, decoration — and never what it *says* or where things are.
Visitors pick a theme from the header; their choice is saved in their browser.

Four ship today:

| id | name | idea |
|---|---|---|
| `perfboard` | Perfboard | The default. Cool tones on a dark board: dot grid, corner brackets, a glow, a glitch on the title. |
| `glass` | Glass | Glassmorphism. Frosted, blurred panels floating over soft indigo, pink and teal colour fields. |
| `brutal` | Brutalist | Neo-brutalism. Flat colour, thick ink borders, hard offset shadows that grow on hover. |
| `synthwave` | Synthwave | Neon on a purple night sky, a setting sun and a perspective grid on the horizon; a pastel sunrise in light. |

## The philosophy

These hold in every theme. A theme that breaks one is a bug, not a style.

1. **One layout.** HTML and page structure are shared. A theme is only custom
   properties in `public/style.css` — no theme-specific selectors on components.
2. **Public and private are never confused.** Every theme sets its own private
   accent, and the private instance always keeps the hazard stripe.
3. **Status stays legible.** Working, in progress, magic smoke, shelved, idea and
   draft must be told apart from each other and from body text, in both schemes.
4. **Monospace means data.** Post numbers, dates, tags, parts lists and code stay
   in `--mono` everywhere. Only headings (`--font-display`) may change face.
5. **Dark and light both work.** The scheme toggle is independent of the theme, so
   every theme defines both.
6. **Diagrams follow the theme; their meaning doesn't.** Canvas and node colours
   come from the theme. The palette classes authors write (`:::blue`, `:::green`…)
   keep their colours so a diagram reads the same everywhere.

## What a theme can set

Tokens are defined on `:root` by Perfboard. A theme overrides only what it needs;
anything it leaves alone falls through to Perfboard.

**Palette** — `--bg` `--bg-2` `--panel` `--panel-2` `--line` `--line-2` `--ink`
`--ink-2` `--dim` `--accent` `--accent-2` `--accent-soft` `--accent-ink`

**Status** — `--ok` `--wip` `--fail` `--idea` `--dead`

**Type and shape** — `--sans` `--mono` `--font-display` `--radius` `--radius-pill`

**Surfaces** — applied to cards, panels, the search box, tag cards, post neighbours
and the header controls. Perfboard leaves all of these at their "nothing" value.

| token | Perfboard | example |
|---|---|---|
| `--border-w` | `1px` | Brutalist: `2px` (also the header, masthead and post rules) |
| `--shadow` | `none` | Brutalist: `4px 4px 0 var(--accent)`; Glass: a soft drop shadow |
| `--shadow-hover` | `none` | the same surfaces on hover |
| `--panel-backdrop` | `none` | Glass: `blur(16px) saturate(140%)` — pair with a translucent `--panel` |
| `--page-art` | `none` | any `background-image` layered over `--bg`, fixed to the viewport |
| `--title-glow` | `none` | a `text-shadow` on the page and post titles |
| `--menu-shadow` | a soft drop shadow | the open theme menu; Brutalist uses its hard offset shadow |

**Post surface** — puts the article (post and standalone pages) on its own panel, so
long text isn't read straight off a busy background. Off in Perfboard.

| token | Perfboard | panel themes |
|---|---|---|
| `--post-bg` | `transparent` | an opaque or frosted fill, e.g. `var(--panel)` |
| `--post-border-w` | `0px` | `1px`–`2px` |
| `--post-shadow` | `none` | usually matches `--shadow` |
| `--post-pad` | `18px 0 40px` | `30px 36px 40px` |
| `--post-pad-narrow` | `18px 0 40px` | `20px 18px 28px` (screens under 640px) |
| `--post-gap` | `0px` | `40px` below the panel |

**Flourishes**

| token | on | off |
|---|---|---|
| `--fx-perfboard` | `1` — dot grid behind the page, coloured by `--dot` | `0` |
| `--fx-horizon` | `1` — perspective grid rising from the bottom edge, coloured by `--horizon` (Synthwave) | `0` |
| `--fx-brackets` | `1` — corner brackets on post cards | `0` |
| `--fx-lift` | `1` — cards rise 1px on hover (`2` rises 2px) | `0` |
| `--fx-glow` | `8px` — glow on the scheme button's dot | `0px` |
| `--fx-glitch` | `glitch .42s steps(2, end) 1` — title twitch on hover | `none` |
| `--rail` | the accent gradient above the header (public only) | any `background` value |

**Diagrams** — canvas: `--diagram-bg` `--diagram-dot` `--diagram-shadow`
`--diagram-title` `--diagram-radius` `--diagram-node-radius` `--diagram-group-radius`.
Mermaid colours, read by `public/app.js`: `--diagram-node` `--diagram-node-border`
`--diagram-node-text` `--diagram-secondary` `--diagram-tertiary` `--diagram-line`
`--diagram-text` `--diagram-group` `--diagram-group-border` `--diagram-edge-label`.
Set `--diagram-dot` and `--diagram-shadow` to `transparent` for a flat canvas.

## Adding a theme

1. **Register it** in `THEMES` at the top of `src/views.js`:
   `['workbench', 'Workbench', ['#1b1b1b', '#f2a900', '#4aa3ff']]` — id, the name
   in the picker, and three colours for its swatch there. The order is the order in
   the picker.
2. **Add four blocks** to the token section of `public/style.css`, after the
   existing themes and in exactly this order (later blocks win, so the order is
   what keeps private and light correct):

   ```css
   html[data-theme="workbench"] { /* dark: everything you change */ }
   html[data-theme="workbench"][data-scheme="light"] { /* light: every colour the dark block set */ }
   html[data-theme="workbench"][data-mode="private"] { /* --accent, --accent-2, --accent-soft, --accent-ink */ }
   html[data-theme="workbench"][data-mode="private"][data-scheme="light"] { /* the same four, for light */ }
   ```

   The light block must repeat every colour the dark block changed, or dark
   values leak into light.
3. **Check it** in all four combinations — public and private, dark and light —
   on a post with a diagram, and against the philosophy above.

No build step: restart the server or rerun `npm run build`.
