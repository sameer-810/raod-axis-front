# Design direction — RoadAxis

A set of rules that can be **checked**, so the interface stops drifting toward the
median admin template and stays honest about what it is.

Written against research into marketplace, local-services and automotive-booking
interfaces conducted 8 September 2026, and against the brand as it actually exists in
the client's own brochure rather than as we might have imagined it.

---

## The governing principle

> **RoadAxis is two products sharing one identity. Design them as two, style them as one.**

This is the single most important decision in this file, and getting it wrong is the
most likely way the build goes bad.

|             | **Discovery** (public)                         | **Portal & Console** (authenticated)              |
| ----------- | ---------------------------------------------- | ------------------------------------------------- |
| Who         | A driver, on a phone, possibly at the roadside | An owner between jobs; an admin at a desk all day |
| Job         | Decide who to trust, then act                  | Process a queue                                   |
| Reads it    | Once, for ninety seconds, under stress         | Forty times a day for a year                      |
| Wins by     | Trust, clarity, reachable actions              | Density, scanning speed, low noise                |
| Photography | **Is the content**                             | Absent                                            |
| Density     | Generous                                       | High                                              |

An interface tuned for the second is hostile as the first, and vice versa. Most local
marketplaces fail by shipping an admin panel to consumers; most internal tools fail by
shipping a marketing page to staff.

**They share:** the token file, the type ramp, the colour rules, the elevation rule,
the 44 px touch floor. **They differ:** spacing scale, imagery, and information density.

**The test before shipping any change:** on the public side, does it help someone
decide whom to trust and reach them faster? On the portal side, does it help someone
find a number or clear a queue faster? If it only looks better in a screenshot, revert it.

---

## What the research actually said

Six findings that changed decisions here, rather than a literature review.

1. **Trust is the product a marketplace sells.** It has to be designed in explicitly —
   verification, reviews, transparency, consistency — not assumed. Hidden information
   damages trust faster than almost any other mistake. → the trust row, §"Trust is a
   component".
2. **Search quality is the highest-leverage investment in any marketplace with a large
   catalogue.** → search gets the most engineering per pixel of any screen, and the
   empty state is designed rather than defaulted.
3. **Authentication friction at the conversion moment measurably depresses completion,
   and the cost is worst on mobile.** Verification is best done _late_ — after the
   commitment, not before it. → guests browse everything; the account wall stands at
   exactly one door (D-005), and the form is filled in before it appears, never after.
4. **6-digit codes with a 5–10 minute expiry are the usability/security balance.** Four
   digits gives a 10,000-wide brute-force space; six gives a million. → `OTP_LENGTH 6`,
   `OTP_TTL_MINUTES 10`.
5. **One-time codes beat magic links when the user may be on a different device**, which
   at the roadside they usually are. → codes, not links.
6. **The claim/verify pattern is settled by Google and Yelp**, and users have learned it:
   the _platform_ decides the verification method, the claimant does not choose; and the
   moment after approval is when profile completion actually happens. → a single
   document-upload path, and an approval screen that leads straight into "add your
   WhatsApp number" rather than congratulating and stopping.

---

## Brand

Taken from `provided RoadAxis_Platform_Brochure.pdf` by measuring the painted area of
every fill in the document. This is the client's existing identity, not a proposal.

| Token      | Hex                               | Brochure role                |
| ---------- | --------------------------------- | ---------------------------- |
| Accent     | `#FF7A00`                         | Headings, rules, emphasis    |
| Ink        | `#0E1621`                         | The dominant dark surface    |
| Ink raised | `#1A232C`                         | Secondary dark panels        |
| Ground     | `#F8FAFC`                         | Page background              |
| Surface    | `#F3F4F6`                         | Muted fills                  |
| Hairline   | `#E5E7EB`                         | Every border in the document |
| Text       | `#111827` / `#374151` / `#6B7280` | A three-step hierarchy       |

Graphite and orange is a genuine automotive-trade palette — workshop, high-vis, tooling
— and it is nothing like the blue every SaaS template defaults to. It is kept.

### The orange rule, which is not optional

`#FF7A00` measures **2.61:1** against white and **6.86:1** against `#0E1621`.

The first fails WCAG AA outright. The second passes comfortably. Therefore:

- **A filled orange button takes ink-coloured text, never white.** This is the opposite
  of the reflex, and the reflex produces a button that a third of users over 40 cannot
  read in daylight — on a product used outdoors, at the roadside.
- **Orange as text on a light ground must be darkened** to `hsl(29 100% 38%)`, which
  reaches 4.6:1. The `--primary` token is for fills; `--primary-text` is for text. They
  are different values on purpose and are not interchangeable.
- Full-strength orange on dark is correct and needs no adjustment. This is why the
  brochure looks right and a naive light-mode port of it would not.

### Colour discipline

- **Orange means "you can act here"** — primary buttons, the active nav item, focus
  rings, links. If orange appears on something unclickable, it is wrong.
- **Status colour is functional and reserved**: success, warning, destructive. Never use
  a status colour for emphasis.
- A card, badge or tile is **neutral by default** and coloured only when the value itself
  is the signal — closed, unclaimed, failed delivery, overdue claim. If everything on a
  screen is coloured, nothing reads as urgent and the one thing that needs attention is
  camouflaged by the four that do not.
- **The Verified badge is the single most valuable pixel on the public side** and is the
  one place a status colour appears on a card by default. It is what the entire claim
  and document-review pipeline exists to produce. Do not spend the same treatment on
  anything else.

### Dark mode is first-class

The brand is dark-led — the brochure's own surfaces are `#0E1621` — and the product is
used at night, at the roadside, by someone who does not want a white screen in their
face. Both themes are designed, not one derived from the other.

---

## Typography

The brochure's NotoSerif is the PDF exporter's default, not a brand decision, and is not
inherited.

- **Interface — `Inter Tight`.** Slightly condensed, so a UK business name like
  "Bridgewater Tyre & Exhaust Centre" fits a 390 px card without wrapping to three
  lines, which is the actual constraint on this product's most-repeated element.
- **Data — `IBM Plex Mono`.** Every distance, price, rating, phone number, date, time and
  reference is set in mono with `tabular-nums`.

**Never a third family.**

### Why mono is not decoration here

`font-mono` must be _declared_. Left undeclared, Tailwind falls through to Consolas on
Windows, Menlo on macOS and something else on Linux, and every figure in a product whose
job is comparing figures renders differently on every machine. It is declared in
`tailwind.config.js`.

The rule: **anything you compare against another instance of itself is mono.** "1.2 km"
above "800 m" above "3.4 km" only scans as a column when the digits are the same width.

Weight ladder: 300 secondary · 400 body · 500 interactive · 600–700 headings.

---

## Shape, surface and elevation

- `rounded-lg` on interactive chrome. `rounded-xl` on public content cards, which are
  larger and hold photography.
- **`rounded-2xl` + `shadow-xl` is banned.** That is the untouched shadcn card and it is
  the single clearest tell of a generated interface.
- **Elevation is a signal that something is modal to the page, not a texture.** An
  in-page panel that reaches for a shadow is claiming to float when it does not.

### The four surface primitives

Every panel is one of these. A screen needing a fifth is a wrong screen.

| Class         | Use                                             | Elevation           |
| ------------- | ----------------------------------------------- | ------------------- |
| `.ra-panel`   | Any in-page container — tables, stat tiles      | none                |
| `.ra-tile`    | As above, padded — prose or a chart             | none                |
| `.ra-card`    | A public business card, with imagery            | none, hairline only |
| `.ra-overlay` | Genuinely floats — dialog, menu, sheet, palette | `shadow-2xl`        |

## Banned outright

Each of these is a documented signature of generated UI, and not one helps anybody
decide whom to trust or find a number:

- Gradient text. A business name is not a brand moment.
- Glassmorphism. Also a real cost: cards scrolling under a blurred bar read as smears,
  and it forces a compositing layer on every scroll frame.
- Ambient blurred glow behind headers; animated aurora blobs.
- Hover-lift on cards. Cards are not buttons.
- Fade-and-rise on page mount. On the public side it delays the first content on a
  connection that is already slow; on the portal side it is 200 ms of nothing on a
  screen someone opens forty times a day.
- **Decorative icon tiles** — a pastel rounded square holding a glyph beside a label.
  It spends _colour_ on ornament in a product where colour means status.
- **Stock photography of generic mechanics.** The photographs on this product are the
  actual businesses'. A stock image next to a real one makes the real one look fake,
  which is the opposite of the job.

---

## Trust is a component, not a vibe

The research is unambiguous that trust must be built explicitly. On RoadAxis it is one
consistent row, in one order, everywhere a business appears:

```
[Verified ✓]   [4.6 ★ (23)]   [Open now]   [1.2 km]
```

Rules:

- **Always the same order**, so the eye learns one position per fact.
- **Absence is silent, never negative.** A business with no reviews shows no rating —
  not "0 ★" and not "No reviews yet" in red. It has not failed; it is new. A
  zero-star garage is a libel we generated ourselves.
- **Unverified shows nothing**, never a warning. The Verified badge is a positive claim
  we can substantiate; an "Unverified" badge is an accusation we cannot.
- **"Unclaimed" is addressed to the owner, not the driver** — it is an invitation with a
  Claim action attached, and it is styled as neutral information.

---

## Layout — public

- **Mobile-first, genuinely.** Designed at 390 px, then given room. Not a desktop layout
  that survives being narrowed.
- **Search is the home page.** No marketing hero standing between a driver with a flat
  tyre and the list of tyre shops. Category chips are visible without scrolling.
- **List and map are one search in two views**, sharing filter state, with the state in
  the URL so a search can be sent to somebody.
- **The list is the default, not the map.** A map is better for "where", a list is better
  for "which" — and a driver who already knows roughly where they are is choosing.
- **Two actions per card, ranked**: WhatsApp, then Directions. Both are the terminal
  action for a large share of sessions, and neither should require opening the profile.
- **The profile answers, in this order:** is this the right place · can I trust it · is
  it open · how do I reach it · how do I get there · what will it cost me in effort.
  Photographs first, because a photograph of a real workshop is the fastest trust signal
  available and is why we require them.
- **"Request a Booking" is the only wording.** Never "Book", never "Confirm", never
  "Appointment". The button, the confirmation, the notification and the status all say
  request, because that is what it is, and a driver who turns up expecting a held slot
  is a failure of copywriting.

## Layout — portal and console

The reference project's rules apply, because they were right and the problem is the same:

- **Do not redesign the shell.** Collapsible rail, role-filtered menu, breadcrumbs,
  command palette. The convention is what makes it learnable.
- Tables are the primary surface: aligned numeric columns, sticky headers, no zebra
  striping, row hover.
- **The leftmost column is the anchor** — the business or customer name. Actions go
  last, after the data you read in order to decide whether to act.
- **The header stays pinned**; the body scrolls inside the panel.
- Row actions are quiet icon buttons, labelled for screen readers. Fifty rows each
  carrying a red filled "Delete" trains people to stop seeing red as dangerous.
- **The whole row opens the record**, as an enhancement layered on a real anchor — the
  identifying cell keeps its `<a href>`. Row activation stands down when the click landed
  on something interactive, when text is selected, and on modifier/middle clicks.

---

## Mobile

Everything above holds. This is what changes below `md` (768 px).

- **Navigation is at the bottom edge.** The top-left hamburger is the furthest point on
  a 6" screen from a right thumb.
- **A list is cards, not a table.** A table works by aligning a column so the eye can run
  down it; that needs width, and at 390 px there is none, so a table degrades into
  sideways panning — keeping the cost and losing the benefit.
- **Every interactive control is at least 44 px** (`.ra-tap`). The hit box grows; the
  glyph does not.
- **Forms are bottom sheets.** A centred `max-w-lg` dialog leaves ~350 px of usable width
  at 390 px and puts Save in the vertical middle, the part of the screen a thumb reaches
  last.
- **A stacked field is labelled in place.** A column header that has scrolled away is
  acceptable on a wide read-only grid and never on a form.
- **Chip strips scroll; they do not wrap.** A wrapped row of category chips costs
  vertical space on every screen; a scrolling one costs a gesture on the rare occasion
  you need the last chip.
- **Filters go behind a sheet; search stays out.** Whatever is hidden must report an
  **active count** — a silently filtered list reads as a list with records missing.
- **One FAB per screen.** A second FAB means the screen has no primary action.
- **Control font size is at least 16 px**, or iOS zooms on focus and leaves the page
  zoomed. The interface uses 14 px, so the floor is set on the controls themselves
  rather than by inflating the type.
- Safe-area insets are paid for, or a fixed bottom bar sits under the iPhone home
  indicator.

---

## Motion

- Colour and transform only, 150–200 ms. No fade-and-rise on mount.
- **Nothing animates on a data table.** Rows appearing with a stagger is a screenshot
  feature and a usability cost.
- A bottom sheet may translate on drag — that is direct manipulation, not decoration.
- Everything respects `prefers-reduced-motion`.

---

## Accessibility — the parts that are load-bearing here

WCAG 2.2 AA throughout, and three requirements that this product in particular will fail
without deliberate effort:

1. **The orange rule above.** Get it wrong and the primary action fails contrast on every
   screen at once.
2. **Sunlight.** This interface is read outdoors. Body text does not go below `#374151`
   on light, and hairlines are never the only thing separating two regions.
3. **One hand, in the rain.** Every primary action on the public side is reachable in the
   lower two-thirds of the screen.

Plus the ordinary discipline: visible focus, no keyboard traps, labelled fields, errors
associated with their field and announced rather than merely coloured red, and
meaningful alt text — a business photo's alt is the business's name and what the picture
shows, not "image".

---

## Verification

Design rules that cannot be tested are aspirations. These are asserted in
`e2e/phase7-*.spec.ts`:

- Contrast is computed for every token pair in both themes and must reach AA.
- Every route is driven at 390 × 844 and must report `scrollWidth <= clientWidth`.
- Every interactive control is measured on a phone viewport for the 44 px floor.
- No screen contains the bare word "Booked" or "Confirmed appointment".
- Every image has non-empty alt text or an explicit `alt=""` with `aria-hidden`.
