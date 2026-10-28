# Mathify — website + student app

Everything for **mathify.world** in one repo, hosted free on **Cloudflare Pages**:

| Part | Where | What it does |
|---|---|---|
| Website | `public/` | Puzzle home page, info pages, live fee table (from the *Mathify – Website Rates* Google Sheet), enquiry form |
| App | `public/app/` → `mathify.world/app` | Google sign-in; admin and student/parent dashboards |
| API | `functions/api/[[path]].js` | Login, students, attendance, fees, payments, invoices, enquiries |
| Database | `migrations/` (Cloudflare D1) | students, attendance, payments, enquiries |

No Webflow, Netlify, Render or MongoDB.

## What the app does

**Admin (you)**
- **Today:** classes scheduled today with a **Start class** button, plus classes in progress with an **End class** button. Also shows fees due from past months, with a one-tap WhatsApp reminder.
- **Students:** search, add or edit, weekly schedule, fee per hour, private notes, deactivate or delete.
- **Attendance:** start/end or add past classes, marked Present, Absent (not charged) or Late cancel (charged, as per the policy). Overlapping classes are rejected. Hours are rounded to 15 minutes.
- **Fees:** monthly totals, **Mark paid** (Cash / UPI / Bank transfer, part payments allowed), undo.
- **Invoices:** PDF download, plus send on WhatsApp or email. On phones, **Share PDF** attaches it directly.
- **Enquiries:** every website enquiry is saved here. You can change its status, WhatsApp the parent, or **Create student** with the details copied over.

**Students & parents**
- Sign in with the Google account you registered (student email *or* parent email).
- They see their schedule, classes, monthly fees, payments, and can download invoices. Parents with several children can switch between them.

The rate per hour is saved on each class, so changing a student's fee later doesn't rewrite past months.

## One-time setup (about 30 minutes)

### 1. Cloudflare Pages
1. Create a free account at cloudflare.com.
2. Go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repo.
   Leave the build command empty; set the output directory to `public`.
3. Check that the site works on the `*.pages.dev` address it gives you.

### 2. Database (D1)
1. Go to **Storage & Databases → D1 → Create**, name it `mathify`, and copy its **Database ID**.
2. Put that ID in `wrangler.toml` (`database_id = "..."`), then commit and push. Or send it to Claude.
3. Open the database → **Console**, paste the contents of `migrations/0001_init.sql` and run it.

### 3. Google sign-in
1. In console.cloud.google.com, create a project called "Mathify".
2. Set up **APIs & Services → OAuth consent screen**: External, app name *Mathify*, your email, and scopes `openid`, `email`, `profile` only. Then **Publish app** so any Google account can sign in. These basic scopes don't need Google's review.
3. Go to **Credentials → Create credentials → OAuth client ID → Web application** and add these **Authorized redirect URIs**:
   - `https://mathify.world/api/auth/callback`
   - `https://<your-project>.pages.dev/api/auth/callback`
4. Copy the **Client ID** and **Client secret**.

### 4. Secrets
Under **Cloudflare → your Pages project → Settings → Variables and secrets**, add these as **encrypted**:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 3 |
| `GOOGLE_CLIENT_SECRET` | from step 3 |
| `SESSION_SECRET` | any long random text (40+ characters) |

`ADMIN_EMAILS`, the WhatsApp number and the email address are in `wrangler.toml`. Redeploy after adding secrets.

### 5. Domain
1. **Pages project → Custom domains** → add `mathify.world` and `www.mathify.world`.
2. Cloudflare will ask you to move DNS: in GoDaddy, change the **Nameservers** to the two Cloudflare gives you. The domain stays registered at GoDaddy.
3. Delete any old DNS records pointing to Webflow.

### 6. Start using it
1. Sign in at `mathify.world/app` with `tanmaym88@gmail.com`.
2. Add your current students with their Google emails and fee per hour.
3. Set the rates sheet to **Anyone with the link → Viewer** so the Fees page shows live rates.

## Everyday changes
- **Fee table on the website:** edit the *Mathify – Website Rates* Google Sheet. No code change needed.
- **Add another admin:** add their email to `ADMIN_EMAILS` in `wrangler.toml`.
- **Website pages:** edit `tools/build_pages.py` (shared header/footer) and run `npm run build:pages`, or edit the HTML directly.
- **Home-page puzzle:** optional (visitors can skip it). To make it compulsory again, set `REQUIRED = true` at the top of `public/assets/gate.js`.
- **New student field (address, phone, anything):** add one line to `DETAIL_DEFS` in `public/app/app.js`. It's stored in the student's flexible `details` (JSON), so no database change is needed. Only sign-in, billing and schedule fields are fixed columns.
- **After any HTML/CSS/JS change:** run `npm run build:pages` (or `python3 tools/stamp_assets.py public`). It adds version tags (`?v=…`) to CSS/JS links so visitors get the new files immediately; Cloudflare otherwise lets browsers keep old copies for 4 hours.

## Brand
- **Fonts (two only):** **Lexend** for the logo, headings and display text (bold, 600–800); **Lato** for body text, forms and buttons (400/700). Defined once as `--font-display` and `--font-body` in `public/assets/site.css` and `public/app/app.css`; loaded from Google Fonts on every page.
- **Colours:** navy `#2f3192` (primary), orange `#f7941d` (accent), yellow `#ffd54f` (surface), grey `#6b6b73` (tagline/muted).
- **Logo:** bulb icon + "Mathify" wordmark in Lexend ExtraBold — "Math" navy, "ify" orange, the dot of the *i* is an orange circle. Stacked versions add the tagline MATHS SIMPLIFIED. On yellow (the navbars, `mathify-logo-horizontal-navy.svg`), the whole word, including the dot, is navy because orange on yellow is hard to read. All logo files in `public/brand/` (plus the invoice logo and the social-share image) are generated by `python3 tools/make_logo.py`; don't edit them by hand.

## Local development
```bash
npm install
cp .dev.vars.example .dev.vars   # fill in; DEV_LOGIN=1 enables test logins on localhost only
npm run migrate:local
npm run dev                      # http://localhost:8788  (app at /app)
python3 tools/test_site.py       # website tests (Playwright)
python3 tools/test_app.py        # app tests — run against a fresh local database
```
`/api/auth/dev?email=...` signs in without Google, but only when `DEV_LOGIN=1` **and** the address is `localhost`. It never works on the live site.

## Security notes
- **Session:** a signed, HttpOnly, Secure cookie. Roles are re-checked on every request, so deactivating a student cuts off access immediately.
- **Access:**
  - Students and parents can only read their own records.
  - Everything that changes data is admin-only.
  - Cross-site write requests are blocked.
- **Enquiry form:** has a hidden bot trap and is capped at 30 per hour.
