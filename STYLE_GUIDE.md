# Momentum Health & Wellness: Site Style Guide

This is the rulebook for every page on momentumhealthwellnessmn.com: the home page, the condition landing pages, the test pages, the blog, and anything added later. When a page disagrees with this guide, the page is wrong. When this guide is missing something, add it here first, then build it.

The goal is a site that feels like one calm, credible clinic, not a stack of templates. Fewer colors, one icon set, one header, plain words.

---

## 1. Brand

**Name.** Use **Momentum Health & Wellness** the first time on a page and in the logo. After that, **Momentum Health** is fine. Use **Momentum Health & Wellness Minnesota** only in legal text, the footer copyright, and structured data.

Do not use "Momentum Health & Wellness MN" in visible text. The "MN" suffix currently appears in 14 page logos and should be changed to the full name with "Elk River, Minnesota" as the small line beneath it.

**Doctors.** "Dr. Todd Anderson" and "Dr. Anna Payne" on first mention, then "Dr. Anderson" and "Dr. Payne". Never first names alone.

**Location line.** "Elk River, MN" in short form (top bar, cards). "Elk River, Minnesota" in the logo subline and in body copy.

---

## 2. Color

The site is light-mode only. Colors live as CSS custom properties in each page's `:root` and in `/assets/style.css`. Use the token, never a raw hex value, in new CSS.

### Text

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1A1814` | Headings, strong labels |
| `--body` | `#3A352E` | Paragraph text |
| `--muted` | `#574F43` | Secondary text, captions, card descriptions |
| `--faint` | `#5B5346` | Fine print, legal, timestamps |
| `--gold-text` | `#6B4F17` | Gold-colored text: eyebrows, section labels, links |
| `--gold-deep` | `#5C4413` | Icons, link hover, gold text on cream |

Text values above are from the readability pass (PR #6). All of them pass WCAG AA (4.5:1) on white and on `--cream`.

### Brand gold (fills and lines only)

| Token | Value | Use |
|---|---|---|
| `--gold` | `#C9A84C` | Primary button fill, accent rules, card top borders |
| `--gold-light` | `#E8C97A` | Gradient highlight only |
| `--gold-dark` | `#A07830` | Button hover fill |

**Rule: `--gold`, `--gold-light`, and `--gold-dark` are never used for text.** They fail contrast on light backgrounds. For gold-colored words, use `--gold-text`.

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FFFFFF` | Default page and card background |
| `--cream` | `#FAF8F3` | Alternating section background |
| `--cream-2` | `#F4EEE2` | Footer, tinted bands |
| `--cream-3` | `#EFE6D4` | Strongest tint, used sparingly |
| `--border` | `rgba(26,24,20,0.10)` | Card and divider lines |
| `--border-gold` | `rgba(160,120,48,0.35)` | Highlighted card outline |

### Status

| Token | Value | Use |
|---|---|---|
| `--green` | `#2E9E6B` | Check marks in trust lists only |

No other colors. No blue links, no red alerts on marketing pages, no gradients except the gold button and icon-badge tint.

---

## 3. Type

Two families, loaded from Google Fonts:

- **Playfair Display** (600, 700, italic 600) for headings and display numbers.
- **Inter** (400, 500, 600, 700) for everything else.

Load only those weights. Pages currently request six different weight sets; standardize on:
`family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600`

| Role | Family | Size | Weight | Notes |
|---|---|---|---|---|
| H1 (hero) | Playfair | `clamp(2.1rem, 5vw, 3.5rem)` | 700 | One per page |
| H2 (section) | Playfair | `clamp(1.8rem, 3.5vw, 2.6rem)` | 700 | |
| H3 (card) | Playfair or Inter | 1.15–1.3rem | 700 | Playfair in step cards, Inter in dense grids |
| Section label / eyebrow | Inter | 0.75rem | 700 | Uppercase, `letter-spacing: 0.2em`, `--gold-text` |
| Body | Inter | 1rem (min 0.95rem) | 400 | `line-height: 1.7` |
| Small / caption | Inter | 0.85rem | 400–500 | Never smaller than 0.8rem |

Italics are for emphasis in body copy only. Review quotes are set upright.

---

## 4. Spacing and layout

- **Base unit: 8px.** Use 8, 12, 16, 24, 32, 48, 64, 80.
- **Section padding:** 80px top and bottom on desktop, 56px on mobile, 24px side gutter.
- **Content width:** 1140px for full layouts, 900px for landing pages, 720px for long-form reading (blog, guides).
- **Card padding:** 24px (dense) or 32px (feature).
- **Grid gap:** 12px for symptom lists, 20–24px for cards.

### Corner radius

Four values only:

| Radius | Use |
|---|---|
| 4px | Buttons, inputs |
| 6px | Symptom rows, small chips |
| 12px | Cards, icon badges |
| 999px | Pills and round icon badges |

Pages currently use 2, 4, 6, 10, 12 and 20px. Move 10px to 12px and 20px to 999px or 12px as pages get touched.

---

## 5. Icons

**One set, everywhere.** All icons come from `/assets/icons.svg`, a sprite of line icons on a 24px grid with a 2px stroke and round caps. Most are from [Lucide](https://lucide.dev) (ISC license). `i-thyroid`, `i-hair` and `i-droplet-off` were drawn to match.

**No emoji as icons.** Not in headings, buttons, lists, nav, or footers. Emoji render differently on every phone and are the fastest way to make a page look templated.

### Usage

```html
<link rel="stylesheet" href="/assets/icons.css" />   <!-- in <head>, after the page's <style> -->

<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-phone"/></svg>
```

Icons are decorative: always `aria-hidden="true"`, and the text next to them carries the meaning. Icons take their color from `currentColor`, so set `color` on the container.

### Patterns (styled in `/assets/icons.css`)

| Pattern | Markup | Look |
|---|---|---|
| Inline lead | `<svg class="icon icon-lead">` before a label | Text-size icon with a small gap. Nav phone, top bar, contact rows |
| Symptom row | `<span class="symptom-icon">` | 20px icon, `--gold-deep`, no container |
| Step badge | `<span class="step-icon">` | 56px round tinted badge, 26px icon |
| Numbered step | `<span class="step-icon step-num">1</span>` | Same badge with a Playfair numeral |
| Feature row | `<div class="why-icon">` | 44px rounded-square badge |
| Credential | `<div class="cred-icon">` | 48px rounded-square badge |
| Sidebar fact | `<div class="aside-icon">` | 20px icon, no container |

The home page "Areas of Focus" cards use larger custom duotone icons (32px grid, 1.75 stroke, 22% fill). Keep that style for that section only.

### Buttons get no icons

Buttons are text only. A trailing `→` is allowed on text links ("Read more →"), never on buttons.

### Current icon vocabulary

Reuse these meanings so the same idea always gets the same picture.

| Meaning | Icon |
|---|---|
| Phone call | `i-phone` |
| Text message | `i-message-square-text` |
| Email | `i-mail` |
| Location | `i-map-pin` |
| Fatigue / energy | `i-battery-low` |
| Brain fog | `i-cloud-fog` |
| Anxiety, low mood | `i-cloud-drizzle` |
| Mood swings | `i-cloud-sun-rain` |
| Mental health (general) | `i-brain` |
| Weight | `i-scale` |
| Hair loss | `i-hair` |
| Feeling cold | `i-snowflake` |
| Dry skin | `i-droplet-off` |
| Puffiness | `i-droplet` |
| Water retention, loose stools | `i-droplets` |
| Sleep | `i-moon` |
| Muscle | `i-biceps-flexed` |
| Joints | `i-bone` |
| Heart rate | `i-heart-pulse` |
| Libido | `i-heart` |
| Cycles | `i-calendar-range` |
| PMS | `i-calendar-heart` |
| Hot flashes, heartburn | `i-flame` |
| Bloating | `i-wind` |
| Cramping | `i-waves` |
| Constipation | `i-toilet` |
| Distended belly | `i-expand` |
| Food sensitivity | `i-salad` |
| Gluten | `i-wheat` |
| Sugar cravings | `i-candy` |
| Blood sugar | `i-gauge` |
| Skin / acne | `i-scan-face` |
| Histamine | `i-flower-2` |
| Autoimmunity, infections | `i-shield-alert` |
| Family history | `i-users` |
| Thyroid | `i-thyroid` |
| Medication | `i-pill` |
| Hormones (general), flares | `i-activity` |
| Pain | `i-bandage` |
| Headache | `i-zap` |
| Whole-body pain | `i-person-standing` |
| Digestion (general) | `i-utensils` |
| "Normal labs" / unanswered | `i-circle-help` |
| Diets that don't hold | `i-refresh-ccw` |
| Find | `i-search` |
| Fix | `i-wrench` |
| Stabilize | `i-shield-check` |
| Time with doctor | `i-clock` |
| Functional blood work | `i-microscope` |
| Applied Kinesiology | `i-hand` |
| Natural, root-cause care | `i-sprout` |
| Blood draw | `i-syringe` |
| Lab panel | `i-test-tubes` |
| Stool / breath test | `i-test-tube-diagonal` |
| Urine test (DUTCH) | `i-flask-conical` |
| Mold exposure | `i-house` |
| Targeted test | `i-target` |
| Order / paperwork | `i-clipboard-list` |
| Results review | `i-file-search` |
| Analysis, trends | `i-chart-line` |
| Sit-down visit | `i-messages-square` |
| Degree | `i-graduation-cap` |
| Certification | `i-badge-check` |
| Prenatal / pediatric | `i-baby` |

### Adding an icon

1. Find it at lucide.dev. Copy the inner SVG (the paths, not the outer `<svg>` tag).
2. Add `<symbol id="i-name" viewBox="0 0 24 24">…</symbol>` to `/assets/icons.svg`, keeping the list alphabetical.
3. Add its meaning to the table above.
4. If Lucide has nothing that fits, draw one on the same 24px grid with 2px strokes and no fills.

---

## 6. Components

### Header

One header on every page:

1. **Top bar** (optional, landing pages): cream background, 0.8rem text, `i-map-pin` + "Elk River, MN · Now Accepting New Patients · Text us".
2. **Nav:** logo on the left (Playfair "Momentum Health & Wellness" + small uppercase "Elk River, Minnesota"), phone with `i-phone` on the right. The home page adds the section links and the hamburger at 900px.

There are currently three header variants (home, landing pages, utility pages using `/assets/style.css`). New pages use the landing-page header until they are unified.

### Buttons

| Class | Look | Use |
|---|---|---|
| `.btn-gold` | `--gold` fill, `--ink` text, hover `--gold-dark` with white text | The one primary action in a section |
| `.btn-outline` | Transparent, 1px `rgba(26,24,20,0.33)` border, `--ink` text | Secondary action beside a primary |

Uppercase, `letter-spacing: 0.07em`, 700 weight, 4px radius, 16px × 38px padding. At most one gold button per section. Labels are verbs: "Book First Appointment", "Start as a New Patient", "Free Phone Consult First".

### Cards

White (`--paper`) on a cream section, 1px `--border`, 12px radius. Feature cards may add a 3px `--gold` top border. Hover: border goes to `rgba(160,120,48,0.8)`. No drop shadows at rest.

### Symptom list

Grid of rows, each with a 3px gold left rule, 6px radius, an icon from the vocabulary, and a short symptom name in Title Case. 12–16 items, ending with the "Normal labs, still feel off" row.

### Reviews

Five `★` characters in `--gold`, upright quote in `--body`, reviewer name in `--ink`, "Verified Google Review" badge with a `✓`. Quote real reviews verbatim; never edit or invent them.

### Section label + heading

Every section opens with a small uppercase section label in `--gold-text`, then an H2, then an optional one-to-two-sentence lede in `--muted`.

---

## 7. Voice

- **Talk like the doctor in the room.** Short sentences. Second person. "You've been told your labs are normal."
- **Specific over grand.** "Over 60 markers in one draw" beats "comprehensive cutting-edge testing".
- **No hype words:** revolutionary, cutting-edge, game-changer, unlock, journey, transform your life, holistic wellness solution.
- **No emoji** in copy, headings, buttons, or form messages.
- **No em-dash chains.** One per paragraph at most; prefer a period.
- **Claims stay careful.** "Often", "for many patients", "we look for". No cure language, no guarantees. Keep the FDA disclaimer in every footer.
- **Numbers as numerals** (7-minute appointments, 60 markers, 2 to 3 days).
- **Title Case** for headings and buttons; sentence case for body and captions.

---

## 8. Checklist for a new or edited page

- [ ] Uses the color tokens; no raw hex in new CSS; no gold-family fill colors on text
- [ ] Playfair + Inter only, standard weight set
- [ ] Links `/assets/icons.css`; every icon is from `/assets/icons.svg` and `aria-hidden`
- [ ] No emoji anywhere on the page
- [ ] One gold button per section, text-only buttons
- [ ] Brand name and doctor names follow section 1
- [ ] Radius is 4, 6, 12 or 999px
- [ ] Body text at least 0.95rem; nothing under 0.8rem
- [ ] Checked at 390px wide
