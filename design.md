---
version: "alpha"
name: "The Curd Nerd + The Wedge"
description: "A shared visual identity for The Curd Nerd specialty cheese shop and The Wedge cheese-focused restaurant and bar in Eastwood, Syracuse."
colors:
  primary: "#F1C40F"
  on-primary: "#000000"
  primary-bright: "#FFCE1B"
  primary-soft: "#FEE972"
  secondary: "#234058"
  on-secondary: "#FFFFFF"
  secondary-dark: "#172F42"
  espresso: "#421E01"
  on-espresso: "#FFFFFF"
  cream: "#FBFBF9"
  white: "#FFFFFF"
  ink: "#000000"
  oat: "#DBD0BB"
  mustard: "#C5A326"
  peach: "#E7965F"
  tomato: "#CA6E73"
  herb: "#8ABB8C"
  rind: "#BBA580"
  text-muted: "#5B5147"
  border-light: "#D8CDBB"
  border-dark: "#8798A5"
typography:
  display-xl:
    fontFamily: "Playfair Display"
    fontSize: "6.5rem"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.035em"
  display-lg:
    fontFamily: "Playfair Display"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  heading-md:
    fontFamily: "Playfair Display"
    fontSize: "2.625rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  heading-sm:
    fontFamily: "Playfair Display"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
  body-lg:
    fontFamily: "Source Sans 3"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: "Source Sans 3"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Source Sans 3"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label-caps:
    fontFamily: "Source Sans 3"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
  3xl: "96px"
  4xl: "144px"
rounded:
  none: "0px"
  image: "4px"
  control: "6px"
  card: "12px"
  pill: "9999px"
components:
  curd-nerd-button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  curd-nerd-button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  wedge-button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  wedge-button-primary-hover:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.on-espresso}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-secondary-light:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.control}"
    padding: "11px 19px"
    height: "44px"
  button-secondary-dark:
    backgroundColor: "{colors.secondary-dark}"
    textColor: "{colors.white}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.control}"
    padding: "11px 19px"
    height: "44px"
  curd-nerd-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: "24px"
  wedge-card:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.white}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: "24px"
  tasting-note:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-sm}"
    rounded: "{rounded.card}"
    padding: "24px"
  local-badge:
    backgroundColor: "{colors.herb}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  seasonal-badge:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  staff-pick-badge:
    backgroundColor: "{colors.tomato}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  rind-badge:
    backgroundColor: "{colors.rind}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  mustard-badge:
    backgroundColor: "{colors.mustard}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  menu-rule-light:
    backgroundColor: "{colors.oat}"
    height: "1px"
  menu-rule-dark:
    backgroundColor: "{colors.border-dark}"
    height: "1px"
  product-image:
    rounded: "{rounded.image}"
  muted-copy:
    textColor: "{colors.text-muted}"
    typography: "{typography.body-sm}"
  light-border:
    backgroundColor: "{colors.border-light}"
    height: "1px"
  golden-accent:
    backgroundColor: "{colors.primary-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
---

## Overview

The visual system unites two sibling businesses at 2800 and 2802 James Street in Eastwood, Syracuse. The Curd Nerd is a cut-to-order cheese shop and specialty grocer: bright, curious, educational, neighborly, and lightly cheeky. The Wedge is its cheese-focused restaurant and bar next door: intimate, seasonal, convivial, and more refined without becoming formal.

The system should feel tactile and food-led. Let wedges, wheels, rinds, market labels, butcher paper, ceramic plates, linen, and the irregular geometry of a well-built cheese board shape the composition. Never borrow the visual language of technology products, corporate dashboards, or anonymous luxury hospitality.

Use a shared typographic system, photography direction, and editorial grid so the brands clearly belong together. Yellow identifies The Curd Nerd. Navy identifies The Wedge.

The public voice is knowledgeable but accessible. The Curd Nerd's official product stories explain style, milk, maker, flavor, and pairing with genuine enthusiasm. The Wedge carries that knowledge into a warmer, more composed hospitality setting centered on seasonal, cheese-led food and thoughtful drinks.

## Colors

The supplied screenshots are the source of truth for the palette values.

### The Curd Nerd palette

- **Primary (`#F1C40F`):** signature cheese yellow for primary actions and high-energy brand moments.
- **Primary bright (`#FFCE1B`):** a sharper yellow for small highlights and co-branded connective moments.
- **Primary soft (`#FEE972`):** a gentle yellow for educational callouts and tasting notes.
- **Cream (`#FBFBF9`):** the default shop background.
- **Ink (`#000000`):** headlines, body copy, rules, and iconography.
- **Tomato (`#CA6E73`), herb (`#8ABB8C`), rind (`#BBA580`), peach (`#E7965F`):** rotating food-inspired accents. Use no more than two per viewport.

### The Wedge palette

- **Secondary (`#234058`):** signature navy for primary actions, navigation, and evening color fields.
- **Secondary dark (`#172F42`):** deeper navy for high-contrast backgrounds.
- **Espresso (`#421E01`):** warm depth for intimate dining moments and hover states.
- **Oat (`#DBD0BB`):** quiet surface, divider, and menu color.
- **Mustard (`#C5A326`):** restrained culinary accent.
- **White (`#FFFFFF`):** clean contrast against navy and espresso.

Use black text on all yellows and light accents. Use white text on navy and espresso. Never use tomato, herb, rind, peach, or mustard for long-form text. Avoid gradients; appetite should come from photography and material color rather than effects.

For co-branded pages, use cream as the field, navy as the structural color, and yellow as the connective accent. Give both brand names equal visual dignity. Never recolor one identity into the other.

## Typography

Playfair Display supplies the editorial, knowledgeable food character. Use it for page titles, campaign headlines, menu section titles, pull quotes, and tasting notes. Display lines should be compact, specific, and limited to roughly three lines. Use sentence case.

Source Sans 3 keeps navigation, descriptions, prices, ingredients, dates, labels, and transactional controls direct and readable. Use uppercase only for short labels, never for paragraphs or long headlines.

On smaller screens, scale `display-xl` down to approximately `3rem`, `display-lg` to `2.5rem`, and `heading-md` to `2rem`. Maintain the declared line-height relationships.

Fallback stacks:

- Playfair Display: `Georgia, "Times New Roman", serif`
- Source Sans 3: `Arial, Helvetica, sans-serif`

Do not use faux handwritten fonts, monospaced technical labels, ornamental scripts, or generic geometric sans-serif display type.

## Layout

Use an editorial grid with a maximum content width near `1280px`, page gutters between `20px` and `72px`, and section spacing between `64px` and `144px`. Prefer generous margins, strong vertical rhythm, and controlled asymmetry.

Let one food image, headline, menu story, or product feature dominate each section. Alternate useful information density with breathing room. Avoid filling the page with equal-size cards.

Use 4:5 or 1:1 crops for cheese and pantry products. Restaurant photography may use 3:2 or wide editorial crops. Keep mobile reading order simple: headline, context, image, details, action.

The Curd Nerd may use brighter fields, tighter product groupings, and more visible educational metadata. The Wedge should use broader image moments, quieter menus, and more negative space. Wedge-like diagonals and cheese-wheel circles may appear as restrained framing devices, never as repeating clip art.

## Elevation & Depth

Favor flat color fields, fine rules, overlapping photography, and material contrast over visible drop shadows. Cards may use a restrained shadow no heavier than `0 10px 30px rgba(35, 64, 88, 0.10)` when they must lift from the page.

The Wedge may use deeper photographic shadows and warm evening light, but interface surfaces must remain legible. The Curd Nerd should feel sunlit and candid rather than glossy.

Motion should feel like a host revealing a table: calm, deliberate, and useful. Use short text fades, gentle image reveals, and restrained hover shifts. Respect `prefers-reduced-motion`. Do not use parallax-heavy food imagery, scroll-jacking, floating decorative objects, or novelty cursors.

## Shapes

Use the `12px` card radius and `6px` control radius consistently. Image corners remain tighter at `4px`. Pills are reserved for factual tags, filters, and compact status labels—not for every button or container.

Fine rules and rectangular editorial frames should do most of the structural work. Organic food shapes may inspire occasional crops or masks, but maintain a mature, crafted result. Do not make The Curd Nerd childish or The Wedge severe.

## Components

### Navigation

Keep primary navigation short. Separate The Curd Nerd shopping actions from The Wedge menu and reservation actions. On co-branded pages, provide an obvious brand switcher and make the fulfilling business clear before checkout, booking, or inquiry.

### Buttons

Use The Curd Nerd yellow button on cream or white shop surfaces. Use The Wedge navy button on light restaurant surfaces. Buttons use concise, specific verbs such as “Shop cheese,” “See what's in the case,” “Explore the menu,” “Reserve a table,” “Join Cheese Club,” or “View classes.” Avoid “Learn more” when a clearer action exists.

### Product cards

Lead with honest, tactile food photography. Follow with the cheese or product name, producer or origin, milk or style, a specific tasting note, price, and action. Keep card structure editorial and useful rather than dashboard-like.

### Menus

Place dish name and price on the first line with a concise ingredient description below. Separate items with fine oat or navy rules; do not box every row. The Wedge menu should foreground dish, key ingredients, seasonality, and pairing context without becoming verbose.

### Badges

Use short factual labels such as “local,” “raw milk,” “seasonal,” or “staff pick.” Never use color alone to communicate dietary, availability, or allergy information.

### Events and education

Always show title, date, time, price, availability, host, and what guests will taste or learn. Pair an approachable title with practical detail. Keep sold-out events visible and provide the next useful action.

### Photography

Use natural directional light and true-to-food color. Show cut surfaces, rind texture, melting cheese, hands serving, shelves with real abundance, and occupied tables. Balance close tactile details with wider neighborhood and room views. Avoid sterile stock photography, artificial steam, excessive overhead flat lays, oversaturation, and empty staged dining rooms.

## Do's and Don'ts

### Do

- Lead with specific food, maker, origin, flavor, and pairing information.
- Keep expertise welcoming: explain unfamiliar cheese language without gatekeeping.
- Let The Curd Nerd sound enthusiastic, curious, friendly, and occasionally punny.
- Let The Wedge sound composed, sensory, confident, and gracious.
- Use black on yellow and white on navy or espresso.
- Maintain WCAG 2.2 AA contrast, keyboard access, visible focus, and descriptive alt text.
- Keep body text at `1rem` or larger and essential information out of images.
- Confirm live menus, prices, hours, events, sourcing claims, and availability before publishing.

### Don't

- Do not reuse Sentinel naming, authentication patterns, technology imagery, WebGL effects, or SaaS composition.
- Do not turn the interface into a generic grid of identical cards.
- Do not substitute orange for The Curd Nerd yellow or royal blue for The Wedge navy.
- Do not use constant cheese puns, empty superlatives, elitist jargon, nightclub language, or generic fine-dining clichés.
- Do not overdecorate with cheese wedges, dairy icons, or novelty illustrations.
- Do not invent awards, menu items, prices, sourcing claims, hours, or availability.

### Brand voice examples

**The Curd Nerd:** “Meet Hooligan: sticky, stinky, deeply savory—and worth the adventure.” Pair playful hooks with producer, style, milk, tasting, and pairing information.

**The Wedge:** “A changing menu of cheese-led plates, thoughtful pours, and a seat worth lingering in.” Keep the language concise enough to feel like gracious tableside guidance.

### Verified context

Context and voice direction were checked on October 16, 2026 against The Curd Nerd's official Cheese Club and product-story pages, The Wedge's official site, Visit Syracuse, and the City of Syracuse SEDCO description of The Wedge as The Curd Nerd's cheese-focused expansion. The two supplied screenshots remain the source of truth for color values.
