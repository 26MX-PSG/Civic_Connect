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

## Backend (Express + MySQL) — Weeks 5–6

The API lives in `backend/`. The frontend still uses `assets/js/store.js` (localStorage) until the Week 8 integration.

### First-time setup
```bash
cp .env.example .env                 # local dev settings (git-ignored)
docker compose up -d                 # MySQL 8 on localhost:3307 (utf8mb4, so Tamil works)
cd backend
npm install
npm run db:reset                     # creates tables (db/schema.sql) and loads the demo data from assets/js/data.js
npm start                            # http://localhost:3000   (npm run dev = auto-restart)
```
Dev DB login: database `civicconnect`, user `civic_user`, password `civic_pass123`, port **3307**.
Demo accounts (same as the frontend): `citizen@demo.in / demo123`, `admin@demo.in / admin123`.

### Commands
| Command | What it does |
|---|---|
| `npm run db:reset` | Drops and recreates all tables, then seeds. **Wipes data — development only.** |
| `npm run db:seed` | Reloads the seed data only |
| `npm test` | 16 integration tests against the seeded dev DB |
| `node scripts/make-postman.js` | Regenerates the Postman files in `backend/postman/` |

### Endpoints (Weeks 5–6)
Errors always look like `{ "error": { "code", "message" } }`. Send `Authorization: Bearer <token>` for 🔒 routes.

| Endpoint | Notes |
|---|---|
| `GET /api/health` | API + DB status |
| `POST /api/auth/register`, `POST /api/auth/login` | return `{ token, user }`; register always creates a `USER` |
| `GET / PATCH /api/auth/me` 🔒 | current user, language and notification preferences |
| `GET /api/schemes?keyword=&category=&level=&state=` | search (English and Tamil); no-result keywords are logged for admins |
| `GET /api/schemes/:idOrSlug` | full detail, document guide, feedback totals |
| `GET /api/categories`, `/api/categories/:idOrSlug` | active categories with scheme counts |
| `GET /api/documents`, `/api/faqs?keyword=` | document guide and FAQs |
| `GET / PUT /api/profiles/me` 🔒 | profile and completion % |
| `GET /api/recommendations` 🔒 | `matches` (Basic Criteria Match) and `partial` (complete your profile) |
| `GET / POST / DELETE /api/saved` 🔒 | `POST {scheme_id}`, `DELETE /api/saved/:schemeId` |
| `GET / PUT /api/feedback/:schemeId` | totals; `PUT {useful, comment?}` 🔒 (one vote per user, replaceable) |
| `GET /api/notifications`, `PATCH /api/notifications/:id/read` 🔒 | |
| `GET /api/admin/users` 🔒 ADMIN | name, email, status only |

### Postman
Import `backend/postman/CivicConnect.postman_collection.json` and `CivicConnect.local.postman_environment.json`, select the "CivicConnect Local" environment, then run the **Auth** folder first (it stores the tokens), then any other folder.

### Notes
- Seed data is the same **demo, unverified** content as the frontend. Edit `assets/js/data.js` and run `npm run db:seed` to reload it.
- Feedback totals for the seeded demo votes are stored as anonymous rows; real votes need a login.
