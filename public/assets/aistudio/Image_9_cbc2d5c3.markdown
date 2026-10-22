---
name: Banca Geek Collector Edition
colors:
  surface: '#12121f'
  surface-dim: '#12121f'
  surface-bright: '#383846'
  surface-container-lowest: '#0d0d1a'
  surface-container-low: '#1a1a28'
  surface-container: '#1e1e2c'
  surface-container-high: '#292937'
  surface-container-highest: '#343342'
  on-surface: '#e3e0f3'
  on-surface-variant: '#d3c5ad'
  inverse-surface: '#e3e0f3'
  inverse-on-surface: '#2f2f3d'
  outline: '#9c8f79'
  outline-variant: '#4f4633'
  surface-tint: '#f7be29'
  primary: '#ffe7ba'
  on-primary: '#3f2e00'
  primary-container: '#ffc531'
  on-primary-container: '#705300'
  inverse-primary: '#785900'
  secondary: '#ffb3b1'
  on-secondary: '#680011'
  secondary-container: '#b20024'
  on-secondary-container: '#ffbdba'
  tertiary: '#bef3ff'
  on-tertiary: '#00363f'
  tertiary-container: '#16e1ff'
  on-tertiary-container: '#00606e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9d'
  primary-fixed-dim: '#f7be29'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5b4300'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b1'
  on-secondary-fixed: '#410007'
  on-secondary-fixed-variant: '#92001c'
  tertiary-fixed: '#a3eeff'
  tertiary-fixed-dim: '#00daf7'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#12121f'
  on-background: '#e3e0f3'
  surface-variant: '#343342'
  fundo-tinta: '#12121F'
  card-dark: '#1A1A2E'
  card-elevated: '#22223B'
  amarelo-pulp: '#FFC531'
  vermelho-gibi: '#D62839'
  papel-antigo: '#F4EBD8'
  cinza-quadro: '#8A8CA5'
typography:
  display-hero:
    fontFamily: Anton
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 60px
    letterSpacing: 0.02em
  display-hero-mobile:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Anton
    fontSize: 26px
    fontWeight: '400'
    lineHeight: 30px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.03em
  headline-sm:
    fontFamily: Anton
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.03em
  title-md:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-badge:
    fontFamily: Anton
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-meta:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system establishes a high-tier digital comic sanctuary tailored for demanding graphic novel collectors, archival enthusiasts, and readers immersed in episodic comic sagas. The design language merges the dramatic gravitas of classic comic book print production with the refined utility of modern premium cinematic streaming interfaces.

Rather than descending into juvenile graphic tropes, the interface treats comic editions as high-value artifacts. It employs deep cinematic ink surfaces, tactical editorial framing, deliberate containment grids, and archival paper tones. The experience balances urgency and immersion: intense high-contrast callouts drive navigation, while subdued dark container structures place full focus on vibrant comic cover art and meticulous reading metadata.

## Colors

The palette is rooted in classic editorial print mechanics adapted for high-density OLED and LCD dark mode environments:

- **Fundo Tinta (`#12121F`)**: The master backdrop layer. Deep, ink-saturated navy-black that prevents pure black visual fatigue while maximizing cover art depth.
- **Card Layers (`#1A1A2E` and `#22223B`)**: Tiered structural surfaces. `#1A1A2E` hosts passive catalog shelves and cards, while `#22223B` serves as hovering states, active panels, or elevated contextual trays.
- **Amarelo Pulp (`#FFC531`)**: The primary brand signifier. Used for rare collection badges, star ratings, issue tracking counters, chronological order tags, and critical brand signatures.
- **Vermelho Gibi (`#D62839`)**: The high-velocity secondary action accent. Dedicated to primary CTAs ("Continuar Lendo", "Ler Agora"), urgent promotional banners, and active reading triggers.
- **Papel Antigo (`#F4EBD8`)**: The dominant reading foreground tone. Emulates aged offset paper stock to reduce eye strain against deep ink tones for headers, body titles, and primary metadata.
- **Cinza Quadro (`#8A8CA5`)**: Structural neutral framing. Applied to secondary narrative summaries, chapter counts, copyright lines, and hairline divider strokes.

## Typography

Typography establishes an intentional contrast between the compressed, bold impact of vintage editorial mastheads and the clinical legibility of contemporary screen UI:

- **Display & Headlines (`Anton`)**: Rendered in uppercase by default to mimic high-impact golden and silver age cover logos. Its condensed vertical stance accommodates dramatic saga headers within compact horizontal bounds. Letter-spacing is slightly loosened (`0.02em` to `0.05em`) to balance optical tension.
- **Body, Navigation & Metadata (`Manrope`)**: A clean geometric foundation delivering high legibility at micro-scales. Handles synopses, reading markers, creator credits, and UI controls without competing against the Anton display headings.

## Layout & Spacing

The layout adapts the horizontal carousel format established by modern video streaming services, recalibrated specifically for portrait-oriented reading materials:

- **Grid Architecture**: 12-column dynamic grid on desktop and tablet; 4-column adaptive system on mobile.
- **Shelf Rail Model**: Horizontal media carousels break outside container gutters on mobile via horizontal snap-scrolling, anchoring edge margins at `margin` while showing partially cut-off neighboring issues to encourage lateral discovery.
- **Aspect Ratio Standard**: Comic cover targets maintain strict vertical ratios (`2:3` for US Golden/Modern format and `3:4` for archival anthologies and graphic novels).
- **Density Control**: Metadata below covers is restricted to 2 baseline rows (Issue/Chronology order and Series Title) using `space-xs` and `space-sm` gaps to maximize vertical density on browsing grids.

## Elevation & Depth

Visual hierarchy does not use diffuse realistic dropshadows, which dilute comic line-art. Depth is defined through surface tiering, hairline containment borders, and high-energy colored rim lighting:

- **Level 0 (Canvas)**: `#12121F` base surface. Non-elevated, absorbs backlighting.
- **Level 1 (Panels & Shelves)**: `#1A1A2E` flat container plane with a `1px` stroke of `rgba(138, 140, 165, 0.15)`. Used for content carousels, meta trays, and modal sheets.
- **Level 2 (Hover & Active Targets)**: `#22223B` surface. Covers scale up (`scale(1.04)`) with an immediate outer rim outline: `1px solid #FFC531` for collectible/rare issues or `1px solid #D62839` for active reading targets.
- **Reading View Overlay**: Reader controls deploy a dark scrim layer (`#12121F` at `88%` opacity with `backdrop-filter: blur(8px)`) over active pages to guarantee UI contrast without obscuring the reading position.

## Shapes

The design system maintains a controlled, editorial shape profile (`roundedness: 1`):

- **Structural Containers & Cards**: Default border radius is `0.25rem` (4px). This soft corner preserves the crisp profile of comic books and raw paper trim while preventing visual harshness on OLED displays.
- **Badges & Meta Chips**: Radius of `0.25rem` (4px) with condensed inner padding, maintaining an authentic ticket/collector sticker feel.
- **Floating Controls & Avatars**: Specialized circular exemptions apply only to floating page turners, back-to-top controls, and user profiles. All primary actionable buttons and media viewports conform to the 4px angular soft corner language.

## Components

### Buttons
- **Primary Action (CTA)**: Surface in `#D62839` (Vermelho Gibi), text in `#F4EBD8`, typography in `Anton` (uppercase, tracked). On hover, brightness escalates by 10% with a solid 1px border of `#FFC531`.
- **Secondary / Shelf Control**: Surface in transparent fill, 1px border in `#8A8CA5`, text in `#F4EBD8`. Active states trigger a `#22223B` background fill.
- **Collector Quick-Action**: Surface in `#FFC531` (Amarelo Pulp), text in `#12121F`, bold typography for critical acquisition or reading checkpoints.

### Badges & Chronology Indicators
- **Rarity Badge**: `#FFC531` background with `#12121F` text in `label-badge` styling. Positioned strictly at top-left of comic cover cards.
- **Chronological Reading Guide Tag**: Minimal pill or rectangle badge with `#1A1A2E` background, `#8A8CA5` border, and text reading "VOL. 01 / ED. 12" in `#F4EBD8`.

### Comic Cards (Vertical 2:3)
- Rendered with an inner media viewport set to 2:3 aspect ratio.
- Border radius of 4px.
- Bottom progress bar overlay for active issues: 3px track in `rgba(244, 235, 216, 0.2)` with a fill bar in `#D62839`.
- Hover/focus reveals a quick-preview tray containing the issue synopsis and a direct "Ler Agora" trigger.

### Input Fields & Search Bars
- Background surface `#1A1A2E`, text in `#F4EBD8`, placeholder text in `#8A8CA5`.
- Border is 1px solid `rgba(138, 140, 165, 0.3)`. Focus state shifts the border directly to `#FFC531` with zero outer glow blur.

### Reading Engine UI (Reader Viewport)
- Floating bottom bar centered over reading canvas with background `#1A1A2E` (semi-translucent with blur), housing a pagination scrubber, layout toggle (single/double page, vertical scroll), and brightness limiter.
- Full viewport anti-copy protection overlays enabled seamlessly with transparent pointer capture bounds.