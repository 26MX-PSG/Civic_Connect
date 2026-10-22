# CivicConnect — Design & Build Context (v3)

> Read this before changing anything. It is the single source of truth for the UI, the
> data model and the two chatbots. Version 3 builds on the Team 2 project document
> and the Lovable UI spec (v2), and **adds a General FAQ chatbot and a Scheme chatbot**.

---

## 1. Product in one paragraph

CivicConnect is a bilingual (English / தமிழ்) web app that helps citizens find, understand
and prepare for **15 selected government schemes**. Citizens search or browse, read
benefits and basic criteria, tick a document checklist, save schemes, see profile-based
matches, and ask two chatbots. They then **apply on the official government portal**.
CivicConnect never accepts applications, never uploads documents, and never claims an
official eligibility decision.

**Stack:** HTML5 · CSS3 · JavaScript · Bootstrap 5 · Node.js · Express.js · REST · MySQL.
This package is the **front end**, running on a mock REST layer (`assets/js/store.js`) that
keeps data in `localStorage`. Every mock function mirrors a REST endpoint (section 9), so
the Express API can be dropped in later without touching the pages.

---

## 2. Pages (14 — within the 10–15 limit)

| # | Page | File | Access | Notes |
|---|------|------|--------|-------|
| 1 | Home | `index.html` | Public | Hero search, 6 categories, how-it-works, assistant promo, popular schemes |
| 2 | Login / Register | `login.html` | Public | One page, two tabs, demo-account buttons, `?next=` redirect |
| 3 | Citizen profile | `profile.html` | Citizen | 3-step form, conditional fields, completion ring |
| 4 | Citizen dashboard | `dashboard.html` | Citizen | Matches, tiles, notifications |
| 5 | Categories | `categories.html` | Public | 10 category tiles with photos |
| 6 | Discover (search + results + no-results) | `schemes.html` | Public | Filters sync with URL; no-result searches are logged |
| 7 | Scheme details | `scheme.html?slug=` | Public | 4 tabs, checklist, **Scheme chatbot**, feedback |
| 8 | Recommendations | `recommendations.html` | Citizen | Basic Criteria Match / Partial match groups |
| 9 | Saved schemes | `saved.html` | Citizen | Document progress, remove + undo |
| 10 | Help & FAQs | `help.html` | Public | FAQ search, document guide, **General chatbot (inline)** |
| 11 | Admin dashboard | `admin/index.html` | Admin | Stats, verification overdue, unanswered chatbot questions |
| 12 | Admin schemes | `admin/schemes.html` | Admin | Table + reusable add/edit form (criteria groups, documents, source) |
| 13 | Admin content | `admin/content.html` | Admin | Categories · FAQs · **Chatbot knowledge & test console** |
| 14 | Admin activity | `admin/activity.html` | Admin | Unanswered queries (search + both chatbots) · Feedback · Users · Announcements |

The **General chatbot** also appears as a floating “Ask CivicConnect” button on every
citizen page (except Login and Help, which embeds it inline).

The Team 2 page list (No-Results page, Feedback page, Register page, Admin login, Manage
users, etc.) is covered inside these 14 pages as states or tabs.

---

## 3. Design system

**Personality:** calm, trustworthy public service. No gradients, heavy animation or decorative charts.

| Token | Hex | Use |
|---|---|---|
| primary | `#173B65` | Header, primary buttons, headings, admin sidebar |
| primary-dark | `#0F2A4A` | Hover, footer |
| primary-tint | `#E8EEF6` | Active nav, info boxes |
| accent | `#159D91` / dark `#0F7A71` | Links, Basic Criteria Match, chatbot accents, progress |
| accent-tint | `#E8F6F5` | Icon circles, chatbot “Source” box |
| highlight | `#F3A83B` | Partial match, Demo-data ribbon (background only, dark text) |
| background | `#F7F9FC` | Page |
| border | `#DDE3EC` | Cards, inputs |
| text / muted | `#253247` / `#5A6880` | Body / helper text |
| success / warning / error | `#1E8E4E` / `#B7791F` / `#C2410C` | Status |

* **Fonts:** Inter (English) + Noto Sans Tamil, bundled in `assets/vendor/fonts` (works offline).
  Body 17px desktop / 16px mobile; line-height 1.55, and **1.75 when Tamil is active**.
* **Shape:** cards 12px radius, buttons/inputs 10px, badges pill. One soft shadow.
* **Icons:** Bootstrap Icons, always with a text label.
* **Accessibility:** WCAG AA contrast, 3px teal focus ring, 44px touch targets, labelled
  fields, `aria-live` toasts and chat log, `html lang` switches `en`/`ta`, skip link,
  reduced-motion support. Tamil text wraps — never truncated.
* **Layout:** max width 1200px; mobile bottom nav (Home, Discover, Saved, Profile); 16px gutters.

---

## 4. Reusable components (all in `assets/js/ui.js` + `assets/css/styles.css`)

Header (lang toggle, account menu) · Mobile bottom nav · Footer · Admin sidebar/offcanvas ·
SchemeCard (badges, bookmark, match reasons, doc progress) · CategoryCard / CategoryTile ·
Badges (Central, State, Basic Criteria Match, Partial match, Active, Inactive, Overdue, Demo) ·
SearchBar · FilterPanel (sidebar / bottom sheet) · Tabs · DocumentChecklist · Stepper ·
Completion ring · DataTable · EmptyState · ErrorState (Retry) · Skeleton cards · Toast (with Undo) ·
ConfirmDialog · DisclaimerBox · **Chat panel (shared by both chatbots)**.

---

## 5. NEW — The two chatbots

### 5.1 What each one does

| | General FAQ chatbot | Scheme chatbot |
|---|---|---|
| Where | Floating button on every citizen page; inline on Help | Right column of every scheme page |
| Scope | All FAQs + all 15 scheme pages + document guide | **Only** the open scheme + the document guide (+ FAQs as backup) |
| Typical questions | “Schemes for farmers”, “Where do I get an income certificate?”, “What does Partial match mean?” | “Who can apply?”, “What documents are needed?”, “Where do I get patta?”, “How do I apply?” |
| Unrelated question | Honest fallback + logged as `CHATBOT_GENERAL` | Honest fallback + logged as `CHATBOT_SCHEME` (with scheme id) |
| Other scheme named | Answers about that scheme | Short summary of the other scheme + link to its page |

No AI service is used. It is a **rule-based keyword engine** (`assets/js/chatbot.js`), which suits
the 4-week WAD scope and can be explained and tested in a viva.

### 5.2 Pipeline (every question)

1. **Normalise** — lowercase, strip punctuation, keep Tamil letters (Unicode `\p{L}\p{M}`).
2. **Tokenise** — split into words.
3. **Stop words** — remove filler words (English + Tamil list).
4. **Stem** — `documents→document`, `matching→match`, `schemes→scheme` (English only).
5. **Concepts (synonyms)** — 19 concept groups map everyday and Tamil words to one keyword,
   e.g. `crop, agriculture, kisan, விவசா-, பயிர்` → `#farmer`. Tamil entries match by **word start**,
   so suffixes like `விவசாயிகளுக்கான` still match `விவசா`.
6. **Entities** — scheme names/aliases (`pm kisan`, `புதுமைப் பெண்`, …) and document names
   (`aadhaar`, `patta`, `income certificate`, `ஆதார்`, …).
7. **Intent** — one of: *where to get a document · required documents · eligibility ·
   benefits · how to apply · source & verified · overview*.
8. **Retrieve** — route by entity + intent (5.3); otherwise score FAQs with TF-IDF-style weights
   (question words ×1.6, concept bonus +0.6).
9. **Answer** — the reply, plus **“Keywords found”** chips, the **intent**, and a **Source box**.
10. **Fallback** — nothing relevant → “I couldn’t find this in CivicConnect’s documents, so I won’t guess”,
    with suggestions; the question is saved to `search_queries` for admin review.

### 5.3 Routing rules

General chatbot:
1. Greeting / thanks → canned reply.
2. Document named + “where” intent (or no scheme named) → **document guide** answer.
3. Scheme named → **scheme section** for the intent (documents / criteria / benefits / apply / source / overview).
4. Category concept + (asks for schemes or weak FAQ match) → **list of schemes in that category**.
5. Best FAQ score ≥ 3.2 → **FAQ** answer (≥ 2 if nothing else fits).
6. Keyword search across schemes → “These schemes mention what you asked about”.
7. Otherwise → fallback + log.

Scheme chatbot: same, but restricted to the open scheme. Before answering, it checks for
**unknown words** (words found nowhere in that scheme’s page, the document guide, intents or
synonyms). If there are any and no document was named → fallback + log. This stops wrong
answers like replying to “can I get a laptop?” with the eligibility list.

### 5.4 “Specify where the document is available” — Source format

Every answer ends with a Source box that links to the exact place it came from:

* `Scheme page › PM-KISAN › Documents` → `scheme.html?slug=pm-kisan#documents` (opens that tab)
* `Help & FAQs › Documents › Do I need to upload…` → `help.html#faq-7` (opens that answer)
* `Document guide › Land records (Patta / Chitta)` → `help.html#doc-land_records`
* `Where to get it: TN e-Services ↗` → the issuing office / portal (external)
* `Official source: Ministry of …` ↗ → the scheme’s official source

For documents, the answer itself also says **where to obtain it** (e.g. “Issued by the Revenue
Department. Apply at any e-Sevai centre…”) and whether it is **required or optional** for that scheme.

### 5.5 Bilingual behaviour

Questions can be in English or Tamil. Answers use Tamil fields when Tamil is active
(`short_ta`, `label_ta`, `where_ta`, `a_ta`); English-only fields show a small note
“(இந்தப் பகுதி தற்போது ஆங்கிலத்தில் மட்டும் உள்ளது)”.

### 5.6 Admin side

* **Dashboard** lists the latest unanswered chatbot questions.
* **Activity › Unanswered queries** filters by source: Search / General assistant / Scheme assistant,
  with review status (New, Reviewed, Added to FAQ/scheme, Ignored).
* **Content › Chatbot knowledge & test** shows what the bots read, the synonym table, and a
  **test console** that prints every pipeline step (keywords → concepts → entities → intent → FAQ
  scores → source) for any question. Adding an FAQ immediately teaches both bots.

---

## 6. Matching rules (unchanged from Team 2 doc)

Criteria in the same `criteria_group` must all pass (AND); a scheme matches if any group passes (OR).
Age comes from date of birth. A criterion whose profile field is empty → **Partial match – complete
your profile**. State schemes add an implicit “Lives in <state>” check. Labels are only
**Basic Criteria Match** or **Partial match** — never “Eligible”.

---

## 7. Data model changes for v3 (MySQL)

Everything in the Team 2 model stays. Additions:

```sql
-- where a citizen can obtain each document (used by the checklist, document guide and chatbots)
ALTER TABLE documents
  ADD name_ta        VARCHAR(150) NULL,
  ADD where_to_get   TEXT NULL,
  ADD where_to_get_ta TEXT NULL,
  ADD issuer_url     VARCHAR(500) NULL,
  ADD issuer_label   VARCHAR(100) NULL;

-- one table for search + chatbot questions that found nothing
ALTER TABLE search_queries
  ADD source ENUM('SEARCH','CHATBOT_GENERAL','CHATBOT_SCHEME') NOT NULL DEFAULT 'SEARCH',
  ADD scheme_id INT NULL,                       -- set for scheme-chatbot questions
  ADD CONSTRAINT fk_sq_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id);

-- scheme name variations the chatbots should recognise (e.g. 'pm kisan', 'கிசான்')
CREATE TABLE scheme_aliases (
  alias_id  INT PRIMARY KEY AUTO_INCREMENT,
  scheme_id INT NOT NULL,
  alias     VARCHAR(100) NOT NULL,
  FOREIGN KEY (scheme_id) REFERENCES schemes(scheme_id)
);

-- synonym concepts, editable by admin later (optional; currently in chatbot.js)
CREATE TABLE chatbot_synonyms (
  synonym_id INT PRIMARY KEY AUTO_INCREMENT,
  concept    VARCHAR(40)  NOT NULL,   -- e.g. 'farmer'
  word       VARCHAR(60)  NOT NULL,   -- e.g. 'agriculture' or 'விவசா'
  lang       ENUM('EN','TA') NOT NULL
);
```

The `faqs` table already has `question_ta` / `answer_ta` / `category_id`; the chatbots read it directly.

---

## 8. Categories and the 15 demo schemes

Ten categories, from the Team 2 document: Women welfare · Farmers · Students & education · Healthcare ·
Senior citizens · Employment & skills · Financial support · Differently abled persons ·
Autism & special needs · Transport concessions.

Schemes: PM-KISAN · PMFBY · Ayushman Bharat PM-JAY · CMCHIS · Pudhumai Penn · Tamil Pudhalvan ·
Post-Matric Scholarship (SC) · Kalaignar Magalir Urimai Thogai · PM Ujjwala · IGNOAPS ·
Naan Mudhalvan · PM SVANidhi (set inactive to demo that state) · TN Maintenance Grant for PwD ·
Niramaya · Vidiyal Payanam.

**All are demo data (`is_verified = false`).** No benefit amounts are given; criteria marked
“(demo rule)” are simplified. Verify every field against the official source before marking it verified.

---

## 9. REST API (Team 2 table + chatbot)

All existing endpoints from the Team 2 document stay. The mock functions in `store.js` map 1:1:

| Mock (`CC.store.*`) | Endpoint |
|---|---|
| `schemes({keyword, category, level, state})` | `GET /api/schemes?keyword=&category=&state=` (logs no-result queries server-side) |
| `scheme(slug)` | `GET /api/schemes/:id` |
| `categories()` | `GET /api/categories` |
| `faqs({keyword})` | `GET /api/faqs?keyword=` |
| `login / register / logout` | `POST /api/auth/*` |
| `profile / saveProfile` | `GET / PUT /api/profiles/me` |
| `saved / toggleSave` | `GET / POST / DELETE /api/saved` |
| `giveFeedback` | `PUT /api/feedback/:schemeId` |
| `notifications / markRead` | `GET /api/notifications`, `PATCH /api/notifications/:id/read` |
| `logQuery` | (server-side, inside search and chat endpoints) |
| **`CC.bot.answer(q, {scope, scheme})`** | **`POST /api/chat/ask`** `{ question, scope: 'general'|'scheme', scheme_id? }` → `{ html/text, keywords[], concepts[], intent, sources[{label, href, external}], logged }` |
| **`CC.bot.debug(q)`** | **`POST /api/admin/chat/analyse`** (admin test console) |

To move the chatbot server-side, copy `chatbot.js` functions into `server/utils/chatbot.js`, read
FAQs/schemes/documents from MySQL instead of `CC.store`, and keep the same response shape.

---

## 10. Trust rules (must never break)

* Show source, last verified date and the disclaimer on every scheme page.
* “Demo data – not yet verified” until an admin verifies a scheme.
* Never “guaranteed” / “eligible” wording. Matching is guidance only.
* Chatbots answer **only** from CivicConnect content and always show the source; otherwise they say so and log it.
* Never collect or upload document copies. Checklist ticks stay in the browser.
* Admins see only name, email and account status — never income or disability.

---

## 11. File structure

```
civicconnect/
├─ index.html  login.html  profile.html  dashboard.html  categories.html
├─ schemes.html  scheme.html  recommendations.html  saved.html  help.html
├─ admin/  index.html  schemes.html  content.html  activity.html
├─ assets/
│  ├─ css/styles.css            design tokens + all component styles
│  ├─ js/data.js                seed data (15 schemes, docs, FAQs, users…) + CC.PHOTOS
│  ├─ js/lang/ta.js             Tamil strings
│  ├─ js/i18n.js                language switch
│  ├─ js/store.js               mock REST layer (localStorage)
│  ├─ js/match.js               rule-based matching
│  ├─ js/chatbot.js             both chatbots (engine + chat UI)
│  ├─ js/ui.js                  header/footer/nav + shared components
│  ├─ js/pages/*.js             one script per page
│  ├─ img/placeholders/*.svg    placeholder art
│  ├─ img/hero.jpg, auth.jpg, img/categories/<slug>.jpg   ← your photos go here
│  └─ vendor/                   Bootstrap 5.3.3, Bootstrap Icons 1.11.3, fonts
├─ DESIGN.md   README.md
```

---

## 12. Continuing in Claude Code — suggested prompts

* “Read DESIGN.md. Build the Express + MySQL backend in `server/` following section 9, and replace
  the bodies of `assets/js/store.js` with `fetch()` calls keeping the same return shapes.”
* “Read DESIGN.md section 5. Move the chatbot engine to `server/utils/chatbot.js` and expose
  `POST /api/chat/ask`; update `chatbot.js` `answer()` to call it.”
* “Write `server/db/schema.sql` and `seed.sql` from `assets/js/data.js` and DESIGN.md section 7.”
* “Add Nodemailer notifications for SCHEME_UPDATED, SCHEME_DEACTIVATED, NEW_MATCH and ANNOUNCEMENT.”
