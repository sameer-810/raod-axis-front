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

**Black, white and the logo's red** (October 2026). The client's logo arrived on 15
October — a heavy black wordmark with a red X — and on 24 October the client said the
interface did not look like their brand and looked machine-made. Both were true: the
product was still in the orange of the 2025 brochure, beside a red logo, and set in the
defaults generated pages share. The palette now comes from the logo.

| Token      | Value                                            | Role                                              |
| ---------- | ------------------------------------------------ | ------------------------------------------------- |
| Red (fill) | `#E10600`                                        | Primary buttons, the active tab, "Near me", the X |
| Red (text) | `hsl(2 100% 40%)` light · `hsl(2 100% 66%)` dark | Links and red words                               |
| Ink        | `#111113`                                        | Text; the console rail                            |
| Ground     | `#FFFFFF`                                        | The page and every card                           |
| Well       | `#F4F4F5`                                        | Service tiles, chips, the owners' panel           |
| Hairline   | `#E4E4E7`                                        | Every border                                      |
| Verified   | `#1877F2`                                        | The tick, and nothing else                        |
| WhatsApp   | `#0F7A3E`                                        | The WhatsApp button, and nothing else             |

### The logo

Supplied by the client on 15 October 2026: the wordmark **ROADAXIS** in a heavy italic,
white with a red X (`#FA0101`), on a dark ground. It replaced a placeholder mark drawn
during the build. The two JPEGs are kept in `public/brand/source/`, and everything the
product shows is traced from the dark-ground one:

- `public/brand/roadaxis-wordmark-on-light.svg` and `-on-dark.svg` — the wordmark with
  ink or white letters; the red never changes. `Logo.tsx` draws the same paths inline with
  `currentColor`, so one component serves the light header, the dark rail and both themes.
- `public/brand/roadaxis-mark.svg` (also `favicon.svg`) — the X alone on the ink square,
  for the favicon and the phone topbar, where a 9:1 wordmark cannot fit. The client's
  artwork has no separate symbol; the X is the one part of it that reads at 16 px.

Since October 2026 the logo's red is also the interface's accent (one step deeper, below).
Until then the product was orange beside a red logo, which is what the client meant by
"not our brand".

### The red rule, which is not optional

The logo's red, `#FA0101`, measures **4.14:1** with white text — under AA for the label
of a button. The button red is a step deeper, `#E10600`, at **4.97:1**, a difference
nobody sees beside the logo. As text on the grey wells it is deepened again
(`--primary-text`, 5.4:1). On black, red text is lifted instead (`hsl(2 100% 66%)`),
because `#E10600` is 3.9:1 there. `--primary` is for fills, `--primary-text` for words;
they are different values on purpose. The e2e contrast checks hold all of it.

WhatsApp's own green, `#25D366`, carries 2.0:1 with white; the button uses the same green
deepened to `#0F7A3E` (5.4:1).

### Colour discipline

- **Red means "you can act here"** — primary buttons, the active tab, focus rings, links.
  If red appears on something unclickable, it is wrong. (Destructive actions use the
  same red with a confirmation; they are never the only red on a screen.)
- **Status colour is functional and reserved**: success, warning, destructive. Never use
  a status colour for emphasis.
- A card, badge or tile is **neutral by default** and coloured only when the value itself
  is the signal — closed, unclaimed, failed delivery, overdue claim. If everything on a
  screen is coloured, nothing reads as urgent and the one thing that needs attention is
  camouflaged by the four that do not.
- **The verified tick is the single most valuable pixel on the public side.** Blue,
  beside the name, as it is in every product a person already uses — it should not have
  to be learned. It is drawn only for a business whose claim was approved against a
  document, and blue is spent on nothing else.

### Dark mode is first-class

The brand is dark-led — the brochure's own surfaces are `#0E1621` — and the product is
used at night, at the roadside, by someone who does not want a white screen in their
face. Both themes are designed, not one derived from the other.

---

## Typography

**Barlow**, and its semi-condensed cut for headings. Barlow was drawn from the lettering
on highway signs — the type a driver already reads at speed. It is legible at a glance,
compact enough for "Al Quoz Tyre & Alignment Centre" on a 390 px card, and it belongs to
roads rather than to software, which is the point: the previous faces were chosen to
avoid looking generated and the client still read the result as generated, because the
faces were not _about_ anything.

- **Headings — Barlow Semi Condensed, 700–800**, sitting beside the logo's heavy italic.
- **Everything else — Barlow, 400–600.**
- **Figures — Barlow with tabular numerals.** `font-mono` is mapped to Barlow and
  `.font-mono` switches on `tabular-nums`, so distances, prices and ratings still line up
  in columns without a typewriter face.

**No small spaced-out capitals** anywhere — the public side since October 2026, the
console since Phase 16. The tiny letter-spaced label above a heading is the most copied
device in generated layouts; labels are sentence case, in the body face. The only
uppercase left is initials in avatars.

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

## The home page (October 2026)

Built to the client's reference, in this order, because it is the order a driver needs:

1. **Search** — what, and where, on **one row at every width** (client, 26 October). The
   "where" stays, because a postcode is how a British driver says where they are. On a
   phone the icons go and Search is a magnifier; placeholders are 14 px, typed text 16 px.
2. **Quick filters** — Near me (the one red chip, because it acts), Verified, Open now,
   Map. Each is a real search one tap away, and all four fit a 360 px phone (`.ra-quick`).
3. **Services as the client's icons** — twelve 3D illustrations supplied on 26 October,
   cut out and shown whole on a light plate in both themes. A photo uploaded in the
   console replaces one and fills its frame; a category with neither shows its glyph.
4. **One banner** — black, the car, two red stripes. One, not a carousel.
5. **The garages** — nearest first when the driver has shared where they are, top-rated
   otherwise, and the heading says which.
6. **Own an automotive business?** — the supply side, last: a plain card and one red
   link, as the client drew it.

Distance is a filter a driver may choose, not one they must: a search near a place is
nearest first with no limit until they pick one (D-042).

The garage card answers: what it looks like (photo, "Open now" on it), is it real (tick),
what they do, where, until when ("Closes 7:00 PM", in the garage's own time zone and
clock style), and the two actions — **WhatsApp** in green, **Directions** outlined. The
card lays itself out by its own width (a container query), so two-up in a search grid it
stacks the actions as a phone does.

The bottom bar is Home · Explore · Saved · Profile, red with a bar beneath when active.

## Layout — public

- **Mobile-first, genuinely.** Designed at 390 px, then given room. Not a desktop layout
  that survives being narrowed.
- **…but a desktop layout is not the phone layout at a larger width.** Mobile-first means
  the small screen is never compromised. It does not mean the large screen gets whatever
  falls out — which is what happened, and it put _zero results_ above the fold on a
  1440 px laptop. See DECISIONS.md D-023 for the table of what differs and why.
- **Search is the home page.** The hero _contains_ the search rather than sitting above
  it. The rule is that nothing stands between a driver with a flat tyre and the list of
  tyre shops — that is about the search staying in the first screenful, not about the
  page being plain. Services are one tap away, in a grid, each with its own count.
- **Photography is decorative on the hero and forbidden on a business card.** A generic
  workshop shown on a named garage reads as a photo of their premises, which is a small
  lie about a real company. A listing with no photo gets its trade's icon on a warm
  ground — a designed absence, because absence is the majority state. See D-025.
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
- **The profile's actions never scroll away.** A sticky panel in the right column above
  `lg`, pinned to the bottom edge below it. Someone on that page is deciding whether to
  contact this business, and in a single column "Request a Booking" ends up three screens
  below the decision it serves.
- **"Request a Booking" is the only wording.** Never "Book", never "Confirm", never
  "Appointment". The button, the confirmation, the notification and the status all say
  request, because that is what it is, and a driver who turns up expecting a held slot
  is a failure of copywriting.

## Two countries, one interface

Added 12 October 2026, when the United Arab Emirates joined the United Kingdom
(DECISIONS.md D-036 to D-038). The rule underneath all of it: **the country is shown,
never assumed in silence.**

- **The switch is small and always in the same place.** A globe and "UK" or "UAE" in the
  public header, its accessible name `Country: United Kingdom`. No flags — a flag is a
  picture of a state, not of a language or a customer, and at 16 px it is a smudge. No
  splash screen asking where the visitor is before the site has shown them anything.
  On a deployment serving one country the control is not drawn.
- **A phone field shows the country code it will be read with**, as a fixed prefix inside
  the field, and its hint says how to give a number from somewhere else. A rule the server
  applies invisibly is one a person trips over without being told. A listing's number
  shows the listing's country, whichever side of the site the page is on.
- **The address form changes shape with the country, not just its labels.** The UK has a
  postcode with a lookup. The UAE has an emirate, an area and a map; the map is in the
  form because it is the address. The map's zoom buttons are 44 px like everything else.
- **A pin the site placed says that it did.** "Placed in the middle of Deira, Dubai. Move
  the pin to the exact spot." A position nobody chose, presented as a fact, is the same
  small lie as a rate with nothing behind it.
- **A price is in the money of the garage that set it.** Never converted. The currency
  travels with the listing.
- **In the console, the country is a filter and a column, not a mode.** An administrator
  sees every country at once; narrowing to one shows a chip that says so and can be
  removed. A row's location is its postcode or its emirate, with the country code beside
  it once there is more than one country to tell apart.
- **Figures by country are a table.** Rows are countries, each named in a row header;
  numbers are mono, tabular and right-aligned, heading included, so a column of them can
  be read down. The rows add up to the cards above them and a test holds them to it.

### Opening and pausing a country (D-043)

Console → Countries: one row per served country with an "Open to the public" switch.
Opening is immediate; pausing asks first and says exactly what will disappear (its live
listings, its search and pages, owner sign-up) and what will not (nothing is deleted).
The last open country's switch is disabled, with the reason written under the table. The
public site uses `markets` (open countries); the console's filters and the listing
form use `allMarkets` (every served country, paused ones marked).

## Layout — portal and console

The console is a different product from the public side and gets its own scale. A driver
reads the public pages once, under stress; an administrator lives in these forty times a
day. Density is a kindness here and an obstacle there.

**The shell.** Collapsible rail, role-filtered menu, breadcrumb, command palette. The
convention is what makes it learnable — this is not the place to be novel. Three zones in
the rail: what you are working as (the workspace label under the mark), where you can go,
and who you are. The account menu lives at the foot of the rail, not in the top bar, so
the bar above the content can be about the content.

**Scale.** Tables are 13px, controls 36px on a desktop and 32px where they are secondary.
Below `md` every control becomes the 44px touch floor through one class (`.ra-control`),
so the floor cannot be forgotten on one of them. The visual weight is a desktop decision;
the hit box is a phone one.

**Tables.**

- **The leftmost column is the anchor** — the business or customer name, and it keeps a
  real `<a href>`. Actions go last, after the data you read in order to decide.
- Sticky header, frozen first column with a shadow on the scrolled edge so it reads as a
  layer rather than a seam. No zebra striping; a hairline and a hover tint are enough.
- **Text left, figures right**, in tabular numerals, so a column of dates or counts lines
  up by place value.
- **Row actions are a trailing "⋯" menu, never hover-only** — a control that appears on
  hover does not exist to a keyboard or a thumb. The menu offers only the move the record
  can actually make: a live listing can be suspended, a suspended one restored, and
  neither is ever offered both.
- **Selection brings a bulk bar** that replaces the toolbar in place and names the count.
  It appears only when something is selected.
- **Keyboard: ↑↓ between rows, Enter opens, Space selects** — and only when the row itself
  has focus, or the keydown from a control inside it opens the record by accident.
- **Density is a user setting**, remembered per browser. Compact for somebody clearing a
  400-row import; comfortable for an owner reading five requests.
- **Skeleton rows at the real row height** while loading, so nothing jumps; an empty state
  inside the frame, never a blank panel.
- **Active filters are chips with a clear-all.** A filtered table that looks identical to
  an unfiltered one is how people misread data.

**Panels.** A record opens in a side drawer, not a new page — a reviewer working down a
queue never loses their place. Below `md` the same drawer is a bottom sheet. Everything
modal traps focus, closes on Escape, and hands focus back to whatever opened it.

**Metrics travel in one panel** with hairline dividers, not as a row of four floating
cards. The detached "KPI row" is the single most recognisable template fingerprint; a
grouped strip reads as one instrument.

**The keyboard is a first-class way around.** ⌘K opens search and commands, `g` then a
letter jumps to a section, `?` lists the lot. Every shortcut is discoverable from the
palette, so nobody has to be told.

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

1. **The red rule above.** Get it wrong and the primary action fails contrast on every
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

## The interface does not say things that are not true

A rule that was being broken in four places when Phase 10 found it, each of them a
success message over something that had not succeeded.

- **Never report a message that was not sent.** Approving a claim said "the owner has been
  emailed" with no mail server configured. It now says the email did not go and shows the
  link, because the administrator who just granted the access is the one person who can
  carry it by hand.
- **Ask for what will arrive, and nothing else.** With WhatsApp not connected, sign-in is
  one emailed code — and the page says "Enter your code", singular, with one field and no
  line about a WhatsApp message. A field for a code nobody can receive is a locked door
  drawn to look like an open one.
- **A control that cannot act is not drawn.** A row with no actions has no menu button. A
  request whose driver has been erased has no Call button, where it used to have one that
  dialled nothing.
- **A rate with nothing behind it is a dash.** Unchanged from Phase 6, and extended to the
  measures added since: every one says how many records it rests on, and a cost is never
  quoted from a price nobody set.

Two smaller decisions made in the same phase:

- **The legal line sits under the button, not behind a checkbox.** It says what pressing
  the button means at the moment of pressing it. A tick-box nobody can decline is theatre
  that costs a tap on a phone at the roadside.
- **An administrator arrives on an overview, not a table.** It answers "what needs me
  today" — four figures, what is actually waiting, what just happened — and lists nothing
  that is at zero. A row reading "0 claims" teaches people to stop reading the list.

---

## Verification

Design rules that cannot be tested are aspirations. These are asserted in
`e2e/phase7-*.spec.ts`:

- Contrast is computed for every token pair in both themes and must reach AA.
- Every route is driven at 390 × 844 and must report `scrollWidth <= clientWidth`.
- Every interactive control is measured on a phone viewport for the 44 px floor.
- No screen contains the bare word "Booked" or "Confirmed appointment".
- Every image has non-empty alt text or an explicit `alt=""` with `aria-hidden`.
