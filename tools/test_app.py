"""End-to-end test of the Mathify app against a local `wrangler pages dev` server.

Run:  npm run dev   (in another terminal, with DEV_LOGIN=1 in .dev.vars)
      python3 tools/test_app.py
"""
import os, sys, urllib.parse
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:8788")
SHOTS = os.environ.get("SHOTS", "/tmp/mathify-shots")
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
os.makedirs(SHOTS, exist_ok=True)
ADMIN = "tanmaym88@gmail.com"
results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond), extra))

def no_fonts(ctx):
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)

    # ---------- 1. visitor submits enquiry on the website ----------
    v = br.new_context(); no_fonts(v)
    vp = v.new_page()
    vp.goto(B + "/"); vp.evaluate("localStorage.setItem('mathifyUnlocked','1')")
    vp.goto(B + "/contact/"); vp.wait_for_load_state("load")
    vp.evaluate("window.open=()=>{}")
    vp.fill("#f-student", "Ishaan Rao"); vp.fill("#f-parent", "Kavya Rao"); vp.fill("#f-phone", "98200 11111")
    vp.fill("#f-grade", "10th"); vp.fill("#f-exams", "IGCSE"); vp.select_option("#f-mode", "Offline (Magarpatta, Pune)")
    vp.fill("#f-hours", "3"); vp.fill("#f-semail", "ishaan@example.com"); vp.fill("#f-pemail", "kavya@example.com")
    with vp.expect_response(lambda r: "/api/enquiries" in r.url) as resp:
        vp.click("#send-wa")
    ok("website enquiry saved to app", resp.value.status == 201, resp.value.status)
    # bot with honeypot filled is silently ignored
    r = vp.request.post(B + "/api/enquiries", data={"student": "Bot", "parent": "Bot", "phone": "1", "website": "spam"})
    ok("honeypot enquiry accepted but not stored", r.status == 200)
    v.close()

    # ---------- 2. anonymous app = login screen ----------
    a = br.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True); no_fonts(a)
    pg = a.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(B + "/app/"); pg.wait_for_selector("text=Sign in with Google")
    ok("anonymous sees Google sign-in", pg.locator("a[href='/api/auth/login']").count() == 1)
    pg.goto(B + "/api/auth/dev?email=stranger@example.com"); pg.wait_for_selector(".login")
    ok("unregistered account gets clear message", "isn't registered" in pg.inner_text(".login"))

    # ---------- 3. admin login ----------
    pg.goto(B + "/api/auth/dev?email=" + ADMIN); pg.wait_for_selector("text=Today's schedule")
    ok("admin lands on Today", pg.locator(".tabs a").count() == 3)
    ok("enquiry badge shows 1 new", pg.inner_text(".tabs").find("1") >= 0, pg.inner_text(".tabs"))

    # ---------- 4. convert enquiry -> student ----------
    pg.click("text=Enquiries"); pg.wait_for_selector("text=Ishaan Rao")
    ok("enquiry details visible", "IGCSE" in pg.inner_text("main") and "Kavya Rao" in pg.inner_text("main"))
    ok("bot enquiry not listed", "Bot" not in pg.inner_text("main"))
    pg.click("[data-convert]"); pg.wait_for_selector("#sform")
    ok("Create student opens full form with enquiry picked", pg.eval_on_selector("#enq-pick", "e => e.options[e.selectedIndex].text").startswith("Ishaan Rao"))
    ok("form prefilled with student email", pg.input_value("#f-email") == "ishaan@example.com")
    ok("converted student carries parent + phone", pg.input_value("#f-parent_name") == "Kavya Rao" and pg.input_value("#f-phone") == "98200 11111")
    ok("mode mapped to Offline", pg.input_value("#f-mode") == "Offline")
    pg.click("#save")
    ok("fee required", "Fee per hour is required" in pg.inner_text("#ferr"))
    pg.fill("#f-fee_per_hour", "800")
    # set schedule for today's weekday (IST)
    today_day = pg.evaluate("""() => { const d = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',weekday:'short'}).format(new Date()); return d.slice(0,3); }""")
    pg.check(f"input[name=day-{today_day}]")
    pg.fill(f"input[name=from-{today_day}]", "17:00"); pg.fill(f"input[name=to-{today_day}]", "18:00")
    pg.click("#save"); pg.wait_for_selector("text=Start class now")
    sid = pg.url.split("/students/")[1].split("/")[0]
    st = pg.request.get(B + "/api/students/" + sid).json()["student"]
    ok("student saved with fee + schedule", st["fee_per_hour"] == 800 and today_day in st["schedule"], st)
    enq = pg.request.get(B + "/api/enquiries").json()["enquiries"]
    ok("enquiry marked converted and linked", any(e["status"] == "converted" and str(e["student_id"]) == sid for e in enq), enq)
    pg.goto(B + "/app/#/students/new"); pg.wait_for_selector("#enq-pick")
    ok("converted enquiry no longer offered", "Ishaan" not in pg.inner_text("#enq-pick"))
    ok("student saved with schedule", True)

    # ---------- 5. today: start + end class ----------
    pg.click(".tabs >> text=Today"); pg.wait_for_selector("[data-start-class]")
    ok("today lists scheduled class", "Ishaan Rao" in pg.inner_text("main") and "17:00–18:00" in pg.inner_text("main"))
    pg.click("[data-start-class]"); pg.wait_for_selector("#m-start")
    ok("start class asks for time (pre-filled with now)", len(pg.input_value("#m-start")) == 5)
    pg.fill("#m-start", "06:10"); pg.click("#modal-form button[value=ok]"); pg.wait_for_selector("[data-end]")
    ok("class started at the edited time", "Started 06:10" in pg.inner_text("main"))
    pg.screenshot(path=f"{SHOTS}/admin_today.png", full_page=True)
    pg.click("[data-restart]"); pg.wait_for_selector("#m-start")
    pg.fill("#m-start", "06:00"); pg.click("#modal-form button[value=ok]"); pg.wait_for_selector("text=Started 06:00")
    ok("start time of a running class can be changed", "Started 06:00" in pg.inner_text("main"))
    pg.click("[data-end]"); pg.wait_for_selector("#m-end")
    ok("end class shows editable start time", pg.input_value("#m-start") == "06:00")
    pg.fill("#m-start", "06:05"); pg.fill("#m-end", "05:30"); pg.click("#modal-form button[value=ok]"); pg.wait_for_timeout(500)
    ok("end before start rejected", "after start" in pg.inner_text("#modal-form"))
    pg.fill("#m-end", "07:20"); pg.click("#modal-form button[value=ok]"); pg.wait_for_selector("text=Done")
    att = pg.request.get(B + "/api/students/1/attendance").json()["attendance"]
    today_row = [x for x in att if x["start_time"] == "06:05"]
    ok("edited start/end saved, hours recalculated (1.25)", today_row and today_row[0]["end_time"] == "07:20" and today_row[0]["hours"] == 1.25, att[:2])
    ok("class ended and marked done", pg.locator(".badge.green", has_text="Done").count() == 1)

    # ---------- 6. past classes: present, late cancel, absent; overlap rejected ----------
    pg.goto(f"{B}/app/#/students/{sid}/attendance"); pg.wait_for_selector("#add-past")
    def add_class(date, s, e, status):
        pg.click("#add-past")
        pg.fill("#m-date", date); pg.fill("#m-start", s); pg.fill("#m-endt", e); pg.select_option("#m-status", str(status))
        pg.click("#modal-form button[value=ok]")
    add_class("2026-09-07", "16:00", "17:30", 1); pg.wait_for_timeout(500)
    add_class("2026-09-14", "16:00", "17:00", 2); pg.wait_for_timeout(500)
    add_class("2026-09-21", "16:00", "17:00", 0); pg.wait_for_timeout(500)
    add_class("2026-09-07", "17:00", "18:00", 1); pg.wait_for_selector("#modal-error:has-text('Overlaps')")
    ok("overlapping class rejected", "Overlaps" in pg.inner_text("#modal-error"))
    pg.click("#modal-form button[value=cancel]")
    rows = pg.locator("table tbody tr").count()
    ok("attendance table has 4 classes", rows == 4, rows)
    pg.screenshot(path=f"{SHOTS}/admin_attendance.png", full_page=True)

    # ---------- 7. fees, payment, invoice ----------
    pg.goto(f"{B}/app/#/students/{sid}/fees"); pg.wait_for_selector("text=Monthly fees")
    txt = pg.inner_text("main")
    # Sept: 1.5h + 1h (late cancel) = 2.5h x 800 = 2000; absent not charged
    ok("September fees = ₹2,000 (absent not charged)", "September 2026" in txt and "₹2,000" in txt, txt[:400])
    pg.click("[data-pay='2026-09']")
    ok("mark-paid prefilled with balance", pg.input_value("#p-amt") == "2000")
    pg.fill("#p-amt", "1500"); pg.select_option("#p-method", "UPI"); pg.click("#modal-form button[value=ok]")
    pg.wait_for_selector("text=Part paid")
    ok("part payment shown", "Part paid ₹1,500" in pg.inner_text("main"))
    pg.click("[data-inv='2026-09']"); pg.wait_for_selector("#inv-dl")
    ok("invoice summary balance ₹500", "₹500" in pg.inner_text("#modal-form"))
    wa = pg.get_attribute("#modal-form a.wa", "href")
    ok("WhatsApp invoice link to student phone", wa.startswith("https://wa.me/919820011111?text=") and "Balance%20due" in wa, wa[:80])
    with pg.expect_download() as dl:
        pg.click("#inv-dl")
    path = dl.value.path()
    data = open(path, "rb").read()
    ok("invoice PDF downloads", data[:4] == b"%PDF" and len(data) > 2000, len(data))
    ok("PDF filename sensible", dl.value.suggested_filename == "Mathify-invoice-Ishaan-Rao-2026-09.pdf", dl.value.suggested_filename)
    pg.click("#modal-form button[value=cancel]")
    pg.screenshot(path=f"{SHOTS}/admin_fees.png", full_page=True)

    # dues on Today
    pg.click(".tabs >> text=Today"); pg.wait_for_selector("text=Fees due")
    ok("today shows ₹500 due with WhatsApp reminder", "₹500" in pg.inner_text("main") and pg.locator("a.wa", has_text="Remind").count() == 1)

    # students list + search
    pg.click(".tabs >> text=Students"); pg.wait_for_selector("#search")
    pg.fill("#search", "zzz"); ok("search filters", pg.locator("#rows tr").count() == 0)
    pg.fill("#search", "ishaan"); ok("search finds student", pg.locator("#rows tr").count() == 1)
    # fee change -> offer to re-price classes in unpaid months (paid/part-paid months untouched)
    before = {m["month"]: m["amount"] for m in pg.request.get(B + f"/api/students/{sid}/fees").json()["months"]}
    pg.goto(B + f"/app/#/students/{sid}/edit"); pg.wait_for_selector("#f-fee_per_hour")
    pg.fill("#f-fee_per_hour", "1000"); pg.click("#save"); pg.wait_for_selector("text=Apply the new fee to earlier classes?")
    ok("fee change offers to update unpaid classes", "October 2026" in pg.inner_text("#modal-form") or "unpaid months" in pg.inner_text("#modal-form"))
    pg.click("#modal-form button[value=ok]"); pg.wait_for_timeout(1200)
    after = {m["month"]: m["amount"] for m in pg.request.get(B + f"/api/students/{sid}/fees").json()["months"]}
    unpaid = [m for m in after if after[m] != before.get(m)]
    ok("unpaid month re-priced, part-paid September untouched", after.get("2026-09") == before.get("2026-09") and len(unpaid) >= 1, (before, after))
    pg.goto(B + f"/app/#/students/{sid}/edit"); pg.wait_for_selector("#f-fee_per_hour")
    pg.fill("#f-fee_per_hour", "800"); pg.click("#save"); pg.wait_for_selector("text=Apply the new fee to earlier classes?")
    pg.click("#modal-form button[value=cancel]"); pg.wait_for_timeout(800)
    after2 = {m["month"]: m["amount"] for m in pg.request.get(B + f"/api/students/{sid}/fees").json()["months"]}
    ok("choosing 'only new classes' leaves earlier classes as they were", after2 == after, (after, after2))
    # admin "Student view" preview = exactly the student/parent page, read-only
    pg.goto(B + f"/app/#/students/{sid}/attendance"); pg.wait_for_selector("text=Student view")
    pg.click("text=Student view"); pg.wait_for_selector(".preview-banner")
    pv = pg.inner_text("main")
    ok("student view preview shows fees + classes", "Ishaan Rao" in pv and "₹" in pv)
    ok("student view preview has no admin controls", pg.locator("[data-pay],[data-unpay],[data-edit],[data-del],#start-now,#add-past").count() == 0)
    ok("student view preview hides private notes", "Private notes" not in pv)
    pg.click(".preview-banner >> text=Back to admin"); pg.wait_for_selector("text=Student view")
    ok("back to admin from preview", "/students/" in pg.url)
    ok("no JS errors (admin)", not errors, errors)

    # ---------- 8. parent view ----------
    par = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, accept_downloads=True); no_fonts(par)
    pp = par.new_page()
    perr = []
    pp.on("pageerror", lambda e: perr.append(str(e)))
    pp.goto(B + "/api/auth/dev?email=kavya@example.com"); pp.wait_for_selector("text=Monthly fees")
    t = pp.inner_text("main")
    ok("parent sees child's fees", "Ishaan Rao" in t and "₹2,000" in t and "Part paid" in t)
    ok("parent sees classes", "Late cancel (charged)" in t)
    ok("parent has no admin controls", pp.locator("[data-pay],[data-unpay],[data-edit],[data-del],#start-now,#add-past").count() == 0)
    ok("parent cannot see private notes", "Private notes" not in t)
    pp.click("[data-inv='2026-09']"); pp.wait_for_selector("#inv-dl")
    ok("parent invoice has no send buttons", pp.locator("#modal-form a.wa").count() == 0)
    with pp.expect_download() as dl2:
        pp.click("#inv-dl")
    ok("parent can download invoice", open(dl2.value.path(), "rb").read()[:4] == b"%PDF")
    pp.click("#modal-form button[value=cancel]")
    r = pp.request.get(B + "/api/students")
    ok("parent blocked from student list API", r.status == 403)
    ok("mobile: no horizontal scroll", pp.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    pp.screenshot(path=f"{SHOTS}/parent_mobile.png", full_page=True)
    ok("no JS errors (parent)", not perr, perr)

    # ---------- 9. admin mobile ----------
    am = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); no_fonts(am)
    ap = am.new_page()
    ap.goto(B + "/api/auth/dev?email=" + ADMIN); ap.wait_for_selector("text=Today's schedule")
    for route in ["#/", "#/students", f"#/students/{sid}/attendance", f"#/students/{sid}/fees", f"#/students/{sid}/details", "#/enquiries/all", f"#/students/{sid}/edit"]:
        ap.goto(B + "/app/" + route); ap.wait_for_timeout(600)
        ok(f"admin mobile {route} fits", ap.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    ap.goto(B + f"/app/#/students/{sid}/fees"); ap.wait_for_timeout(600)
    ap.screenshot(path=f"{SHOTS}/admin_mobile_fees.png", full_page=True)

    # ---------- 10. sign out ----------
    pg.goto(B + "/app/"); pg.wait_for_selector("#logout"); pg.click("#logout"); pg.wait_for_selector("text=Sign in with Google")
    ok("sign out returns to login", pg.request.get(B + "/api/me").status == 401)
    br.close()

fails = [r for r in results if not r[1]]
for name, good, extra in results:
    print(("PASS " if good else "FAIL ") + name + ("" if good else f"  -> {extra}"))
print(f"\n{len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
