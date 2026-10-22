#!/usr/bin/env python3
"""Generate Mathify content pages from one template (output is plain static HTML)."""
import html, os, sys

ROOT = sys.argv[1]

NAV = [
    ("/why-maths", "Why Maths!?"),
    ("DROPDOWN", "About", [("/about-mathify", "Mathify"), ("/about-the-teacher", "The Teacher")]),
    ("/fees-and-schedule", "Fees and Schedule"),
    ("/testimonials", "Testimonials"),
    ("/aptitude-test", "Aptitude Test"),
    ("/contact", "Contact"),
    ("LOGIN", "Login"),
]

WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91S17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.24-3.26-.68-2.75-1.09-4.5-3.9-4.63-4.08-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.99.95-2.26.24-.27.53-.34.71-.34h.51c.16 0 .38-.06.6.46.24.55.8 1.9.87 2.04.07.14.11.3.02.48-.09.18-.13.3-.27.46-.13.16-.28.36-.4.48-.13.13-.27.28-.12.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.6-.14.25.09 1.57.74 1.84.88.27.13.45.2.52.31.07.11.07.66-.17 1.33Z"/></svg>'
MAIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L4.4 7H4v.3l8 5.5 8-5.5V7h-.4L12 12.2Z"/></svg>'


def nav_html(current):
    items = []
    for entry in NAV:
        if entry[0] == "DROPDOWN":
            sub = "".join(
                f'<li><a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a></li>'
                for h, t in entry[2])
            items.append(
                f'<li class="dropdown"><button type="button" class="dd-btn" aria-haspopup="true" aria-expanded="false">{entry[1]}</button>'
                f'<ul class="dd-list">{sub}</ul></li>')
        elif entry[0] == "LOGIN":
            items.append('<li><a class="nav-login" href="/app/">Login</a></li>')
        else:
            h, t = entry
            items.append(f'<li><a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a></li>')
    return "".join(items)


def page(path, title, description, body, current=None, extra_scripts="", extra_head=""):
    full_title = "Mathify" if title == "Mathify" else f"{title} | Mathify"
    doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/assets/gate.js"></script>
  <title>{html.escape(full_title)}</title>
  <meta name="description" content="{html.escape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Mathify">
  <meta property="og:title" content="{html.escape(full_title)}">
  <meta property="og:description" content="{html.escape(description)}">
  <meta property="og:url" content="https://mathify.world{path}">
  <meta property="og:image" content="https://mathify.world/brand/mathify-share.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/site.css">{extra_head}
</head>
<body>
  <header class="site-header">
    <nav class="nav-wrap" aria-label="Main">
      <a class="brand" href="/"><img class="brand-lockup" src="/brand/mathify-logo-horizontal.svg" alt="Mathify" width="146" height="40"></a>
      <button type="button" class="nav-toggle" aria-label="Menu" aria-expanded="false">☰</button>
      <ul class="nav-menu">{nav_html(current)}</ul>
    </nav>
  </header>
  <main>
{body}
  </main>
  <footer class="site-footer">
    © Mathify · Tanmay Mogra · Pune, India ·
    <a href="https://wa.me/919766072237">WhatsApp</a> ·
    <a href="mailto:tanmaym88@gmail.com">Email</a> ·
    <a href="/feedback">Give feedback</a> ·
    <a href="/privacy">Privacy</a> ·
    <a href="/terms">Terms</a>
  </footer>
  <script src="/assets/nav.js"></script>{extra_scripts}
</body>
</html>
"""
    out_dir = os.path.join(ROOT, path.strip("/"))
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(doc)
    return doc


# ---------------- Welcome ----------------
welcome = """    <section class="hero">
      <h1>Welcome to the world of learning Mathematics!</h1>
    </section>
    <div class="tiles">
      <a class="tile" href="/why-maths"><strong>Why Maths!?</strong><span>Where Maths shows up — from engineering and AI to patterns in nature.</span></a>
      <a class="tile" href="/about-mathify"><strong>About Mathify</strong><span>Who the classes are for, how they run, online and offline.</span></a>
      <a class="tile" href="/about-the-teacher"><strong>The Teacher</strong><span>Tanmay Mogra — IIT alumnus, JEE AIR 328, 9+ years of teaching.</span></a>
      <a class="tile" href="/fees-and-schedule"><strong>Fees and Schedule</strong><span>Hourly billing, weekly schedule and the rescheduling policy.</span></a>
      <a class="tile" href="/testimonials"><strong>Testimonials</strong><span>What parents and students across India, UK and UAE say.</span></a>
      <a class="tile" href="/aptitude-test"><strong>Aptitude Test</strong><span>A quick picture puzzle. Can you crack the order?</span></a>
      <a class="tile" href="/contact"><strong>Contact</strong><span>Send an enquiry on WhatsApp or by email.</span></a>
    </div>"""
page("/", "Mathify", "Mathify — one-to-one Maths coaching by Tanmay Mogra (IIT alumnus, JEE AIR 328). Online worldwide and offline in Magarpatta, Pune.", welcome, current="/")

# ---------------- Why Maths ----------------
why = """    <div class="page">
      <h1 class="page-title">Why Maths!?</h1>
      <div class="card">
        <div class="feature">
          <figure><img src="/images/banner.webp" alt="Mathematics in all its forms — algebra, geometry, calculus and more" width="480" height="352"></figure>
          <p>Maths, the language of numbers and the science of patterns, reason, space and structure, has been developed and intrigued mankind for <strong>several centuries</strong>. It was part of the most ancients of civilisations: may it be Sumerian, Egyptian, Indian, Greek or Chinese. And over the past two millennia, it has been applied to several fields that have enriched our lives: engineering, medicine, finance, social sciences, actuarial science, sports, etc. Thus, it has become a <strong>foundation stone for our modern day civilisation</strong>. It has been studied (and it's fun to study) in its pure form too: to solve mathematical problems in its own domain.</p>
        </div>
        <div class="feature flip">
          <figure><img src="/images/neural.webp" alt="A neuron in an artificial neural network: inputs, weights and an activation function" width="640" height="336"></figure>
          <p>The primary application of Maths has been in engineering. Engineers use mathematical knowledge and tools to create buildings, bridges, computer software, automobiles, aircrafts and several other machines. So, from the device that you are reading this text on, to the vehicle that you use to travel everywhere, or from the electrical appliances that make your lives efficient, to the apartment that you are living in - Maths has been used everywhere. Lately, you would have surely heard about <strong>Artificial Intelligence!</strong> - the foundational bases for that too, are the Mathematical Concepts of Linear Algebra, Calculus and Optimisation!</p>
        </div>
        <div class="feature">
          <figure><img src="/images/nature.webp" alt="A fern frond curling in a Fibonacci spiral" width="310" height="163"></figure>
          <p>Our Mother Nature also has mathematical patterns hidden in it. You can find the Fibonacci series in the spirals of a pine cone, pineapple or sunflower seeds, you can see Ellipses in our planetary orbits, you can see Fractals in leaves of ferns and tree branches, and you can see Hexagonal Tessellations in a beehive. Maybe there are more ways in which Maths is hidden in nature, that you would find on your own!</p>
        </div>
      </div>
    </div>"""
page("/why-maths", "Why Maths!?", "Why learn Maths? From ancient civilisations to engineering, AI and the patterns of nature.", why, current="/why-maths")

# ---------------- About Mathify ----------------
about = """    <div class="page">
      <h1 class="page-title">About Mathify</h1>
      <div class="card">
        <h2>Whom are the classes for?</h2>
        <p>Mathify (or Maths Simplified), is a Maths coaching class, typically for students aged 13 to 17 - who are either struggling with concepts taught in school, or who want to explore Maths beyond their regular school curriculum (probably to target university entrance exams). Adults are also welcome, if they want to learn the Math usually taught to High School Students.</p>

        <h2>Whom are the classes not for?</h2>
        <p>If the student wants to just score marks in exams, without learning the concepts, it is advisable that the student doesn't enrol for the program.</p>

        <h2>The Pedagogy: How are the classes run?</h2>
        <ul>
          <li>The student and the teacher generally meet <strong>thrice a week</strong> (though it may vary depending on the student's desire and the student's and the teacher's mutually available times).</li>
          <li>Each session is <strong>1 hour</strong> long, focusing on learning the <strong>fundamental concepts</strong>, and applying them to <strong>solve problems</strong> of varied difficulty levels. The student is also encouraged to read theory from the textbook, thus developing the habit of learning from books.</li>
          <li>The teacher ensures that each and every concept is crystal clear in the mind of the student, running at the student's pace of understanding the concept. (S)he encourages students to ask questions and clarifies each and every iota of doubt or confusion that a student has, thus making the student <strong>confident about the foundations.</strong></li>
          <li>There are no lectures (which might make students sleepy) and no batches of students; the sessions are very <strong>individual-centric</strong> and <strong>interactive</strong>, thus making the students <strong>active learners</strong>, and not passive listeners.</li>
          <li>Even though there could be 1 to 5 students studying with the teacher at the same time, each student gets full attention from the teacher. And the teacher caters to a maximum of 20 students at any given point of time, thus maintaining a <strong>healthy student-teacher ratio</strong>.</li>
          <li>After the end of each session, appropriate homework is given to encourage self-learning and consolidate the concepts. Also, for online classes, the class notes are uploaded to a Google Drive folder shared with the student.</li>
        </ul>

        <h2>Presence</h2>
        <ul>
          <li><strong>Online:</strong> The student can join online classes that are run through iPad and Zoom (with screen-share), from anywhere in <strong>India, rest of Asia, Europe, Australia</strong> and <strong>Africa.</strong> The currently enrolled students reside in UK, Sydney, Dubai and India.</li>
          <li><strong>Offline:</strong> The student needs to come to the teacher's place in <strong>Magarpatta, Pune</strong>, India. The students that are currently enrolled in the offline classes come from Magarpatta City and Amanora Township.</li>
        </ul>

        <h2>Feedback</h2>
        <ul>
          <li>The students are encouraged to fill a feedback form, pertaining to their learning and experience with the teacher, on a Quarterly basis.</li>
          <li>The parent is free to discuss about the child's progress and give feedback anytime (s)he wishes too. A formal setup of regular meet-ups can also be arranged on request from the parent.</li>
        </ul>

        <h2>Admission</h2>
        <p>A student can take admission at any time of the year. The allotment of slots is on a first-come first-serve basis, provided there is a slot available with the teacher.</p>
      </div>
    </div>"""
page("/about-mathify", "About Mathify", "How Mathify classes work: one-to-one, interactive Maths coaching online and in Magarpatta, Pune.", about, current="/about-mathify")

# ---------------- The Teacher ----------------
teacher = """    <div class="page">
      <h1 class="page-title">The Teacher</h1>
      <div class="card teacher">
        <img src="/images/teacher.webp" alt="Tanmay Mogra" width="360" height="360">
        <div>
          <p>Mathify is primarily run by Tanmay Mogra, an <strong class="hl">IIT alumnus</strong> and a Mathematics Teacher having a teaching experience of 9+ years. He cleared the Joint Entrance Exam (JEE Advanced - touted to be one of the toughest undergraduate entrance exams in the world) in 2007, with an <strong class="hl">All India Rank of 328</strong>. He has a very strong hold of High School Maths Topics that are taught <strong>across the globe</strong>, which he learnt while preparing for the IITJEE, and from his own self-study and experience. He has taught 500+ students at prominent coaching institutes in India, and in private for students across countries <strong>(USA, UK, UAE, Singapore, India),</strong> and across curricula <strong>(JEE, IBDP, IGCSE, ICSE, ISC, CBSE)</strong>. He is very passionate about both Maths and Teaching, and has developed a great knack for teaching students in an enjoyable way.</p>
        </div>
      </div>
    </div>"""
page("/about-the-teacher", "The Teacher", "Tanmay Mogra — IIT alumnus, JEE Advanced AIR 328, Maths teacher with 9+ years of experience.", teacher, current="/about-the-teacher")

# ---------------- Fees ----------------
fees = """    <div class="page">
      <h1 class="page-title">Fees and Schedule</h1>
      <div class="card">
        <h2>Fees</h2>
        <p>The fees is charged on a <strong>per hour basis</strong>, payable at the end of every month (between the 1st and 5th of the next month). For example, if the student engages with a Mathify Teacher for 15 hours, for say the month of January, then the fees payable will be INR 15*(Hourly Rate), which is to be paid between the 1st and 5th of February.</p>
        <div class="table-wrap">
          <table class="fees" data-live>
            <caption>Hourly rates in INR, with effect from 1 November 2026</caption>
            <thead>
              <tr><th scope="col">Grade</th><th scope="col">Offline<br><span>Teacher's home, Magarpatta, Pune</span></th><th scope="col">Online<br><span>Students in India</span></th><th scope="col">Online<br><span>Students outside India</span></th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Grades 6–8</th><td>₹600</td><td>₹700</td><td>₹2,000</td></tr>
              <tr><th scope="row">Grades 9–10</th><td>₹800</td><td>₹900</td><td>₹2,500</td></tr>
              <tr><th scope="row">Grades 11–12</th><td>₹1,000</td><td>₹1,100</td><td>₹3,000</td></tr>
              <tr><th scope="row">JEE Advanced / Olympiad / IB HL / Further Maths</th><td>₹1,200</td><td>₹1,300</td><td>₹3,500</td></tr>
            </tbody>
          </table>
        </div>

        <h2>Class Schedule</h2>
        <p>There shall be a weekly schedule in place for the sessions, which shall be decided at the commencement of the program. It's recommended that the student follows the weekly schedule, but if there are <strong>examinations</strong> or <strong>health reasons</strong>, there is <strong>flexibility for rescheduling</strong> the classes.</p>

        <h2>Rescheduling/Cancellation Policy</h2>
        <p>The following policy is in place for cancellation or rescheduling of classes:</p>
        <ol>
          <li>If a scheduled class is to be cancelled or rescheduled by a student, it needs to be informed by the student or his/her parent at least <strong>3 hours prior</strong> to the scheduled time of the class. Else, the <strong>session will be counted for the fees.</strong></li>
          <li>If a scheduled class is to be cancelled or rescheduled by a teacher, (s)he shall inform the student or his/her parent at least <strong>3 hours prior</strong> to the scheduled time of the class. Else, there shall be a <strong>fee waiver of 1 hour's fees</strong> for that month.</li>
        </ol>
      </div>
    </div>"""
page("/fees-and-schedule", "Fees and Schedule", "Mathify fees (charged per hour, monthly), weekly class schedule and rescheduling policy.", fees, current="/fees-and-schedule",
     extra_scripts='\n  <script src="/assets/rates.js"></script>')

# ---------------- Testimonials ----------------
parents = [
    ("He takes effort to build solid foundation for Students! He is very patient, polite and helpful!", "Vikas Johri", "Pune, India"),
    ("Please stay the way you are , your teaching style is great.", "Ujjwal Mahajan", "Pune, India"),
    ("Sir, apart from very knowledgeable, is Polite, patient and understanding. Key qualities that make an excellent teacher!", "Vibha Jain", "Mumbai, India (parent of Aarav, Grade 6)"),
    ("You are genuinely one of the best teachers Anika has had throughout her schooling, Tanmay! While this result, of course, isn’t the best, her confidence in Maths as a subject is largely down to your encouragement, patience and efforts. We are truly grateful for everything you have done for her. 😊 Honestly, she is happy- UCL is the 4th best university in the country and in the top 8 worldwide", "Komal Dharendra", "Salisbury, UK"),
]
students = [
    ("I had been Sir’s student from Years 8-13, and I can confidently say he is one of the best teachers I’ve ever had. When I first started, I wasn’t extremely confident in my Maths skills due to not understanding the methods taught in class, but Sir would teach me alternative ways of approaching problems and I started to love the subject. I appreciated his enthusiasm for Maths and his patience when answering all of my questions and correcting my mistakes— even if it was a silly one like forgetting ‘+c’ in Integration. Sir encouraged me to think of answers on my own, even if I took a long time, rather than rushing and simply giving them to me. He’d also always check my understanding and push my knowledge to its limits with challenging questions that were beyond the curriculum, but equipped me with the skills to do well in my exams. Now I am starting medical school, I definitely miss our weekly classes, but I am extremely grateful to Sir for helping me reach this point. I think any student would be lucky to have him as their teacher :) A word of warning: no matter how much you dislike Maths, Sir’s teaching will make you fall in love with the subject!", "Anika Dharendra", "Salisbury, UK (Anika is currently studying in UCL, London)"),
    ("Tanmay sir is very knowledgeable. He really explains all concepts well and makes sure that I have understood the topic. Along with that he makes the classes fun and interesting.", "Arin Swadi", "Pune, India (Arin is currently studying in Purdue University, USA)"),
    ("He always tried to be pragmatic about Maths, his teaching was very eclectic and not at all monotonous, it really helped me gain my interest in the subject and understand it well.", "Nidhi Mehta", "Pune, India, Grade 9"),
    ("He explained each and every topic really well. He gave really helpful tips. He taught me all the different types of models of the chapter. And he was always available for doubt clearing", "Tanish Mehta", "Bangalore, India, Grade 11"),
    ("1) He explained everything very clearly 2) All my doubts were cleared", "Khwaish Mehta", "Dubai, UAE, Grade 9"),
    ("The teacher taught the concepts very well although the pace was slow. He always wrote down everything he told and shared the notes and the end of each class.This helped me a lot later on as i didn't have to keep asking him doubts continuously.", "Siddharth Ray", "Dubai, UAE, Grade 10"),
    ("The teacher was giving clear explanations of a concept and had various ways of practicing that concept to get better. He also knows what you are doing wrong overall in each class and then gives you an example and makes your concepts clear.", "Ashmik Mehngi", "Dubai, UAE, Grade 9"),
    ("He is an wonderful and amazing teacher. Whenever I study from him I understand my doubts and concepts too and he is a very calm, humble and polite person too.", "Khushii Luniya", "Jaipur, India, Grade 9"),
    ("Tanmay sir teaches in a way so that it is very easy to understand, the classes are always interactive and interesting. All my doubts are always cleared and I am given homework to practice, and any doubt/wrong answer is discussed.", "Rithwik Sharma", "Gurugram, India, Grade 10"),
    ("Not too fast or slow. Answers all the questions. Covers all the concepts in depth.", "Anonymous", ""),
    ("He is really good as he clears all the doubts and explains all the concepts unless and until they are not cleared to us. Moreover doesn’t rush with the syllabus but goes with the pace of the student", "Nimit Mahajan", "Pune, India, Grade 10"),
    ("Very calm, composed and confident while teaching and very appreciative.", "Hitanshu Sanghvi", "Pune, India, Grade 12"),
    ("He could answer my questions, which helped me to get a better understanding on the concept. He was interactive and helped me to understand the concepts by explaining it briefly.", "Anonymous", ""),
    ("The way sir asks if we have completed our homework and whether we have any doubts is very good. Moreover, I like that he clears all the doubts we have and does not move on the next question or topic until we are 100% clear", "Anonymous", ""),
    ("The speed was not too fast and he took time to explain each concept clearly.", "Anonymous", ""),
    ("He explained the concepts well and repeated it if I don't understand it. He teaches it in a slow enough pace so I understand.", "Kashvi", "Dubai, UAE, Grade 10"),
    ("Tanmay Sir is very knowledgable and knows about the nuances of maths. His understanding of maths is very strong and it rubs off onto the student.", "Anonymous", ""),
    ("Explanation is extremely clear and doubts are solved perfectly", "Abhinav Khemani", "Pune, India, Grade 9"),
    ("It was clear and concise. I understood the topics well and had adequate practice. I liked the emphasis on understanding over rote learning.", "Anonymous", ""),
    ("Clearly explained all the concepts and removed any doubts I had. Would go through questions and school tests with me as a practice to make sure I understood the concepts.", "Anonymous", ""),
    ("The Teacher Explains the concepts very clearly and is determined to help you understand the concept.", "Anonymous", ""),
    ("Expertise in the subject which made it easier for me to learn and understand concepts.", "Aviral M.", ""),
    ("The teacher explains the concepts very well and helps me solve all my doubts regarding any topic.", "Anonymous", ""),
    ("He explains the topic nicely.", "Avantika", ""),
    ("The speed was good- I understood all the concepts- Good knowledge", "Anonymous", ""),
    ("i learnt new concepts well", "Akshat G.", ""),
]


# Display order: strongest testimonials first (specific, heartfelt, real outcomes), short/generic ones last.
# Numbers are positions in the lists above, so the original wording stays untouched.
parents = [parents[i] for i in (3, 2, 0, 1)]
students = [students[i] for i in (0, 1, 6, 8, 2, 13, 19, 16, 18, 10, 7, 3, 5, 15, 17, 12, 9, 11, 20, 22, 21, 4, 14, 24, 23, 25)]

# Illustrated (clearly generic) avatar per testimonial — never a photo, so no one is mistaken for the writer.
AVATAR = {
    "Vikas Johri": "man", "Ujjwal Mahajan": "man", "Vibha Jain": "woman", "Komal Dharendra": "woman",
    "Anika Dharendra": "girl", "Arin Swadi": "boy", "Nidhi Mehta": "girl", "Tanish Mehta": "boy",
    "Khwaish Mehta": "girl", "Siddharth Ray": "boy", "Ashmik Mehngi": "boy", "Khushii Luniya": "girl",
    "Rithwik Sharma": "boy", "Nimit Mahajan": "boy", "Hitanshu Sanghvi": "boy", "Kashvi": "girl",
    "Abhinav Khemani": "boy", "Aviral M.": "boy", "Avantika": "girl", "Akshat G.": "boy",
}


def quotes(items):
    out, seen = [], {}
    for q, who, where in items:
        meta = f"<strong>{html.escape(who)}</strong>" + (f", {html.escape(where)}" if where else "")
        kind = AVATAR.get(who, "student")
        seen[kind] = seen.get(kind, 0) + 1          # rotate the 4 variants so neighbours differ
        av = f"{kind}-{(seen[kind] - 1) % 4 + 1}"
        out.append(f'          <blockquote class="quote"><img class="quote-avatar" src="/images/avatars/{av}.svg" alt="" width="56" height="56">'
                   f'<div class="quote-body"><p>“{html.escape(q)}”</p><footer>— {meta}</footer></div></blockquote>')
    return "\n".join(out)


testi = f"""    <div class="page">
      <h1 class="page-title">Testimonials</h1>
      <div class="card">
        <h2>Ratings from student feedback</h2>
        <p class="stats-note">Averages from all 29 anonymous feedback forms students submitted between 2021 and 2025, nothing left out.</p>
        <div class="stats">
          <div class="stat"><b>4.9<small>/5</small></b><span>Teacher's knowledge</span></div>
          <div class="stat"><b>4.6<small>/5</small></b><span>Answering questions</span></div>
          <div class="stat"><b>4.5<small>/5</small></b><span>Clarity of explanation</span></div>
          <div class="stat"><b>4.6<small>/5</small></b><span>Overall rating</span></div>
          <div class="stat"><b>8.9<small>/10</small></b><span>Would recommend</span></div>
          <div class="stat"><b>76%</b><span>Said the pace was just right</span></div>
        </div>
        <h2>Parents</h2>
        <div class="quotes">
{quotes(parents)}
        </div>
        <h2>Students</h2>
        <div class="quotes">
{quotes(students)}
        </div>
        <p class="cta">Studying with Mathify now? <a href="/feedback">Share your feedback →</a></p>
      </div>
    </div>"""
page("/testimonials", "Testimonials", "What parents and students in India, the UK and the UAE say about learning Maths with Tanmay.", testi, current="/testimonials")

# ---------------- Aptitude Test (counting-order puzzle; optional) ----------------
aptitude = """    <div class="puzzle-page">
      <h1 class="page-title">Aptitude Test</h1>
      <div id="cop">
        <div class="cop-bar">
          <button type="button" class="cop-icon" id="cop-shuffle" aria-label="Shuffle" title="Shuffle">↻</button>
          <a class="cop-icon cop-skip" id="cop-skip" href="/" aria-label="Continue" title="Continue">→</a>
          <span id="cop-msg" hidden></span>
        </div>
        <div id="cop-stage">
          <div id="cop-scatter"></div>
          <div id="cop-slots"></div>
        </div>
      </div>
      <div id="cop-overlay" role="dialog" aria-modal="true" aria-label="Puzzle solved">
        <div class="cop-modal">
          <h2>🎉🎉🎉🎉🎉</h2>
          <p id="cop-successText" hidden></p>
          <a class="cop-icon" id="cop-enter" href="/" aria-label="Go to the home page" title="Home">→</a>
          <button type="button" class="cop-icon cop-ghost" id="cop-again" aria-label="Play again" title="Play again">↻</button>
        </div>
      </div>
    </div>"""
page("/aptitude-test", "Aptitude Test", "A quick picture puzzle from Mathify — put the cards in the right order.", aptitude, current="/aptitude-test",
     extra_scripts='\n  <script src="/assets/puzzle.js"></script>',
     extra_head='\n  <link rel="stylesheet" href="/assets/puzzle.css">\n  <link rel="preload" href="/images/5cats.webp" as="image">')

# ---------------- Feedback ----------------
feedback = """    <div class="page">
      <h1 class="page-title">Give Feedback</h1>
      <div class="card">
        <p>Feedback is collected every quarter and is used to improve the classes. Please answer as honestly as possible; your name is optional.</p>
        <div class="tiles tiles-inline">
          <a class="tile" href="https://docs.google.com/forms/d/1Nib3F1pelKs_g_7IUYPM3jUmmJjZuuiPe2Y6ivfCNjA/viewform" target="_blank" rel="noopener"><strong>I'm a student →</strong><span>Ratings on clarity, pace and more, plus what you liked and what could be better. About 3 minutes.</span></a>
          <a class="tile" href="https://docs.google.com/forms/d/1aQEfXPcVUA8kfb0xCJ4viervJQGDwHttnPbLdyxy08Y/viewform" target="_blank" rel="noopener"><strong>I'm a parent →</strong><span>What you liked about the classes and any suggestions. About 2 minutes.</span></a>
        </div>
      </div>
    </div>"""
page("/feedback", "Give Feedback", "Feedback forms for current Mathify students and parents.", feedback)

# ---------------- Contact ----------------
contact = f"""    <div class="page">
      <h1 class="page-title">Contact</h1>
      <div class="card">
        <div class="contact-direct">
          <a class="pill" href="https://wa.me/919766072237" target="_blank" rel="noopener">{WA_SVG} WhatsApp: +91 97660 72237</a>
          <a class="pill" href="mailto:tanmaym88@gmail.com">{MAIL_SVG} tanmaym88@gmail.com</a>
        </div>

        <h2>Enquiry form</h2>
        <p class="form-intro">Fields marked <span class="req">*</span> are needed; the rest help plan the classes.</p>
        <form id="enquiry" novalidate>
          <fieldset>
            <legend>Student</legend>
            <div class="form-grid">
              <div>
                <label for="f-student">Student's name <span class="req">*</span></label>
                <input id="f-student" name="student" type="text" autocomplete="off" required>
              </div>
              <div>
                <label for="f-gender">Student's gender <span class="req">*</span></label>
                <select id="f-gender" name="gender" required>
                  <option value="">Select…</option>
                  <option>Male</option><option>Female</option><option>Others</option>
                </select>
              </div>
              <div>
                <label for="f-dob">Date of birth <span class="req">*</span></label>
                <input id="f-dob" name="dob" type="date" required>
              </div>
              <div>
                <label for="f-grade">Grade / Year</label>
                <input id="f-grade" name="grade" type="text" placeholder="e.g. 10th, Year 12">
              </div>
              <div>
                <label for="f-semail">Student's Gmail address <span class="req">*</span></label>
                <input id="f-semail" name="semail" type="email" autocomplete="off" placeholder="name@gmail.com" required>
                <span class="field-hint">Used to sign in to the Mathify app — must be a Gmail address.</span>
              </div>
              <div>
                <label for="f-sphone">Student's contact number <span class="req">*</span></label>
                <input id="f-sphone" name="sphone" type="tel" autocomplete="off" inputmode="tel" placeholder="+91 …" required>
              </div>
              <div class="full"><span class="subhead">Student's address</span></div>
              <div class="full">
                <label for="f-saddr1">Address line 1</label>
                <input id="f-saddr1" name="saddr1" type="text" autocomplete="section-student address-line1" placeholder="House / flat no., building, street">
              </div>
              <div class="full">
                <label for="f-saddr2">Address line 2 <span class="opt">(optional)</span></label>
                <input id="f-saddr2" name="saddr2" type="text" autocomplete="section-student address-line2" placeholder="Area, locality, landmark">
              </div>
              <div>
                <label for="f-country">Country</label>
                <input id="f-country" name="country" type="text" autocomplete="section-student country-name">
              </div>
              <div>
                <label for="f-sstate">State / province / region</label>
                <input id="f-sstate" name="sstate" type="text" autocomplete="section-student address-level1">
              </div>
              <div>
                <label for="f-city">City / town</label>
                <input id="f-city" name="city" type="text" autocomplete="section-student address-level2">
              </div>
              <div>
                <label for="f-spostal">Postal / ZIP code</label>
                <input id="f-spostal" name="spostal" type="text" autocomplete="section-student postal-code">
              </div>
            </div>
          </fieldset>

          <fieldset id="parent-set">
            <legend>Parent/Guardian</legend>
            <p class="adult-note" id="adult-note" hidden>The student is 18 or older, so parent/guardian details are optional.</p>
            <div class="form-grid">
              <div>
                <label for="f-parent">Parent/guardian's name <span class="req preq">*</span></label>
                <input id="f-parent" name="parent" type="text" autocomplete="name">
              </div>
              <div>
                <label for="f-phone">Parent/guardian's contact number (WhatsApp) <span class="req preq">*</span></label>
                <input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+91 …">
              </div>
              <div class="full">
                <label for="f-pemail">Parent/guardian's Gmail address <span class="req preq">*</span></label>
                <input id="f-pemail" name="pemail" type="email" autocomplete="email" placeholder="name@gmail.com">
              </div>
              <div class="full"><span class="subhead">Parent/guardian's address</span>
                <label class="check"><input type="checkbox" id="f-psame" name="psame" value="Yes" checked> Same as the student's address</label>
              </div>
            </div>
            <div class="form-grid" id="paddr" hidden>
              <div class="full">
                <label for="f-paddr1">Address line 1</label>
                <input id="f-paddr1" name="paddr1" type="text" autocomplete="section-parent address-line1" placeholder="House / flat no., building, street">
              </div>
              <div class="full">
                <label for="f-paddr2">Address line 2 <span class="opt">(optional)</span></label>
                <input id="f-paddr2" name="paddr2" type="text" autocomplete="section-parent address-line2" placeholder="Area, locality, landmark">
              </div>
              <div>
                <label for="f-pcountry">Country</label>
                <input id="f-pcountry" name="pcountry" type="text" autocomplete="section-parent country-name">
              </div>
              <div>
                <label for="f-pstate">State / province / region</label>
                <input id="f-pstate" name="pstate" type="text" autocomplete="section-parent address-level1">
              </div>
              <div>
                <label for="f-pcity">City / town</label>
                <input id="f-pcity" name="pcity" type="text" autocomplete="section-parent address-level2">
              </div>
              <div>
                <label for="f-ppostal">Postal / ZIP code</label>
                <input id="f-ppostal" name="ppostal" type="text" autocomplete="section-parent postal-code">
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Classes</legend>
            <div class="form-grid">
              <div class="full">
                <label for="f-exams">Curriculum / target exams</label>
                <input id="f-exams" name="exams" type="text" placeholder="e.g. IGCSE, CBSE, JEE, Olympiads">
              </div>
              <div class="full">
                <span class="label">Objective of enrolling</span>
                <div class="choices">
                  <label><input type="radio" name="objective" value="Prepare for exams"> Prepare for exams</label>
                  <label><input type="radio" name="objective" value="Learn Maths for fun / curiosity"> Learn Maths for fun / curiosity</label>
                  <label><input type="radio" name="objective" value="Both"> Both</label>
                </div>
              </div>
              <div>
                <label for="f-mode">Preferred mode</label>
                <select id="f-mode" name="mode">
                  <option value="">Select…</option>
                  <option>Online</option>
                  <option>Offline (Magarpatta, Pune)</option>
                </select>
              </div>
              <div>
                <label for="f-hours">Hours per week</label>
                <input id="f-hours" name="hours" type="number" min="1" max="20" step="1" inputmode="numeric" placeholder="e.g. 3">
              </div>
              <div>
                <label for="f-days">Preferred days</label>
                <input id="f-days" name="days" type="text" placeholder="e.g. Mon, Wed, Sat">
              </div>
              <div>
                <label for="f-time">Preferred time (IST)</label>
                <input id="f-time" name="time" type="text" placeholder="e.g. 5–7 pm">
              </div>
              <div>
                <label for="f-level">How good is the student at Maths? (1–10)</label>
                <select id="f-level" name="level">
                  <option value="">Select…</option>
                  <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                  <option>6</option><option>7</option><option>8</option><option>9</option><option>10</option>
                </select>
              </div>
              <div>
                <label for="f-demo">Would you like a demo class?</label>
                <select id="f-demo" name="demo">
                  <option value="">Select…</option>
                  <option>Yes</option><option>No</option>
                </select>
              </div>
              <div class="full">
                <label for="f-source">How did you come to know about Mathify?</label>
                <select id="f-source" name="source">
                  <option value="">Select…</option>
                  <option>Word of Mouth (Online/Offline)</option><option>Internet Search</option>
                  <option>Advertisement</option><option>Others</option>
                </select>
              </div>
              <div class="full">
                <label for="f-message">Anything else? <span class="opt">(optional)</span></label>
                <textarea id="f-message" name="message" placeholder="Topics you need help with, upcoming exams…"></textarea>
              </div>
            </div>
          </fieldset>

          <div class="hp" aria-hidden="true"><label for="f-website">Leave this empty</label><input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
          <div class="form-error" id="form-error" role="alert"></div>
          <div class="send-row">
            <button type="button" class="btn btn-wa" id="send-wa">{WA_SVG} Send on WhatsApp</button>
            <a class="btn btn-mail" id="send-mail" href="mailto:tanmaym88@gmail.com">{MAIL_SVG} Send by Email</a>
          </div>
          <p class="form-note">Both buttons open your own WhatsApp or email app with the enquiry filled in — just press send there. A copy is also saved securely for Mathify to follow up; it is never shared.</p>
        </form>
      </div>
    </div>"""
page("/contact", "Contact", "Contact Mathify — send an enquiry on WhatsApp or by email.", contact, current="/contact",
     extra_scripts='\n  <script src="/assets/contact.js"></script>')

# ---------------- Privacy ----------------
privacy = """    <div class="page">
      <h1 class="page-title">Privacy Policy</h1>
      <div class="card prose">
        <p><em>Last updated: 20 October 2026</em></p>
        <p>Mathify (mathify.world) is a Maths tutoring practice run by Tanmay Mogra in Pune, India. This page explains what information Mathify collects and how it is used.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Enquiries:</strong> when you send the contact form, the details you type (student and parent names, email, phone, grade, preferences and message) are saved so Mathify can reply.</li>
          <li><strong>Student records:</strong> for enrolled students, Mathify keeps the class schedule, attendance, hourly fee, payments and invoices.</li>
          <li><strong>Google sign-in:</strong> when a student, parent or the teacher signs in to <a href="/app/">mathify.world/app</a> with Google, we receive only the account's name, email address and profile picture. The email is used to match you to your student record. We never see or store your Google password, and we do not access your Gmail, Drive or any other Google data.</li>
          <li><strong>Cookies and browser storage:</strong> a single sign-in cookie keeps you logged in for up to 14 days. The home-page puzzle remembers in your browser that you solved it. No advertising or tracking cookies are used.</li>
        </ul>
        <h2>How it is used</h2>
        <p>Only to run classes: replying to enquiries, scheduling, recording attendance, and preparing fee invoices and reminders. Your information is never sold, rented or used for advertising.</p>
        <h2>Who can see it</h2>
        <p>Only the teacher (Tanmay Mogra). A signed-in student or parent can see only their own records. The data is stored on Cloudflare's servers, which host this website. Invoices and reminders you choose to send open in your own WhatsApp or email app.</p>
        <h2>Your choices</h2>
        <p>You can ask to see, correct or delete your information at any time by writing to <a href="mailto:tanmaym88@gmail.com">tanmaym88@gmail.com</a> or on <a href="https://wa.me/919766072237">WhatsApp</a>. Records of former students are deleted on request.</p>
        <h2>Changes</h2>
        <p>If this policy changes, the updated version will be posted on this page with a new date.</p>
      </div>
    </div>"""
page("/privacy", "Privacy Policy", "How Mathify collects, uses and protects your information.", privacy)

# ---------------- Terms ----------------
terms = """    <div class="page">
      <h1 class="page-title">Terms of Use</h1>
      <div class="card prose">
        <p><em>Last updated: 20 October 2026</em></p>
        <p>These terms cover the mathify.world website and the Mathify student app at <a href="/app/">mathify.world/app</a>, run by Tanmay Mogra, Pune, India.</p>
        <h2>Classes and fees</h2>
        <p>Class fees, billing and the rescheduling and cancellation policy are set out on the <a href="/fees-and-schedule">Fees and Schedule</a> page and agreed when a student enrols.</p>
        <h2>Using the app</h2>
        <ul>
          <li>Sign in only with the Google account registered with Mathify for your child or yourself.</li>
          <li>Keep your Google account secure; anyone who can sign in to it can see your Mathify records.</li>
          <li>Tell Mathify if any attendance, fee or payment record looks wrong, and it will be corrected.</li>
        </ul>
        <h2>Content</h2>
        <p>The text, images and teaching material on this website belong to Mathify and may not be copied for commercial use without permission.</p>
        <h2>No guarantee</h2>
        <p>The website and app are provided as they are. Mathify works to keep them accurate and available but cannot promise they will always be error-free or online.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: <a href="mailto:tanmaym88@gmail.com">tanmaym88@gmail.com</a>.</p>
        <p>See also the <a href="/privacy">Privacy Policy</a>.</p>
      </div>
    </div>"""
page("/terms", "Terms of Use", "Terms of use for the Mathify website and student app.", terms)

print("pages written")

# cache-busting version tags on CSS/JS/image links (all pages, incl. hand-written ones)
import subprocess
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "stamp_assets.py"), ROOT], check=True)
