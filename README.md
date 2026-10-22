# CivicConnect — Front end (HTML · CSS · JavaScript · Bootstrap 5)

Bilingual (English / தமிழ்) government-scheme discovery portal with a **General FAQ chatbot**
and a **Scheme chatbot**. 14 pages. Works fully offline — Bootstrap, icons and fonts are bundled.

## Run it

**Option 1 – just open it:** double-click `index.html`.

**Option 2 – VS Code (recommended):** open the folder → install the *Live Server* extension →
right-click `index.html` → **Open with Live Server**.

No build step and no internet connection are needed. Data is stored in your browser (`localStorage`).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Citizen (profile filled in) | citizen@demo.in | demo123 |
| Admin | admin@demo.in | admin123 |

The login page also has one-click **Log in as Citizen / Admin** buttons.
To start fresh: **Admin dashboard → Reset demo data**.

## Try the chatbots

* **General assistant** — the green **Ask CivicConnect** button on any page (also inline on *Help*).
  Try: `Documents for PM-KISAN` · `Where can I get an income certificate?` · `Schemes for farmers` ·
  `ஆதார் எங்கே பெறுவது` · `free laptop` (no answer → logged for admin).
* **Scheme assistant** — on any scheme page, e.g. `scheme.html?slug=pm-kisan`.
  Try: `Who can apply?` · `Where do I get patta?` · `How do I apply?`
* **Admin → Categories, FAQs & chatbot → Chatbot knowledge & test** shows how each question is analysed.
* **Admin → Queries, feedback & users** lists questions neither bot could answer.

## Adding your photos

1. Save JPG files with these exact names:
   * `assets/img/hero.jpg` — home banner (landscape, ~1600×900)
   * `assets/img/auth.jpg` — login side image (portrait, ~900×1200)
   * `assets/img/categories/<slug>.jpg` — one per category (~800×500):
     `women-welfare`, `farmers`, `education`, `healthcare`, `senior-citizens`, `employment-skills`,
     `financial-support`, `differently-abled`, `autism-special-needs`, `transport`
2. Open `assets/js/data.js` and list the names you added at the top, e.g.
   `CC.PHOTOS = ['hero', 'auth', 'farmers', 'education'];`

Anything not listed keeps the placeholder art.

## Important

All scheme details are **demo data** and are marked “Demo data – not yet verified”. Check every
scheme against its official portal before presenting it as accurate.

See **DESIGN.md** for the full design, data model, chatbot logic and backend plan.
