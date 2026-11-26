# CivicConnect — Setup, Admin workflow & Deployment

How to run the whole app **from scratch** on your laptop, how the admin workflow updates the database,
how to set up email, and how to deploy to Railway.

- [1. Run locally from scratch](#1-run-locally-from-scratch)
- [2. Database commands (seed / reset)](#2-database-commands-seed--reset)
- [3. Email (Nodemailer + Gmail)](#3-email-nodemailer--gmail)
- [4. Admin workflow — how the database gets updated](#4-admin-workflow--how-the-database-gets-updated)
- [5. Deploy to Railway](#5-deploy-to-railway)
- [6. Will it work on Railway? (honest status)](#6-will-it-work-on-railway-honest-status)
- [7. Troubleshooting](#7-troubleshooting)

---

## 1. Run locally from scratch

**You need:** Node 20+, Docker (with Compose), Git.

```bash
# 0. open the project folder
cd Civic_Connect

# 1. config file (never commit .env — it is gitignored)
cp .env.example .env
#    Defaults work as-is for local development. Fill the SMTP_* lines later (section 3).

# 2. delete the old MySQL data and start a brand-new database
docker compose down -v          # -v removes the Docker volume = wipes ALL old database data
docker compose up -d            # starts MySQL on 127.0.0.1:3307
docker compose ps               # wait until STATUS says (healthy)

# 3. install, create tables, load demo data
cd backend
npm install
npm run db:reset                # creates all tables and loads the 15 schemes, FAQs, users…

# 4. start the app
npm start                       # http://localhost:3000
```

Open **http://localhost:3000** — the Express server serves both the website and the API
(so do **not** open the HTML files by double-clicking; use this address).
API index: http://localhost:3000/api-docs · Health: http://localhost:3000/api/health

The terminal prints `[mail] SMTP login OK` when email is configured, or `[mail] email OFF — …` when it is not.

### Logins
Login details are not published here. Ask the project team for them.

> With SMTP configured, password-reset emails are really sent to the address you enter.
> Don't test with other people's addresses.

### Run the tests
```bash
cd backend
npm run db:reset && npm test    # 23 tests; uses a fake SMTP server, never sends real mail
```
Run `db:reset` before `npm test` each time (a test resets a demo user's password).

### Stop everything
```bash
# stop the server: Ctrl+C in its terminal
docker compose down             # stop MySQL, KEEP the data
docker compose down -v          # stop MySQL and DELETE the data
```

---

## 2. Database commands (seed / reset)

Run inside `backend/`:

| Command | What it does | Wipes data? |
|---|---|---|
| `npm run db:reset` | recreate all tables **and** load the seed data | **Yes — everything** |
| `npm run db:migrate` | recreate all tables only (empty) | **Yes — everything** |
| `npm run db:seed` | reload seed data into existing tables | **Yes — all rows replaced** |
| `npm run start:prod` | (hosting) create tables + seed **only if the DB is empty**, then start | **No** — never touches existing data |
| `npm run mail:test` | check SMTP login (add `-- you@x.com` to also send a test mail) | No |
| `npm run postman` *(= `node scripts/make-postman.js`)* | regenerate the Postman files | No |

The seed data lives in `assets/js/data.js` (15 schemes, categories, documents, FAQs, demo users).
**Anything an admin changes in the app lives in MySQL, and `db:reset` / `db:seed` will erase it.**
Use them only on a throw-away local database.

---

## 3. Email (Nodemailer + Gmail)

What gets emailed:

| Email | Who receives it |
|---|---|
| Password reset link | the account owner (always, when SMTP works) |
| `NEW_MATCH`, `SCHEME_UPDATED`, `SCHEME_DEACTIVATED`, `ANNOUNCEMENT` | only citizens who ticked **email notifications** on their dashboard. Everyone gets the in-app notification regardless. |

Setup:

1. Google account → turn on **2-Step Verification** → create an **App Password**
   (https://myaccount.google.com/apppasswords). It is 16 characters; your normal password will not work.
   *(College Google Workspace accounts sometimes have App Passwords disabled by the admin — then use a personal Gmail.)*
2. Put this in the root `.env` (no quotes around the password; spaces are ignored):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdefghijklmnop
   SMTP_FROM="CivicConnect <yourname@gmail.com>"
   FRONTEND_URL=http://localhost:3000
   PASSWORD_RESET_TTL_MINUTES=30
   ```
   `SMTP_FROM` must use the same address as `SMTP_USER` on Gmail. Port `465` works too (SSL is switched on automatically).
   **`FRONTEND_URL` is what the reset link starts with** — on a hosted site it must be the public https address.
3. Check it:
   ```bash
   cd backend
   npm run mail:test                       # login check only
   npm run mail:test -- yourname@gmail.com # also sends a real test mail (check Spam)
   ```
4. Restart `npm start` (`.env` is read at startup).

The admin can also call `GET /api/admin/mail/status` and `POST /api/admin/mail/test` (Postman → *Admin workflow*).

Gmail allows about 500 mails/day. For real use switch to Brevo / Resend / SendGrid by changing only the `SMTP_*` values.

---

## 4. Admin workflow — how the database gets updated

Log in as admin → **http://localhost:3000/admin/index.html**. Every admin action calls the real API
(`/api/admin/...`) and writes to **MySQL**. If the backend is offline the pages fall back to browser-only demo
data and nothing is saved to the database — look for `[CivicConnect] backend connected (MySQL)` in the browser console.

| Admin page | What you do | What is written to MySQL | Notifications sent |
|---|---|---|---|
| **Dashboard** | see active schemes, citizens, new unanswered queries, % useful, schemes not verified for 90+ days | nothing (read-only; numbers from `/api/admin/stats`) | – |
| **Schemes → Add / Edit** | full form: names (EN/TA), category, level/state, summary, benefits, **criteria groups**, documents, source, verified date | `schemes`, `scheme_aliases`, `scheme_criteria`, `scheme_documents` (saved in one transaction; duplicate slug → error) | **Add:** `NEW_MATCH` to citizens whose profile now matches. **Edit:** `SCHEME_UPDATED` to citizens who saved it, plus `NEW_MATCH` for newly matching citizens (nobody is told twice) |
| **Schemes → Deactivate** | hides the scheme from citizens | `schemes.is_active = 0` | `SCHEME_DEACTIVATED` to citizens who saved it |
| **Schemes → Activate** | shows it again | `schemes.is_active = 1` | `NEW_MATCH` to matching citizens |
| **Content → Categories** | edit names/icon/description, enable/disable | `categories` | – |
| **Content → FAQs** | add / edit / enable / disable (immediately used by both chatbots) | `faqs` | – |
| **Content → Chatbot test console** | try any question and see each matching step | nothing | – |
| **Activity → Unanswered queries** | review what search and both chatbots could not answer; set status New / Reviewed / Added / Ignored | `search_queries.review_status` | – |
| **Activity → Feedback** | useful / not-useful totals and comments per scheme | nothing (read-only) | – |
| **Activity → Users** | enable / disable a citizen (they are locked out immediately). Admins only ever see name, email, status — never income or disability | `users.is_active` | – |
| **Activity → Announcements** | write a message in English (+ Tamil) | – | `ANNOUNCEMENT` to **all** active citizens (in-app) and email to the opted-in ones. The toast shows e.g. *"sent to 8 citizens (1 by email)"* |

How citizens' data gets in: registering, saving a profile, saving schemes, voting and unanswered
chatbot/search questions all go through the public API into the same MySQL tables, so the admin pages always
show live data.

**"Reset demo data" button (admin dashboard):** clears only the browser's local cache, then reloads from the
server. It does **not** reset MySQL. To reset the database, use `npm run db:reset` (local only).

### Changing the seed data itself
Edit `assets/js/data.js`, then `cd backend && npm run db:reset` (local). On a hosted site do **not** re-seed —
make the change from the admin pages instead, or the live data would be erased.

### Quick end-to-end check of the admin workflow
1. Log in as citizen `26MX203` → dashboard → confirm *email notifications* is ticked.
2. Log in as admin → **Activity → Announcements** → send one → expect *"(1 by email)"* and a mail in `26MX203`'s inbox.
3. **Schemes** → edit a scheme that `26MX203` saved → she gets `SCHEME_UPDATED`.
4. Ask the chatbot something silly (e.g. "free laptop") → **Activity → Unanswered queries** shows it.
5. Login page → **Forgot password** → open the emailed link → set a new password.

---

## 5. Deploy to Railway

The Express server serves the website **and** the API from one address, so you deploy **one** web service
(plus a MySQL database). Deploy from the **repository root** (not the `backend` folder — the website files live
next to it).

### 5.1 Prepare
1. Push the repo to GitHub (`.env` is gitignored — your secrets stay out of it).
2. **Rotate your Gmail App Password** if it was ever pasted anywhere (chat, screenshots, commits).

### 5.2 Create the project
1. Railway → **New Project** → **Deploy from GitHub repo** → pick this repo. Leave *Root Directory* empty.
   (Railway reads the root `package.json`: it runs `npm run build`, then `npm start`.)
2. In the same project: **+ New → Database → Add MySQL**.
3. Open the web service → **Settings → Networking → Generate Domain**. Note the `https://….up.railway.app` address.
4. Web service → **Settings → Healthcheck Path** = `/api/health` (optional but recommended).

### 5.3 Variables (web service → Variables)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` *(Railway reference to the MySQL service; rename `MySQL` if your service is named differently)* |
| `JWT_SECRET` | a long random string, e.g. output of `openssl rand -hex 32` (**the app refuses to start without a strong one**) |
| `ADMIN_PASSWORD` | the password you want for `26MX102@psgtech.ac.in` (**required on first boot**) |
| `FRONTEND_URL` | `https://<your-domain>.up.railway.app` *(used in password-reset links; if omitted, Railway's `RAILWAY_PUBLIC_DOMAIN` is used)* |
| `CORS_ORIGIN` | the same `https://…` address |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | same values as your local `.env` (section 3) |
| `PASSWORD_RESET_TTL_MINUTES` | `30` |

Do **not** set `PORT` (Railway provides it). `DB_SSL` is not needed for Railway's MySQL.

### 5.4 First deploy — what happens
`npm start` → `start:prod` → `scripts/init-db.js`:
- **Empty database →** creates all tables and loads the seed data **once**. The admin password is
  `ADMIN_PASSWORD`; the seeded demo citizens get **random** passwords (they can use *Forgot password*).
  Set `SEED_DEMO_PASSWORDS=true` *before the first boot* only if you want the known demo passwords on the live site.
- **Database already has data →** does nothing. Admin edits survive every redeploy and restart.

So: seeding on Railway is automatic, and "updating the DB" afterwards is done from the **admin pages**.
Never run `db:reset` / `db:seed` against the hosted database. (They refuse to run with `NODE_ENV=production` anyway.)

### 5.5 Verify the live site
1. `https://<domain>/api/health` → `{"status":"ok","database":"up"}`.
2. Deploy logs show `[init-db] …` and `[mail] SMTP login OK`.
3. Open the site, log in as admin (`26MX102@psgtech.ac.in` + your `ADMIN_PASSWORD`).
4. Admin → send a **test email**: Postman `POST /api/admin/mail/test` (or open the browser console while logged in). A 200 means mail works from Railway.
5. Request **Forgot password** for an account you own → the link must start with your `https://` address and open the reset page.

### 5.6 Resetting the hosted database (only if you really want to wipe it)
Railway → MySQL service → **Data** tab → delete the tables (or delete and re-create the MySQL service) →
redeploy the web service; the next boot re-seeds. This permanently erases live data.

---

## 6. Will it work on Railway? (honest status)

**Verified on this machine:**
- Fresh local setup from an empty Docker volume (`docker compose down -v` → up → `db:reset` → 23 passing tests).
- The hosting path against a separate database in production mode using a `MYSQL_URL`: first boot seeds, second boot leaves
  edited data alone, new admin password works, old demo password is rejected, website and API are served from one address.
- Email delivery code via a fake SMTP server in the tests; a real Gmail login check (`SMTP login OK`).
- The frontend now calls the API on the same address when hosted (it used to assume `localhost:3000`).

**Not verified (I have not deployed to Railway):**
- **Outbound SMTP from Railway.** Railway has restricted outbound SMTP ports (25/465/587) on some plans, and Gmail can
  block sign-ins from cloud IPs. If *Test email* fails with *"Cannot reach the SMTP server"*, that is why. Fixes: check
  Railway's current docs / upgrade plan, or switch to an email provider with an HTTPS API (e.g. Resend) — a small code change
  in `backend/src/mailer.js`; the rest of the app is unaffected.
- A Google Workspace (college) account may have App Passwords turned off by its administrator.
- Everything else (database, admin workflow, notifications, reset link) uses only standard HTTP + MySQL and should
  work, but run the checklist in 5.5 after your first deploy.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Connection lost: The server closed the connection` during `db:reset` right after `docker compose up` | MySQL was still starting. Wait for `docker compose ps` to show **(healthy)** (the healthcheck now waits for the real server), then retry. |
| `Table 'password_resets' already exists` | Fixed — `db:reset` now drops it. Pull the latest code. |
| "Cannot find module 'nodemailer'" | `cd backend && npm install`. |
| Password reset says *invalid or expired* | Fixed (timezone bug). Old links no longer work — request a new one; links work once and expire after 30 min. |
| Reset link points to `localhost` on the live site | `FRONTEND_URL` is not set to your public `https://` address. |
| Emails don't arrive | `npm run mail:test -- you@x.com`; check Spam; for Gmail use an App Password and a matching `SMTP_FROM`; the recipient must have email notifications ON (except password reset). |
| `SMTP login rejected` | Wrong/normal password instead of an App Password, or 2-Step Verification off. |
| `TLS mismatch` | Use port 587 + `SMTP_SECURE=false`, or port 465 + `SMTP_SECURE=true`. |
| `JWT_SECRET must be set to a strong value in production` | Set `JWT_SECRET` (not starting with `change-me`). |
| `[init-db] Set ADMIN_PASSWORD…` | Set `ADMIN_PASSWORD` before the first start on an empty hosted database. |
| Admin pages show demo data / changes not saved | Backend offline or logged in from a different address. Open the site from the server address (`http://localhost:3000`), not a file or Live Server. |
| `EADDRINUSE: 3000` | Another copy is running. Stop it (Ctrl+C) or set `PORT=3001`. |
| Login says too many attempts | 20 tries per 15 minutes per IP; wait, or restart the server locally. |
