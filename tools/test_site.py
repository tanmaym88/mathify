import subprocess, time, sys, os, urllib.parse
from playwright.sync_api import sync_playwright

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
OUT = os.environ.get("SHOTS", "/tmp/mathify-site-shots")
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", SITE],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
B = "http://localhost:8765"
results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond), extra))

PAGES = ["/welcome/", "/why-maths/", "/about-mathify/", "/about-the-teacher/",
         "/fees-and-schedule/", "/testimonials/", "/contact/", "/feedback/"]

with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # 1. puzzle is optional: pages open directly, and the home page offers a skip link
    page.goto(B + "/welcome/")
    page.wait_for_load_state("load")
    ok("/welcome opens without solving the puzzle", urllib.parse.urlparse(page.url).path == "/welcome/", page.url)
    page.goto(B + "/"); page.wait_for_load_state("load")
    page.click("text=Skip the test and go to the website"); page.wait_for_load_state("load")
    ok("skip link goes to the website", urllib.parse.urlparse(page.url).path.startswith("/welcome"), page.url)

    # 2. puzzle renders with 9 loaded images
    page.goto(B + "/")
    page.wait_for_load_state("load")
    n = page.locator(".cop-card").count()
    loaded = page.evaluate("[...document.querySelectorAll('.cop-card img')].every(i=>i.complete&&i.naturalWidth>0)")
    ok("puzzle has 9 cards", n == 9, n)
    ok("puzzle images all load", loaded)
    page.screenshot(path=f"{OUT}/puzzle_desktop.png")

    # 3. a wrong order shakes (place card 2 in slot 1 then fill rest) — then solve properly by dragging
    def drag_card_to_slot(count, slot_index):
        card = page.locator(f'.cop-card[data-count="{count}"]')
        cb = card.bounding_box()
        sb = page.locator(".cop-slot").nth(slot_index).bounding_box()
        page.mouse.move(cb["x"] + cb["width"]/2, cb["y"] + cb["height"]/2)
        page.mouse.down()
        page.mouse.move(sb["x"] + sb["width"]/2, sb["y"] + sb["height"]/2, steps=8)
        page.mouse.up()
        page.wait_for_timeout(260)

    for c in range(1, 10):
        page.locator(".cop-slot").nth(c-1).scroll_into_view_if_needed()
        drag_card_to_slot(c, c-1)
    page.wait_for_timeout(400)
    ok("solving shows success overlay", page.locator("#cop-overlay.show").count() == 1)
    ok("solving sets unlock flag", page.evaluate("localStorage.getItem('mathifyUnlocked')") == "1")
    page.screenshot(path=f"{OUT}/puzzle_solved.png")

    # 4. every content page: loads, images ok, no JS errors, title present
    for path in PAGES:
        errors.clear()
        r = page.goto(B + path)
        page.wait_for_load_state("load")
        imgs_ok = page.evaluate("[...document.images].every(i=>i.complete&&i.naturalWidth>0)")
        ok(f"{path} status 200", r.status == 200, r.status)
        ok(f"{path} stays (unlocked)", urllib.parse.urlparse(page.url).path == path, page.url)
        ok(f"{path} images load", imgs_ok)
        ok(f"{path} no JS errors", not errors, errors)
        page.screenshot(path=f"{OUT}/desk{path.strip('/').replace('/','_')}.png", full_page=True)

    # 5. all internal links resolve
    page.goto(B + "/welcome/")
    hrefs = set()
    for path in PAGES:
        page.goto(B + path)
        hrefs |= set(page.eval_on_selector_all("a[href^='/']", "els=>els.map(e=>e.getAttribute('href'))"))
    bad = []
    for h in sorted(hrefs):
        r = page.request.get(B + h)
        if r.status != 200: bad.append((h, r.status))
    ok("all internal links resolve", not bad, bad or sorted(hrefs))

    # 6. enquiry form
    page.goto(B + "/contact/")
    page.evaluate("window.__opened=[]; window.open=(u)=>{window.__opened.push(u)}")
    page.click("#send-wa")
    ok("empty form asks for student name", "student" in page.inner_text("#form-error").lower(), page.inner_text("#form-error"))
    page.fill("#f-student", "Riya Kulkarni")
    page.click("#send-wa")
    ok("then asks for parent name", "parent" in page.inner_text("#form-error").lower(), page.inner_text("#form-error"))
    page.fill("#f-parent", "Meera Kulkarni")
    page.click("#send-wa")
    ok("then asks for WhatsApp number", "whatsapp" in page.inner_text("#form-error").lower(), page.inner_text("#form-error"))
    page.fill("#f-phone", "+91 98200 00000")
    page.select_option("#f-gender", "Female")
    page.fill("#f-dob", "2011-05-04")
    page.fill("#f-grade", "10th")
    page.fill("#f-exams", "IGCSE")
    page.fill("#f-city", "Pune"); page.fill("#f-country", "India")
    page.check("input[name=objective][value=Both]")
    page.select_option("#f-mode", "Online")
    page.fill("#f-hours", "3"); page.fill("#f-days", "Mon, Thu"); page.fill("#f-time", "6-7 pm")
    page.select_option("#f-level", "7"); page.select_option("#f-demo", "Yes"); page.select_option("#f-source", "Word of mouth")
    page.fill("#f-message", "Struggling with surds & indices.")
    page.click("#send-wa")
    opened = page.evaluate("window.__opened")
    wa = opened[-1] if opened else ""
    decoded = urllib.parse.unquote(wa.split("text=", 1)[-1]) if wa else ""
    ok("WhatsApp link opens wa.me with number", wa.startswith("https://wa.me/919766072237?text="), wa[:60])
    need = ["Riya Kulkarni", "Female", "2011-05-04", "10th", "IGCSE", "Meera Kulkarni", "+91 98200 00000", "Pune", "India", "Objective: Both", "Online", "Hours per week: 3", "Mon, Thu", "6-7 pm", "Maths level (1-10): 7", "Demo class: Yes", "Word of mouth", "surds & indices"]
    missing = [n for n in need if n not in decoded]
    ok("WhatsApp message carries every field", not missing, missing)
    page.fill("#f-pemail", "meera@example.com")
    href = page.evaluate("""() => {
        let got = 'NO_CLICK';
        document.addEventListener('click', e => { if (e.target.closest('#send-mail')) { got = e.target.closest('#send-mail').href; e.preventDefault(); } });
        document.getElementById('send-mail').click();
        return got;
    }""")
    href = urllib.parse.unquote(href)
    ok("Email button builds mailto with subject+body", href.startswith("mailto:tanmaym88@gmail.com?subject=Mathify enquiry") and "Riya Kulkarni" in href and "meera@example.com" in href, href[:160])

    # 6b. feedback page open without puzzle; fees + ratings present
    fresh = br.new_context()
    fp = fresh.new_page()
    fp.goto(B + "/feedback/"); fp.wait_for_load_state("load")
    ok("/feedback open without solving puzzle", urllib.parse.urlparse(fp.url).path == "/feedback/", fp.url)
    ok("feedback links to both Google Forms", fp.locator("a[href*='docs.google.com/forms']").count() == 2)
    fresh.close()
    page.goto(B + "/fees-and-schedule/"); page.wait_for_function("!document.querySelector('table.fees').classList.contains('rates-loading')", timeout=6000)
    ok("fees table shows built-in rates", all(x in page.inner_text("table.fees") for x in ["₹600", "₹900", "₹2,500", "₹1,300", "₹3,500"]))
    # live update from sheet (mocked CSV)
    csv = 'Grade,Offline,Online India,Online Intl,Show\nGrades 9–10,850,950,2600,Yes\nHidden row,1,2,3,No\n"JEE, Olympiad",1250,1350,3600,Yes\nEffective from,1 December 2026,,,\n'
    ctx.route("**/gviz/tq**", lambda r: r.fulfill(status=200, content_type="text/csv", body=csv))
    page.goto(B + "/fees-and-schedule/"); page.wait_for_selector("table.fees[data-source=sheet]", timeout=5000)
    txt = page.inner_text("table.fees")
    ok("fees table updates from sheet", all(x in txt for x in ["₹850", "₹2,600", "JEE, Olympiad", "₹3,600", "1 December 2026"]) and "Hidden row" not in txt and "₹600" not in txt, txt)
    ctx.unroute("**/gviz/tq**")
    ctx.route("**/gviz/tq**", lambda r: r.fulfill(status=200, content_type="text/html", body="<html>Sign in</html>"))
    page.goto(B + "/fees-and-schedule/"); page.wait_for_timeout(800)
    ok("unshared sheet falls back to built-in rates", "₹2,500" in page.inner_text("table.fees"))
    ctx.unroute("**/gviz/tq**")
    # every row "No" in the sheet -> no rates anywhere, "on request" note instead, and no flash while loading
    allno = 'Grade,Offline,Online India,Online Intl,Show\nGrades 6–8,600,700,2000,No\nGrades 9–10,800,900,2500,No\nEffective from,1 November 2026,,,\n'
    def slow_allno(r):
        import time; time.sleep(0.6); r.fulfill(status=200, content_type="text/csv", body=allno)
    ctx.route("**/gviz/tq**", slow_allno)
    page.goto(B + "/fees-and-schedule/", wait_until="domcontentloaded")
    ok("rates invisible while the sheet loads (no flash)", page.evaluate("getComputedStyle(document.querySelector('table.fees')).visibility") == "hidden")
    page.wait_for_selector("table.fees[data-source=sheet-hidden]", state="attached", timeout=6000)
    ok("all rows 'No': fee table hidden", not page.is_visible("table.fees"))
    ok("all rows 'No': 'fees on request' note shown", page.is_visible(".fees-on-request") and "₹" not in page.inner_text("main"))
    ctx.unroute("**/gviz/tq**")
    page.goto(B + "/testimonials/")
    ok("ratings block shows 6 stats", page.locator(".stat").count() == 6)
    ok("Vibha Jain listed as parent", "Vibha Jain" in page.inner_text("body"))

    # 7. mobile: menu toggle + dropdown visible, puzzle fits
    m = br.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
    m.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    m.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    mp = m.new_page()
    mp.goto(B + "/")
    mp.wait_for_load_state("load")
    mp.screenshot(path=f"{OUT}/puzzle_mobile.png")
    no_hscroll = mp.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    ok("mobile puzzle no horizontal scroll", no_hscroll)
    # login reachable without solving the puzzle
    lc = br.new_context(); lp = lc.new_page(); lp.goto(B + "/"); lp.wait_for_load_state("load")
    ok("puzzle page has a Login button", lp.locator("a.cop-login[href='/app/']").is_visible())
    lp.click("a.cop-login"); lp.wait_for_selector(".login, .topbar", state="attached", timeout=8000)
    ok("Login opens the app sign-in without solving the puzzle", "/app/" in lp.url, lp.url)
    lc.close()
    # 7a. phones: whole puzzle fits on screen, empty areas scroll, puzzle solvable
    for vw, vh in [(375, 667), (390, 664), (360, 640)]:
        pc = br.new_context(viewport={"width": vw, "height": vh}, is_mobile=True, has_touch=True)
        pp = pc.new_page(); pp.goto(B + "/"); pp.wait_for_load_state("load"); pp.wait_for_timeout(300)
        fits = pp.evaluate("[...document.querySelectorAll('.cop-slot')].every(s => s.getBoundingClientRect().bottom <= window.innerHeight)")
        ok(f"{vw}x{vh}: all 9 placeholders visible without scrolling", fits)
        ok(f"{vw}x{vh}: swiping the puzzle area can scroll the page", pp.evaluate("getComputedStyle(document.getElementById('cop-stage')).touchAction") != "none")
        for c in range(1, 10):
            cb = pp.locator(f'.cop-card[data-count="{c}"]').bounding_box(); sb = pp.locator(".cop-slot").nth(c-1).bounding_box()
            pp.mouse.move(cb["x"] + cb["width"]/2, cb["y"] + cb["height"]/2); pp.mouse.down()
            pp.mouse.move(sb["x"] + sb["width"]/2, sb["y"] + sb["height"]/2, steps=8); pp.mouse.up(); pp.wait_for_timeout(260)
        pp.wait_for_timeout(300)
        ok(f"{vw}x{vh}: puzzle solvable", pp.locator("#cop-overlay.show").count() == 1)
        pc.close()
    # 7b. very short screen: holding a card near the bottom edge scrolls the page
    pc = br.new_context(viewport={"width": 360, "height": 480}, is_mobile=True, has_touch=True)
    pp = pc.new_page(); pp.goto(B + "/"); pp.wait_for_load_state("load"); pp.wait_for_timeout(300)
    cb = pp.locator('.cop-card[data-count="1"]').bounding_box()
    pp.mouse.move(cb["x"] + cb["width"]/2, min(cb["y"] + cb["height"]/2, 300)); pp.mouse.down()
    pp.mouse.move(cb["x"] + cb["width"]/2, 470, steps=6); pp.wait_for_timeout(700)
    scrolled = pp.evaluate("window.scrollY"); pp.mouse.up()
    ok("short screen: dragging to bottom edge auto-scrolls", scrolled > 30, scrolled)
    pp.screenshot(path=f"{OUT}/puzzle_short.png"); pc.close()
    mp.evaluate("localStorage.setItem('mathifyUnlocked','1')")
    mp.goto(B + "/welcome/")
    mp.wait_for_load_state("load")
    ok("mobile menu hidden initially", not mp.is_visible(".nav-menu"))
    mp.click(".nav-toggle")
    ok("mobile menu opens", mp.is_visible(".nav-menu") and mp.is_visible("text=The Teacher"))
    mp.screenshot(path=f"{OUT}/mobile_menu.png")
    for path in PAGES:
        mp.goto(B + path)
        mp.wait_for_load_state("load")
        ok(f"mobile {path} no horizontal scroll", mp.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
        mp.screenshot(path=f"{OUT}/mob{path.strip('/').replace('/','_')}.png", full_page=True)

    # 8. desktop dropdown
    page.goto(B + "/welcome/")
    page.click(".dd-btn")
    ok("desktop About dropdown opens", page.is_visible(".dd-list a[href='/about-the-teacher']"))
    br.close()

srv.terminate()
fails = [r for r in results if not r[1]]
for name, good, extra in results:
    print(("PASS " if good else "FAIL ") + name + ("" if good else f"  -> {extra}"))
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
