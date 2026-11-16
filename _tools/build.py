#!/usr/bin/env python3
"""Generates the site pages (shared nav, footer, page content) as static HTML. Run from the repo root: python3 _tools/build.py ."""
import os, sys, html
OUT = sys.argv[1]

EMAIL = "dave.naserbakht@gmail.com"
LINKEDIN = "https://www.linkedin.com/in/dave-nab/"
INSTA = "https://www.instagram.com/ieltsdave/"
FORM = "https://forms.gle/1BSwoCTL5CjwVJJi6"
PAY_WRITING = "https://www.paypal.com/ncp/payment/GRJE2W72TS2LC"
PAY_GE = "https://www.paypal.com/ncp/payment/UWDH5M4MPMHYU"
PAY_HEDGING = "https://www.paypal.com/ncp/payment/TYYAE8VP9CW2U"
SITE = "https://davenab.com/"

I = {
 "chev": '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
 "moon": '<svg class="moon-i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
 "sun": '<svg class="sun-i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 "menu": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
 "x": '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 "in": '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
 "ig": '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
 "mail": '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
 "left": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
 "right": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
}
ARR = '<span class="arr" aria-hidden="true">→</span>'
EXT = '<span aria-hidden="true">↗</span>'
FAV = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23FFFF00'/%3E"
       "%3Ctext x='32' y='42' font-family='Inter,Arial,sans-serif' font-size='27' font-weight='800' letter-spacing='-1.5' text-anchor='middle' fill='%2314181f'%3EDN%3C/text%3E%3C/svg%3E")

COURSES = [
 ("ielts-courses/", "IELTS Courses", "Live coaching and self-paced Writing"),
 ("ielts-mock-test/", "IELTS Mock Test", "Speaking and Writing, real exam conditions"),
 ("general-english/", "General English", "Fluency and level-up programs"),
 ("general-english/speaking-fluency/", "Speaking Fluency", "Flexible 1–5 session blocks"),
 ("general-english/level-up/", "Level UP Course", "CEFR A1 to C2"),
]
TOP1 = [("apps/", "AI Apps")]
RES = [
 ("resources/students/", "For students", "Self-study packs and free practice"),
 ("resources/teachers/", "For teachers", "Lesson kits, courses and free slides"),
 ("resources/", "All resources", "Not sure? Start here"),
]
TOP2 = [("testimonials/", "Testimonials"), ("gallery/", "Gallery"), ("about/", "About")]
TOP = TOP1 + TOP2

def words(text):
    """Wrap words for the hero rise animation; keeps inline markup tokens intact (|...| = highlight)."""
    out = []; i = 0
    for tok in text.split(" "):
        hl = tok.startswith("|"); end = tok.endswith("|")
        t = tok.strip("|")
        inner = f'<span>{t}</span>'
        w = f'<span class="w" style="--i:{i}">{inner}</span>'
        out.append((w, hl, end)); i += 1
    s = ""; open_ = False
    for w, hl, end in out:
        if hl: s += '<span class="hl">'; open_ = True
        s += w
        if end and open_: s += '</span>'; open_ = False
        s += " "
    return s.strip()


OG_IMG = SITE + "assets/og/davenab-share.png"
OG = (f'<meta property="og:image" content="{OG_IMG}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
      f'<meta property="og:image:alt" content="Dave Nab: AI learning apps, resources and IELTS courses">\n<meta property="og:site_name" content="Dave Nab">\n'
      f'<meta name="twitter:card" content="summary_large_image">\n')

# Useful outside links (open in a new tab). Chosen for students and teachers, not for ranking tricks.
X = {
 "ielts":   ("IELTS: official test information", "https://ielts.org/"),
 "bc":      ("British Council: free IELTS preparation", "https://takeielts.britishcouncil.org/take-ielts/prepare"),
 "idp":     ("IDP: IELTS practice and tips", "https://ielts.idp.com/prepare"),
 "phrase":  ("Academic Phrasebank (University of Manchester)", "https://www.phrasebank.manchester.ac.uk/"),
 "owl":     ("Purdue OWL: academic writing guides", "https://owl.purdue.edu/owl/purdue_owl.html"),
 "apa":     ("APA Style: referencing", "https://apastyle.apa.org/"),
 "camb":    ("Cambridge Dictionary", "https://dictionary.cambridge.org/"),
 "oxf":     ("Oxford Learner’s Dictionaries", "https://www.oxfordlearnersdictionaries.com/"),
 "ted":     ("TED Talks", "https://www.ted.com/talks"),
 "bne":     ("Breaking News English", "https://breakingnewsenglish.com/"),
 "quizlet": ("Quizlet", "https://quizlet.com/"),
 "eapf":    ("EAP Foundation: Academic Word List", "https://www.eapfoundation.com/vocab/academic/awllists/"),
 "cefr":    ("CEFR levels (Council of Europe)", "https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale"),
}
# path -> ([(site path, label), ...], [outside link keys])
RELATED = {
 "index.html": ([], []),
 "apps/index.html": ([("resources/students/", "Resources for students"), ("resources/teachers/", "Resources for teachers"), ("book/", "Book a class")], ["ted", "phrase", "camb"]),
 "ielts-courses/index.html": ([("ielts-mock-test/", "IELTS Mock Test"), ("testimonials/", "Testimonials"), ("book/?service=ielts-live", "Book a block")], ["ielts", "bc", "idp"]),
 "ielts-mock-test/index.html": ([("ielts-courses/", "IELTS Courses"), ("book/?service=speaking-mock", "Book a mock test"), ("testimonials/", "Testimonials")], ["ielts", "bc", "idp"]),
 "general-english/index.html": ([("general-english/speaking-fluency/", "Speaking Fluency"), ("general-english/level-up/", "Level UP Course"), ("book/", "Book a class")], ["cefr", "camb", "bne"]),
 "general-english/speaking-fluency/index.html": ([("general-english/level-up/", "Level UP Course"), ("ielts-mock-test/", "IELTS Speaking Mock Test"), ("testimonials/", "Testimonials")], ["bne", "camb", "ted"]),
 "general-english/level-up/index.html": ([("general-english/speaking-fluency/", "Speaking Fluency"), ("ielts-courses/", "IELTS Courses"), ("book/?service=level-up", "Ask about placement")], ["cefr", "oxf", "bne"]),
 "testimonials/index.html": ([("ielts-courses/", "IELTS Courses"), ("ielts-mock-test/", "IELTS Mock Test"), ("book/", "Book a class")], ["ielts", "bc"]),
 "gallery/index.html": ([("about/", "About Dave"), ("testimonials/", "Testimonials"), ("book/", "Book a class")], []),
 "about/index.html": ([("testimonials/", "Testimonials"), ("apps/", "AI apps"), ("resources/teachers/", "Resources for teachers")], []),
 "book/index.html": ([("ielts-courses/", "IELTS Courses"), ("ielts-mock-test/", "Mock test fees"), ("testimonials/", "Testimonials")], []),
 "resources/index.html": ([("apps/", "AI apps"), ("ielts-courses/", "IELTS Courses"), ("book/", "Book a class")], ["quizlet", "phrase", "eapf"]),
 "resources/students/index.html": ([("apps/", "AI apps"), ("ielts-courses/", "IELTS Courses"), ("ielts-mock-test/", "IELTS Mock Test")], ["phrase", "owl", "camb", "eapf"]),
 "resources/teachers/index.html": ([("apps/", "AI apps for your class"), ("resources/hedging-in-academic-writing/", "Hedging lesson"), ("resources/students/", "Resources for students")], ["phrase", "apa", "eapf", "cefr"]),
 "resources/hedging-in-academic-writing/index.html": ([("resources/teachers/", "More teacher resources"), ("nominalisation-hedging-trainer/", "Nominalisation and Hedging Trainer (app)"), ("apps/", "AI apps")], ["phrase", "owl"]),
}

def related_strip(L, spec):
    if not spec: return ""
    inner, outer = spec
    if not inner and not outer: return ""
    a = "".join(f'<a class="rel-link" href="{L(h)}">{t} {ARR}</a>' for h, t in inner)
    b = "".join(f'<li><a href="{X[k][1]}" target="_blank" rel="noopener">{X[k][0]} {EXT}</a></li>' for k in outer)
    ext = f'<div class="rel-ext"><h3>Useful links</h3><ul>{b}</ul></div>' if b else ""
    return f'<section class="related" aria-label="Related pages"><div class="wrap"><div class="rel-in"><div class="rel-main"><h2>Keep exploring</h2><div class="rel-links">{a}</div></div>{ext}</div></div></section>'

def page(path, title, desc, body, cur="", canonical=None, extra_head="", extra_foot=""):
    depth = path.count("/")
    P = "../" * depth
    def L(p): return P + p if p else (P or "./")
    if path == "404.html":  # served at any URL depth, so it needs root-absolute links
        P = "/"
        def L(p): return "/" + p
    if "og:image" not in extra_head:
        extra_head = OG + extra_head
    rel_html = related_strip(L, RELATED.get(path))
    is_course = cur in [c[0] for c in COURSES]
    is_res = cur.startswith("resources/")
    rsub = "".join(f'<li><a href="{L(h)}"{" aria-current=\"page\"" if cur==h else ""}>{t}<small>{d}</small></a></li>' for h, t, d in RES)
    sheet_r = "".join(f'<li class="sub-l"><a href="{L(h)}">{t}</a></li>' for h, t, d in RES)
    sub = "".join(f'<li><a href="{L(h)}"{" aria-current=\"page\"" if cur==h else ""}>{t}<small>{d}</small></a></li>' for h, t, d in COURSES)
    top1 = "".join(f'<li><a href="{L(h)}"{" aria-current=\"page\"" if cur==h else ""}>{t}</a></li>' for h, t in TOP1)
    top = "".join(f'<li><a href="{L(h)}"{" aria-current=\"page\"" if cur==h else ""}>{t}</a></li>' for h, t in TOP2)
    sheet_c = "".join(f'<li class="sub-l"><a href="{L(h)}">{t}</a></li>' for h, t, d in COURSES)
    sheet_1 = "".join(f'<li><a href="{L(h)}">{t}</a></li>' for h, t in TOP1)
    sheet_t = "".join(f'<li><a href="{L(h)}">{t}</a></li>' for h, t in TOP2)
    canon = canonical if canonical is not None else SITE + path.replace("index.html", "")
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canon}">
<meta name="theme-color" content="#faf8f4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1319" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="{canon}">
<link rel="icon" href="{FAV}">
<script>(function(d){{d.classList.add("js");try{{var t=localStorage.getItem("theme");if(t)d.dataset.theme=t}}catch(e){{}}}})(document.documentElement)</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{P}assets/style.css">
{extra_head}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"><span></span></div>
<header class="site-nav">
  <div class="wrap nav-in">
    <a class="brand" href="{L('')}" aria-label="Dave Nab, home"><span class="mark">DN</span><span>Dave Nab<span class="dot">.</span></span></a>
    <nav aria-label="Main">
      <ul class="menu">
        {top1}
        <li class="has-sub{' cur' if is_res else ''}"><button class="drop" aria-expanded="false" aria-haspopup="true">Resources {I['chev']}</button><ul class="sub">{rsub}</ul></li>
        <li class="has-sub{' cur' if is_course else ''}"><button class="drop" aria-expanded="false" aria-haspopup="true">Courses {I['chev']}</button><ul class="sub">{sub}</ul></li>
        {top}
      </ul>
    </nav>
    <div class="nav-actions">
      <button class="icon-btn theme" aria-label="Switch light or dark mode" title="Light / dark mode">{I['moon']}{I['sun']}</button>
      <a class="btn primary sm nav-cta" href="{L('book/')}">Book a class</a>
      <a class="btn primary sm nav-book" href="{L('book/')}">Book</a>
      <button class="icon-btn burger" aria-label="Open menu" aria-expanded="false" aria-controls="sheet">{I['menu']}</button>
    </div>
  </div>
</header>
<div class="sheet" id="sheet" aria-hidden="true">
  <div class="sheet-top"><a class="brand" href="{L('')}"><span class="mark">DN</span><span>Dave Nab<span class="dot">.</span></span></a><button class="icon-btn sheet-close" aria-label="Close menu">{I['x']}</button></div>
  <ul>
    <li><a href="{L('')}">Home</a></li>
    {sheet_1}
    <li class="label">Resources</li>
    {sheet_r}
    <li class="label">Courses</li>
    {sheet_c}
    {sheet_t}
    <li><a href="{L('book/')}">Book a class</a></li>
  </ul>
</div>
<main id="main">
{body(L)}
{rel_html}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="{L('')}"><span class="mark">DN</span><span>Dave Nab<span class="dot">.</span></span></a>
        <p style="margin-top:14px;max-width:34ch">CELTA and DELTA qualified English teacher. IELTS, Academic English and EAP.</p>
        <div class="social">
          <a href="{LINKEDIN}" target="_blank" rel="noopener" aria-label="LinkedIn">{I['in']}</a>
          <a href="{INSTA}" target="_blank" rel="noopener" aria-label="Instagram">{I['ig']}</a>
          <a href="mailto:{EMAIL}" aria-label="Email {EMAIL}">{I['mail']}</a>
        </div>
      </div>
      <div><h4>Courses</h4><ul>{''.join(f'<li><a href="{L(h)}">{t}</a></li>' for h,t,d in COURSES)}</ul></div>
      <div><h4>Explore</h4><ul>{''.join(f'<li><a href="{L(h)}">{t}</a></li>' for h,t in TOP1)}<li><a href="{L('resources/students/')}">Resources for students</a></li><li><a href="{L('resources/teachers/')}">Resources for teachers</a></li>{''.join(f'<li><a href="{L(h)}">{t}</a></li>' for h,t in TOP2)}</ul></div>
      <div><h4>Contact</h4><ul><li><a href="mailto:{EMAIL}">{EMAIL}</a></li><li><a href="{L('book/')}">Book a class</a></li><li><a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn {EXT}</a></li><li><a href="{INSTA}" target="_blank" rel="noopener">Instagram {EXT}</a></li></ul></div>
    </div>
    <div class="foot-bottom">
      <span>© <span id="yr">2026</span> Dave Nab. All rights reserved.</span>
      <span>This site is not affiliated with, endorsed by, or representing any institution mentioned.</span>
    </div>
  </div>
</footer>
<script src="{P}assets/app.js"></script>{extra_foot.replace("{P}",P)}
</body>
</html>
'''
    fp = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, "w").write(doc)

def img(L, name, alt, w=None, h=None, cls="", lazy=True, extra=""):
    wh = f' width="{w}" height="{h}"' if w else ""
    return f'<img src="{L("assets/img/"+name)}" alt="{html.escape(alt)}"{wh}{" loading=\"lazy\"" if lazy else ""} decoding="async"{(" class=\""+cls+"\"") if cls else ""}{extra}>'

def quote(L, text, name, photo, sub="IELTS student", d=0):
    return f'''<figure class="quote reveal" style="--d:{d}s"><blockquote>{text}</blockquote><figcaption class="who">{img(L, photo, name, 48, 48)}<div><b>{name}</b><span>{sub}</span></div></figcaption></figure>'''

def contact_band(L, h="Interested in collaboration, courses, or assessment work? Let’s connect.", p="Send me your details, preferred date and time, and I’ll get back to you within 24 hours."):
    return f'''<section><div class="wrap"><div class="contact reveal-scale">
  <div class="sun-blob" data-parallax aria-hidden="true"></div>
  <div style="position:relative">
    <span class="eyebrow" style="color:inherit;opacity:.85">Get in touch</span>
    <h2 style="margin-top:16px">{h}</h2>
    <p>{p}</p>
    <div class="email-line"><span>Email</span><code>{EMAIL}</code></div>
    <div class="cta"><a class="btn" href="{L('book/')}">Book a class {ARR}</a><a class="btn ghost" href="mailto:{EMAIL}">{I['mail']} Email</a><a class="btn ghost" href="{LINKEDIN}" target="_blank" rel="noopener">{I['in']} LinkedIn</a><a class="btn ghost" href="{INSTA}" target="_blank" rel="noopener">{I['ig']} Instagram</a></div>
  </div></div></div></section>'''

def crumb(L, *items):
    parts = [f'<a href="{L("")}">Home</a>']
    for it in items[:-1]: parts.append(f'<a href="{L(it[0])}">{it[1]}</a>')
    parts.append(f'<span aria-current="page">{items[-1]}</span>')
    return '<nav class="crumb fade-up" style="--d:0s" aria-label="Breadcrumb">' + ' <span aria-hidden="true">/</span> '.join(parts) + '</nav>'

# ------------------------------------------------------------------ data
T_HOME = [
 ("From the very beginning, the classes were run with precise planning and sharp attention to detail. I learned how to critique my own work and what an examiner looks for in Writing and Speaking. Even very minor mistakes, which I never thought were mistakes, were pointed out clearly. The constant encouragement motivated me to keep practicing. A truly excellent mentor and teacher, with rare kindness, who could calm my stress completely with their guidance.", "Marjan", "t-marjan.webp"),
 ("Well, to be honest, I am not a big fan of tutoring but Dave is special to me because he is a master of turning complex things into simple stuff. He changed my way of thinking about English and took me to higher levels. I have learned a lot of new things in just 45 days and he has helped me to increase my exam IELTS score hugely.", "Amin", "tt-amin.webp"),
 ("I scored an overall band 7 in IELTS, higher than my university required, thanks to the amazing support I received. The classes were enjoyable, the materials were clear and comprehensive, and the feedback was spot on. I highly recommend these classes to anyone aiming for a strong IELTS result.", "Mahsa", "t-mahsa.webp"),
]
T_ALL = [
 ("Well, to be honest, I am not a big fan of tutoring but Dave is special to me because he is a master of turning complex things into simple stuff. He changed my way of thinking about English and took me to higher levels. I have learned a lot of new things in just 45 days and he has helped me to increase my exam IELTS score hugely. Actually, in my eyes, the best advantage of Dave over others is that I feel comfortable with him. Also, his patience is great. Sometimes I have lost control of myself because I have made a lot of mistakes in my lessons, but he has been always patient and helped me to fix them.", "Amin", "tt-amin.webp"),
 ("Although my placement test score was 5.5, I knew with your help I would definitely reach band 7. If that unexpected event hadn’t happened and I hadn’t gone nearly 20 days without studying right before the exam, I’m sure I would have achieved a higher score. But even getting 6.5 shows how deep and effective your teaching method is — it really sticks in the mind, and even without intensive study, it’s possible to achieve a solid result.", "Maryam", "tt-maryam.webp"),
 ("Your class had so many positive points, but if I want to give short and useful feedback:<br><br>First, I was never really a fan of private classes before. I always thought they would feel dry and formal. But your class was nothing like that — it had such a warm and friendly atmosphere.<br><br>Second, the tips you give in class are truly practical! For example, Listening Part 4, which used to be very difficult for me at first, became the ‘tea break part,’ as you call it 😂. And Speaking used to be a real struggle — I couldn’t say more than two sentences — but on exam day, I spoke like a nightingale 😎.<br><br>Third, everything in class moved forward smoothly and in a relaxed but well-structured way. That made me feel confident that nothing was being left out. Even on days when I was completely fed up with English, you didn’t create any stress and very coolly told me to take a week off from studying!<br><br>In short, everything was perfect, and without exaggeration, you make the best possible results happen in the shortest time.", "Sara", "tt-sara.webp"),
 ("Before your classes, I had gone to several institutes, but they only taught general test-taking tips and I couldn’t fix my weaknesses there. I’m really glad that, despite all the stress I had to meet my university deadline, my friend introduced me to you. The detailed points you gave me in every skill felt like you knew my exact problems, and you gave me a very precise plan to fix them. It was excellent.", "Tooraj", "tt-tooraj.webp"),
 ("I received my IELTS score and my overall band is 7. I wanted to thank you for all your help, guidance, and everything I learned from you. My scores matched exactly what you predicted about me in our last session.<br><br>I truly enjoyed your classes and learned so many useful things. The materials you used were visually engaging and very complete and comprehensive, to the point that I hardly needed to study other resources. I’m very happy that I achieved a higher score than what my university required, and this was only possible thanks to your incredible support.<br><br>I confidently recommend your classes to anyone who needs a strong IELTS score. Whenever someone has asked me about an IELTS teacher, I’ve introduced you because I personally experienced the results and I’m sure it will be the same for all your students.<br><br>Sorry for the long message — I just had a lot to say about you and your excellent classes. Once again, thank you for everything Dave!", "Mahsa", "tt-mahsa-2.webp"),
 ("From the very beginning, the classes were run with precise planning and sharp attention to detail. I learned how to critique my own work and what an examiner looks for in Writing and Speaking. Even very minor mistakes, which I never thought were mistakes, were pointed out clearly. The constant encouragement motivated me to keep practicing. A truly excellent mentor and teacher, with rare kindness, who could calm my stress completely with their guidance.", "Marjan", "tt-marjan.webp"),
]
GALLERY = [
 ("gallery-01.webp","IH Team",1280,796),("gallery-02.webp","Macquarie University College - DE5",1124,699),("gallery-03.webp","IH - UPPER INT 3",1024,637),
 ("gallery-04.webp","CELTA with Carlos Souza",665,886),("gallery-05.webp","UTS College",768,1024),("gallery-06.webp","IH SYDNEY",734,979),
 ("gallery-07.webp","IH Team",902,678),("gallery-08.webp","IH - UPPER INT 3",1024,768),("gallery-09.webp","IH - UPPER INT 3",868,651),
 ("gallery-10.webp","Ben's Graduation - MQC",1004,1339),("gallery-11.webp","Carolina's Graduation - IH SYDNEY",605,806),("gallery-12.webp","Kamal's Graduation - IH SYDNEY",640,853),
 ("gallery-13.webp","Macquarie University College - DE8",1187,893),("gallery-14.webp","PD Festival with Jarrad Merlo",1225,922),("gallery-15.webp","IH - UPPER INT 3",883,662),
]
MOMENTS = [("moment-1.webp",768,577),("moment-2.webp",900,675),("moment-3.webp",900,677),("moment-4.webp",900,676),("moment-5.webp",525,700),("moment-6.webp",900,506),("moment-7.webp",900,506),("moment-8.webp",900,506)]
LIVE = {"DAVE Notes: Lecture Note-Taking Trainer": "note-taking-trainer-ted/", "Grammar Self-Correction Trainer": "grammar-self-correction/", "Nominalisation and Hedging Trainer": "nominalisation-hedging-trainer/"}
APPS = [
 ("listen","Listening","DAVE Notes: Lecture Note-Taking Trainer","Students watch a short TED talk or listen to a news story and take notes their way. Then they check their own notes against the key ideas, answer questions from their notes and set a goal.",["Key ideas","Signposting","Self-checking"]),
 ("gram","Grammar","Grammar Self-Correction Trainer","The app shows where each error is and what type it is, using correction codes teachers already use, like <b>vf</b> (verb form) or <b>art</b> (article). Students do the fixing, and hints step up only when they ask for one.",["Self-correction","Error codes","Step-by-step hints"]),
 ("gram","Grammar","Nominalisation and Hedging Trainer","Short drills that move from single words to full sentences: turn verbs into nouns (“analyse” → “analysis”) and match how sure a claim sounds to the evidence (“may suggest”). Students also fix sentences that use too much of either.",["Nominalisation","Hedging","Academic style"]),
 ("listen","Listening","Dictogloss","Students hear a passage twice, then reconstruct it in their own words. Feedback covers both meaning (what they kept or lost) and grammar.",["Listening for meaning","Grammar in context"]),
 ("read","Reading","Skim &amp; Scan Timer","Timed skimming and scanning tasks with a main-idea check, so speed never comes at the cost of understanding. Reading speed is tracked over time.",["Skimming","Scanning","Progress tracking"]),
 ("write","Writing","Paragraph X-Ray","Students paste a paragraph and see it labelled: topic sentence, evidence, analysis and link. The app flags which parts are missing or weak.",["Paragraph structure","Self-review"]),
 ("write","Writing","Synthesis Builder","Students combine two short sources in one piece of writing and get feedback on how well they integrate the ideas and cite them.",["Source integration","Citation","Paraphrasing"]),
 ("vocab","Vocabulary","Register Swapper","Students turn informal language into academic language (“a lot of” → “a considerable number of”) and learn why each choice fits the academic register.",["Academic register","Word choice"]),
]

# ------------------------------------------------------------------ HOME
def home(L):
    q = "".join(quote(L, t, n, p, d=i*.08) for i, (t, n, p) in enumerate(T_HOME))
    marq = "".join(img(L, f, "Dave Nab with students and colleagues", w, h, lazy=False) for f, w, h in MOMENTS)
    apps = "".join(f'''<article class="card {c} reveal" style="--d:{(i%4)*.05:.2f}s" data-cat="{c}"><div class="top"><span class="tag">{s}</span>{'<span class="status live">Live</span>' if t in LIVE else '<span class="status">In development</span>'}</div><h3>{t}</h3><p>{d}</p><div class="focus">{''.join(f'<span>{x}</span>' for x in fo)}</div>{f'<div class="go"><a class="btn-card stretch" href="{L(LIVE[t])}">Try it {ARR}</a></div>' if t in LIVE else ''}</article>''' for i,(c,s,t,d,fo) in enumerate(APPS))
    soon = [("res-nominalisation.webp","Nominalisation"),("res-dependent-clauses.webp","Dependent clauses"),("res-paraphrasing.webp","Paraphrasing")]
    soonh = "".join(f'<a class="res reveal" style="--d:{i*.06:.2f}s" href="{L("resources/")}"><div class="thumb">{img(L,f,t+" lesson slides",600,600)}</div><div><h3>{t}</h3><div class="meta">Coming soon</div></div></a>' for i,(f,t) in enumerate(soon))
    return f'''
<section class="hero"><div class="wrap hero-grid">
  <div>
    <span class="eyebrow fade-up" style="--d:.05s">AI learning apps · IELTS · EAP</span>
    <h1 class="rise" style="margin-top:22px">{words("Learn English with a teacher who knows what |examiners look for.|")}</h1>
    <p class="lead fade-up" style="--d:.7s">I’m Dave Nab, a CELTA and DELTA qualified English language educator with over 15 years of experience. I build AI-supported learning apps and classroom-tested resources for academic English, and I help students prepare for university study and high-stakes exams.</p>
    <div class="cta fade-up" style="--d:.85s"><a class="btn primary" href="#ai">Explore the AI apps {ARR}</a><a class="btn" href="{L('ielts-courses/')}">IELTS courses</a></div>
  </div>
  <div class="portrait fade-up" style="--d:.3s">
    <div class="ring" aria-hidden="true"></div>
    {img(L,"dave-portrait.webp","Portrait of Dave Nab",900,900,lazy=False)}
    <div class="float f1"><b>CELTA</b>&nbsp;·&nbsp;<b>DELTA</b></div>
    <div class="float f2"><b>15+</b> years teaching</div>
    <div class="float f3">CEFR speaking examiner</div>
  </div>
</div>
<div class="wrap"><nav class="who fade-up" style="--d:1s" aria-label="Who are you?"><span class="who-q">Who are you?</span>
  <a class="who-opt" href="{L('resources/students/')}"><b>I’m a student</b><span>Self-study packs, free practice and apps</span><i aria-hidden="true">→</i></a>
  <a class="who-opt" href="{L('resources/teachers/')}"><b>I’m a teacher</b><span>Zero-prep lesson kits, courses and free slides</span><i aria-hidden="true">→</i></a>
  <a class="who-opt" href="{L('book/')}"><b>Book a class</b><span>IELTS, General English or a mock test</span><i aria-hidden="true">→</i></a>
</nav></div></section>

<section class="ai-band" id="ai"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow reveal">AI apps &amp; resources</span><h2 class="reveal">Small, smart tools that help students <em>think</em>, not just get answers.</h2><p class="reveal">AI-supported apps for academic English. Each one targets one real skill students need at university, gives feedback that makes them do the thinking, and runs in any browser with no sign-in. Student work stays on their own device.</p></div>
    <a class="btn primary reveal" href="{L('apps/')}">See all apps {ARR}</a></div>
  <div class="filters reveal" role="group" aria-label="Filter apps by skill" style="margin-bottom:24px"><button aria-pressed="true" data-f="all">All</button><button aria-pressed="false" data-f="listen">Listening</button><button aria-pressed="false" data-f="read">Reading</button><button aria-pressed="false" data-f="write">Writing</button><button aria-pressed="false" data-f="gram">Grammar</button><button aria-pressed="false" data-f="vocab">Vocabulary</button></div>
  <div class="grid ai-grid">{apps}</div>
</div></section>

<section id="shop"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow reveal">Resources</span><h2 class="reveal">Ready-made materials for <em>students</em> and <em>teachers</em>.</h2><p class="reveal">Two separate shelves, so you only see what’s made for you. Single slides, worksheets and Quizlet sets are free. Lesson kits, courses and self-study packs save you hours.</p></div></div>
  <div class="aud-grid">
    <a class="aud reveal" href="{L('resources/students/')}"><span class="chip">For students</span><h3>Study smarter for university and IELTS</h3><ul class="ticks"><li><span>Self-study packs with model answers and checklists</span></li><li><span>Free Quizlet sets and practice apps</span></li><li><span>Built around what direct-entry and first-year courses assess</span></li></ul><span class="more">Go to student resources {ARR}</span></a>
    <a class="aud reveal" style="--d:.08s" href="{L('resources/teachers/')}"><span class="chip">For teachers</span><h3>Zero-prep lessons and whole courses</h3><ul class="ticks"><li><span>Lesson kits: slides, worksheet, answer key, Quizlet and teacher notes</span></li><li><span>Full course sequences with progression and assessment</span></li><li><span>Free single slides and worksheets</span></li></ul><span class="more">Go to teacher resources {ARR}</span></a>
  </div>
</div></section>

<section id="services"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow reveal">Courses &amp; services</span><h2 class="reveal">Courses built around <em>your</em> target score.</h2></div><a class="link reveal" href="{L('general-english/')}">General English courses {ARR}</a></div>
  <div class="svc-grid">
    <a class="svc reveal" href="{L('ielts-courses/')}"><div class="art">{img(L,"svc-ielts.webp","Student holding books with a speech bubble saying Aced it",900,814)}</div><div class="body"><span class="chip">IELTS Skill Courses</span><h3>IELTS Courses</h3><p>Master the key skills and strategies needed to improve your IELTS band score in Listening, Reading, Writing, and Speaking.</p><span class="more">View courses {ARR}</span></div></a>
    <a class="svc reveal" style="--d:.08s" href="{L('general-english/')}"><div class="art">{img(L,"svc-speaking.webp","Two students giving an OK sign",458,408)}</div><div class="body"><span class="chip">General English</span><h3>Speaking Fluency Course</h3><p>Boost your English fluency and communicate confidently in everyday and professional situations.</p><span class="more">Learn more {ARR}</span></div></a>
    <a class="svc reveal" style="--d:.16s" href="{L('ielts-mock-test/')}"><div class="art">{img(L,"svc-mock.webp","Student with a speech bubble saying Mock me as you want",900,793)}</div><div class="body"><span class="chip">From $25</span><h3>IELTS Mock Test</h3><p>Experience a real IELTS exam simulation and receive an accurate band score with detailed feedback.</p><span class="more">See formats &amp; fees {ARR}</span></div></a>
  </div>
</div></section>

<section id="testimonials"><div class="wrap" data-carousel>
  <div class="sec-head"><div><span class="eyebrow reveal">Testimonials</span><h2 class="reveal">What students say.</h2></div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><a class="link" href="{L('testimonials/')}">Read all {ARR}</a><div class="car-nav"><button data-prev aria-label="Previous testimonial">{I['left']}</button><button data-next aria-label="Next testimonial">{I['right']}</button></div></div></div>
  <div class="quotes">{q}</div>
</div></section>

{contact_band(L)}
'''
page("index.html", "Dave Nab · AI Learning Apps, Resources & IELTS", "AI-supported learning apps and ready-to-teach resources for academic English, plus IELTS courses, IELTS mock tests and General English with a CELTA and DELTA qualified teacher.", home, cur="")

# ------------------------------------------------------------------ IELTS COURSES
def ielts(L):
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "IELTS Courses")}
  <span class="eyebrow fade-up" style="--d:.05s">IELTS Courses</span>
  <h1 class="rise" style="margin-top:20px">{words("Two ways to reach your |target band.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Choose live, personalised coaching across all four skills, or study IELTS Writing at your own pace in a structured Canvas course.</p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="#live">Live Skills Mastery {ARR}</a><a class="btn" href="#independent">Independent Study</a></div>
</div></header>

<section id="live" style="padding-top:clamp(40px,6vw,72px)"><div class="wrap feature">
  <div class="prose">
    <span class="eyebrow reveal">Live · Online · 1-to-1</span>
    <h2 class="h2 reveal" style="margin:16px 0 22px">IELTS Live Skills Mastery Program</h2>
    <p class="reveal">For ambitious IELTS candidates seeking <strong>personalized, results-driven coaching</strong>, this program offers live, interactive training to elevate all four language skills: Listening, Reading, Writing, and Speaking.</p>
    <p class="reveal">Sessions are conducted online in <strong>60-minute lessons</strong>, typically booked in <strong>five-session blocks</strong>, ensuring <strong>focused progression, continuity, and measurable improvement</strong>. Each block is carefully structured to maximize efficiency and accelerate your path to your target band score.</p>
    <p class="reveal">Every session is <strong>tailored to your current level and objectives</strong>, ensuring you make consistent, measurable progress. With structured blocks and expert-led instruction, this program provides the ultimate combination of <strong>guidance, accountability, and strategy</strong> to maximize your IELTS performance.</p>
    <p class="reveal"><strong>Elevate your preparation! Achieve your desired score with confidence and precision.</strong></p>
    <div class="facts reveal"><div class="fact"><b>60 min</b><span>per lesson</span></div><div class="fact"><b>5 sessions</b><span>per block</span></div><div class="fact"><b>4 skills</b><span>L · R · W · S</span></div></div>
  </div>
  <div class="panel reveal" style="--d:.1s">
    <h3>Throughout the program, you will:</h3>
    <ul class="ticks">
      <li><span>Master <strong>proven IELTS strategies</strong> for every skill</span></li>
      <li><span>Refine <strong>advanced techniques</strong> for time management, task analysis, and accuracy</span></li>
      <li><span>Achieve excellence in <strong>Writing Task 1 and Task 2</strong> with expert guidance</span></li>
      <li><span>Strengthen <strong>Speaking fluency, coherence, and pronunciation</strong> through targeted practice</span></li>
      <li><span>Receive <strong>direct, personalized feedback</strong> and actionable advice</span></li>
      <li><span>Identify and systematically correct recurring weaknesses</span></li>
    </ul>
    <div class="cta" style="margin-top:28px"><a class="btn primary" href="{L('book/?service=ielts-live')}">Book a block {ARR}</a></div>
  </div>
</div></section>

<section id="independent" class="band"><div class="wrap feature">
  <div class="prose">
    <span class="eyebrow reveal">Self-paced · Canvas · Writing</span>
    <h2 class="h2 reveal" style="margin:16px 0 22px">IELTS Independent Study Program</h2>
    <p class="reveal">After taking a placement test, if your current general English level is close to your target score, you can confidently enrol in this course.</p>
    <p class="reveal">This comprehensive <strong>self-paced Canvas Writing course</strong> is designed for independent learners who want structured, effective preparation without the need for a full-time tutor. You can study anytime, anywhere, and progress according to your own schedule.</p>
    <p class="reveal">The program goes beyond advanced grammar and essential vocabulary for Writing Task 1 or/and Task 2. You will receive step-by-step training in structure, task achievement, coherence and cohesion, vocabulary development, and grammatical accuracy.</p>
    <p class="reveal">Each lesson includes clear explanations, practical models, and focused exercises. After every instructional section, you will complete structured assessments designed to help you identify weaknesses and improve your ability to apply techniques accurately and confidently.</p>
    <p class="reveal">After completing the Writing Task 1 and Task 2 modules, you may evaluate your progress by taking an <strong>IELTS Writing Mock Test</strong>, assessed according to official IELTS criteria.</p>
    <p class="reveal">If at any point during the course you feel you need additional clarification, you also have the option to book a one-off support session for personalized explanation and Q&amp;A on any topic covered in the program. Please note that these individual sessions are optional and available for an additional fee.</p>
    <p class="reveal">This course offers the ideal balance of flexibility, structure, and optional support — giving you full control over your preparation while ensuring you stay on track toward your target score.</p>
  </div>
  <div style="position:sticky;top:96px">
    <div class="media reveal-scale">{img(L,"canvas-preview.gif","Animated preview of the Canvas course modules for IELTS Writing Task 2",800,252)}</div>
    <p class="note reveal" style="margin-top:12px">Here’s a little sneak peek of what you can expect to see in this Canvas course for IELTS Writing Task 2.</p>
    <div class="cta reveal" style="margin-top:22px"><a class="btn primary" href="{PAY_WRITING}" target="_blank" rel="noopener">Buy Writing Course with PayPal {EXT}</a></div>
  </div>
</div></section>
{contact_band(L, "Not sure which program fits?", "Tell me your current level, target band and deadline, and I’ll suggest the best route.")}
'''
page("ielts-courses/index.html", "IELTS Courses · Dave Nab", "Live 1-to-1 IELTS coaching in 5-session blocks across all four skills, plus a self-paced Canvas course for IELTS Writing Task 1 and Task 2.", ielts, cur="ielts-courses/")

# ------------------------------------------------------------------ MOCK TEST
def mock(L):
    contact = f'You may contact me <a class="link" href="mailto:{EMAIL}">via email</a> (please include your full details, preferred date, and time) or complete <a class="link" href="{L('book/')}">this form</a> and I’ll get back to you in 24 hours.'
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "IELTS Mock Test")}
  <span class="eyebrow fade-up" style="--d:.05s">IELTS Mock Test</span>
  <h1 class="rise" style="margin-top:20px">{words("Rehearse test day |before test day.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">The IELTS Mock Test is conducted under conditions that closely replicate the official IELTS exam. The test format, scoring system, timing, and level of difficulty are all aligned with the real IELTS exam. Many IELTS candidates choose to take a mock test to become more familiar with the exam environment and to better prepare for test day.</p>
</div></header>

<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="prices">
    <div class="price-card feat reveal"><span class="badge">Speaking</span><h3>Online IELTS Speaking Mock Test</h3><div class="amt">$30</div><p>11–14 minute speaking interview with an immediate band score and a 10-minute consultation.</p><a class="btn primary" href="#speaking">Details {ARR}</a></div>
    <div class="price-card reveal" style="--d:.08s"><span class="chip" style="align-self:flex-start">Writing</span><h3>Writing Mock Test, without detailed comments</h3><div class="amt">$25</div><p>Task 1 and Task 2, assessed according to official IELTS marking criteria.</p><a class="btn" href="#writing">Details {ARR}</a></div>
    <div class="price-card reveal" style="--d:.16s"><span class="chip" style="align-self:flex-start">Writing</span><h3>Writing Mock Test, with detailed comments</h3><div class="amt">$35</div><p>Includes an audio file from the examiner explaining strengths, weaknesses, and practical strategies.</p><a class="btn" href="#writing">Details {ARR}</a></div>
  </div>
</div></section>

<section id="speaking" class="band"><div class="wrap feature">
  <div class="prose">
    <span class="eyebrow reveal">Speaking · $30</span>
    <h2 class="h2 reveal" style="margin:16px 0 22px">Online IELTS Speaking Mock Test</h2>
    <h3 class="reveal">Format</h3>
    <ul class="ticks reveal">
      <li><span>11–14 minute speaking interview</span></li>
      <li><span>Immediate band score provided after the test</span></li>
      <li><span>10-minute consultation session with the examiner to review strengths and weaknesses and provide guidance for improving your speaking score</span></li>
      <li><span>Video recording of the interview sent to the candidate</span></li>
    </ul>
    <p class="reveal" style="margin-top:18px">Listening to your own recorded performance is one of the most effective ways to improve pronunciation, fluency, and overall speaking performance.</p>
  </div>
  <div class="panel reveal" style="--d:.1s">
    <h3>Requirements &amp; Conditions</h3>
    <ul class="ticks">
      <li><span>A stable internet connection and access to Zoom or Google Meet are required.</span></li>
      <li><span>After registration, you will be contacted within 24 working hours to schedule your interview time.</span></li>
      <li><span>Your selected interview date must be within one week of registration.</span></li>
    </ul>
    <p class="note" style="margin-top:20px">To check availability for your preferred time, {contact[0].lower()+contact[1:]}</p>
    <div class="cta" style="margin-top:22px"><a class="btn primary" href="{L('book/?service=speaking-mock')}">Book the Speaking test {ARR}</a></div>
  </div>
</div></section>

<section id="writing"><div class="wrap feature">
  <div class="prose">
    <span class="eyebrow reveal">Writing · $25 / $35</span>
    <h2 class="h2 reveal" style="margin:16px 0 22px">Online IELTS Writing Mock Test</h2>
    <p class="reveal">This test includes both Writing Task 1 and Task 2.</p>
    <h3 class="reveal">Feedback Options</h3>
    <ul class="ticks reveal">
      <li><span><strong>Without detailed comments</strong> – $25</span></li>
      <li><span><strong>With detailed comments</strong> – $35. Includes an audio file from the examiner explaining strengths, weaknesses, and practical strategies to improve your Writing band score.</span></li>
    </ul>
    <p class="reveal" style="margin-top:18px">All writing scripts are assessed according to official IELTS marking criteria. This service is designed to familiarize candidates with the exam format, expectations, and scoring standards while helping them improve their performance effectively.</p>
  </div>
  <div class="panel reveal" style="--d:.1s">
    <h3>Important Notes &amp; Conditions</h3>
    <ul class="ticks">
      <li><span>After registration, you will be contacted within 24 working hours to confirm your test type (Academic or General Training).</span></li>
      <li><span>Candidates must allocate <strong>20 minutes for Task 1</strong> and <strong>40 minutes for Task 2</strong>.</span></li>
      <li><span>The timing must strictly include the full writing process (start to finish), just like the real exam. Time spent transferring answers is included within this limit.</span></li>
      <li><span>Responses must be handwritten. After completion, you should scan or take a clear photo of your writing and send it via WhatsApp.</span></li>
      <li><span>Results will be delivered within 48–72 working hours after submission.</span></li>
    </ul>
    <p class="note" style="margin-top:20px">{contact}</p>
    <div class="cta" style="margin-top:22px"><a class="btn primary" href="{L('book/?service=writing-mock')}">Book the Writing test {ARR}</a></div>
  </div>
</div></section>
{contact_band(L, "Ready to see your band score?", "Email me your full details, preferred date and time, or use the booking form. I’ll reply within 24 hours.")}
'''
page("ielts-mock-test/index.html", "IELTS Mock Test · Dave Nab", "Online IELTS Speaking ($30) and Writing ($25 / $35) mock tests under real exam conditions, with band scores and examiner feedback.", mock, cur="ielts-mock-test/")

# ------------------------------------------------------------------ GENERAL ENGLISH
def ge(L):
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "General English")}
  <span class="eyebrow fade-up" style="--d:.05s">General English</span>
  <h1 class="rise" style="margin-top:20px">{words("Ready to take your English to the |next level?|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Choose <strong>Speaking Fluency</strong> to improve confidence and flow in conversation, or join <strong>General English Level UP</strong> to develop all skills and make steady, measurable progress.</p>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="svc-grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <a class="svc reveal" href="{L('general-english/speaking-fluency/')}"><div class="art" style="background:#0b0b0d">{img(L,"ge-speaking.webp","Colourful letters flowing from a head silhouette",383,383,extra=' style="width:100%;height:100%;object-fit:cover"')}</div><div class="body"><span class="chip">1 or 5 × 60 min</span><h3>Speaking Fluency Course</h3><p>Improve your speaking fluency and confidence in a short, focused block of lessons. Perfect for busy schedules.</p><span class="more">Speaking Boost – Fluency Focus {ARR}</span></div></a>
    <a class="svc reveal" style="--d:.08s" href="{L('general-english/level-up/')}"><div class="art" style="background:#fff">{img(L,"ge-levelup.webp","Word cloud reading Learn English",319,319)}</div><div class="body"><span class="chip">CEFR A1 – C2</span><h3>General English – Level UP Course</h3><p>Six CEFR-aligned levels, from first steps in English to near-native proficiency.</p><span class="more">See all six levels {ARR}</span></div></a>
  </div>
</div></section>
{contact_band(L, "Not sure where to start?", "Tell me about your goals and current level, and I’ll recommend a course.")}
'''
page("general-english/index.html", "General English Courses · Dave Nab", "General English courses with Dave Nab: Speaking Fluency blocks and the CEFR-aligned General English Level UP course from A1 to C2.", ge, cur="general-english/")

def fluency(L):
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, ("general-english/","General English"), "Speaking Fluency")}
  <span class="eyebrow fade-up" style="--d:.05s">Speaking Fluency Course</span>
  <h1 class="rise" style="margin-top:20px">{words("Speaking Boost – |Fluency Focus|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Improve your speaking fluency and confidence in a short, focused block of lessons. You only commit to 1 to 5 sessions at a time — perfect for busy schedules and flexible learning. Continue with another block whenever you’re ready, building your skills step-by-step.</p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="{PAY_GE}" target="_blank" rel="noopener">Buy Course with PayPal {EXT}</a><a class="btn" href="{L('book/?service=speaking-fluency')}">Book a session</a></div>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="facts reveal" style="margin:0 0 40px"><div class="fact"><b>1 × 60 min</b><span>single session</span></div><div class="fact"><b>5 × 60 min</b><span>session block</span></div><div class="fact"><b>A2+</b><span>suitable level</span></div></div>
  <div class="feature">
    <div class="panel reveal"><h3>What You’ll Work On</h3><ul class="ticks">
      <li><span>Speaking more naturally and without hesitation</span></li>
      <li><span>Conversation strategies for everyday and professional situations</span></li>
      <li><span>Expanding active vocabulary and expressions</span></li>
      <li><span>Improving pronunciation, rhythm, and intonation</span></li>
      <li><span>Overcoming pauses, fillers, and self-correction</span></li></ul></div>
    <div style="display:grid;gap:20px">
      <div class="panel reveal" style="--d:.06s"><h3>Suitable for</h3><ul class="ticks">
        <li><span>Learners at A2 and above</span></li>
        <li><span>Busy professionals or students who prefer short, manageable commitments</span></li>
        <li><span>Those preparing for presentations, interviews, or social situations</span></li></ul></div>
      <div class="panel reveal" style="--d:.12s"><h3>Booking &amp; Payment</h3><ul class="ticks">
        <li><span>Pay in advance for each 5-session block</span></li>
        <li><span>Option to renew for additional blocks with no re-registration</span></li></ul></div>
      <div class="panel reveal" style="--d:.18s"><h3>Extra Notes</h3><ul class="ticks">
        <li><span>Small group or 1-to-1 available</span></li>
        <li><span>Personalised feedback after each session</span></li>
        <li><span>Combine with any General English level for faster progress</span></li></ul></div>
    </div>
  </div>
  <div class="cta reveal" style="margin-top:40px;justify-content:center"><a class="btn primary" href="{PAY_GE}" target="_blank" rel="noopener">Buy Course with PayPal {EXT}</a></div>
</div></section>
'''
page("general-english/speaking-fluency/index.html", "Speaking Fluency Course · Dave Nab", "Speaking Boost – Fluency Focus: flexible 1 or 5 × 60-minute sessions to speak English more naturally and confidently. A2 and above.", fluency, cur="general-english/speaking-fluency/")

LEVELS = [
 ("A1","Beginner","60 hours (3 terms × 20 sessions) aligned to CEFR A1 standards.","Focuses on building essential communication skills for everyday life. Students learn basic grammar, high-frequency vocabulary, and practise listening and speaking in familiar situations. They begin to read short texts and write simple sentences.","<em>Speakout Starter</em> (Pearson), <em>Oxford Word Skills – Basic</em>, <em>Real Listening &amp; Speaking 1</em> (Cambridge).","Highly interactive, with role-plays and visual aids to boost confidence. Suitable for learners starting English for the first time."),
 ("A2","Elementary / Pre-Intermediate","60 hours (3 terms × 20 sessions) aligned to CEFR A2 standards.","Expands vocabulary and grammar for everyday contexts. Students develop the ability to understand short spoken and written texts, give basic descriptions, and handle predictable social and work situations.","<em>Speakout Elementary</em> (Pearson), <em>Oxford Word Skills – Basic</em>, <em>Real Listening &amp; Speaking 1–2</em> (Cambridge).","Includes practical English for travel, shopping, and personal communication, with increased focus on connected speech."),
 ("B1","Intermediate","70 hours (3 terms × ~23–24 sessions) aligned to CEFR B1 standards.","Builds independence in English, enabling learners to handle most everyday situations and workplace conversations. Students improve comprehension of longer texts, write connected paragraphs, and discuss familiar topics with confidence.","<em>Outcomes Intermediate</em> (National Geographic Learning), <em>Oxford Word Skills – Intermediate</em>, <em>Real Listening &amp; Speaking 2</em> (Cambridge).","Includes project work, presentations, and role-plays to strengthen real-world communication skills."),
 ("B2","Upper-Intermediate","80 hours (3 terms × ~26–27 sessions) aligned to CEFR B2 standards.","Enables confident, fluent communication with native and non-native speakers. Students learn to discuss abstract ideas, produce well-structured arguments, and understand complex reading and listening materials.","<em>Outcomes Upper-Intermediate</em> (National Geographic Learning), <em>Oxford Word Skills – Upper-Intermediate</em>, <em>Real Listening &amp; Speaking 3</em> (Cambridge).","Strong focus on debate, critical thinking, and professional communication, preparing learners for academic and workplace success."),
 ("C1","Advanced","90 hours (3 terms × 30 sessions) aligned to CEFR C1 standards.","Refines mastery of English for academic, professional, and social contexts. Students learn to interpret subtle meanings, adapt register for different audiences, and write/speak with precision and style.","<em>Outcomes Advanced</em> (National Geographic Learning), <em>Oxford Word Skills – Advanced</em>, <em>Real Listening &amp; Speaking 4</em> (Cambridge).","Includes analysis of academic texts, high-level presentations, and training in persuasive and diplomatic communication."),
 ("C2","Proficiency","100 hours (3 terms × 33–34 sessions) aligned to CEFR C2 standards.","Develops near-native fluency for high-stakes professional, academic, or diplomatic use. Focus on nuance, idiomatic expression, and mastery of tone in both speech and writing.","<em>Outcomes Advanced</em> (National Geographic Learning, C2-adapted), <em>Oxford Word Skills – Advanced</em>, <em>Real Listening &amp; Speaking 4</em> (Cambridge).","Ideal for professional negotiations, advanced research, and public speaking at the highest level of proficiency."),
]
def levelup(L):
    lv = "".join(f'''<article class="level lv{i+1} reveal" id="{c.lower()}"><div class="code">{c}<small>{h.split(' ')[0]}h total</small></div><div><h3>Level {c} – {n}</h3><p>{d}</p><dl><dt>Structure</dt><dd>{s}</dd><dt>Main Coursebook</dt><dd>{b}</dd><dt>Extra Notes</dt><dd>{x}</dd></dl></div></article>'''
                 for i,(c,n,s,d,b,x) in enumerate(LEVELS) for h in [s])
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, ("general-english/","General English"), "Level UP Course")}
  <span class="eyebrow fade-up" style="--d:.05s">General English – Level UP Course</span>
  <h1 class="rise" style="margin-top:20px">{words("Six levels. One |steady climb.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">A General English program aligned to the CEFR, from A1 Beginner to C2 Proficiency. Each level runs over three terms with recognised coursebooks.</p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="{PAY_GE}" target="_blank" rel="noopener">Buy Course with PayPal {EXT}</a><a class="btn" href="{L('book/?service=level-up')}">Ask about placement</a></div>
  <div class="filters fade-up" style="--d:.85s;margin-top:28px" aria-label="Jump to level">{''.join(f'<a class="chip" style="text-decoration:none" href="#{c.lower()}">{c}</a>' for c,*_ in LEVELS)}</div>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap"><div class="levels">{lv}</div>
<div class="cta reveal" style="margin-top:40px;justify-content:center"><a class="btn primary" href="{PAY_GE}" target="_blank" rel="noopener">Buy Course with PayPal {EXT}</a></div></div></section>
'''
page("general-english/level-up/index.html", "General English Level UP · Dave Nab", "CEFR-aligned General English course from A1 Beginner to C2 Proficiency, with structure, coursebooks and focus for each level.", levelup, cur="general-english/level-up/")

# ------------------------------------------------------------------ TESTIMONIALS
def testi(L):
    q = "".join(quote(L, t, n, p, d=(i%3)*.06) for i,(t,n,p) in enumerate(T_ALL))
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "Testimonials")}
  <span class="eyebrow fade-up" style="--d:.05s">Testimonials</span>
  <h1 class="rise" style="margin-top:20px">{words("In my |students’ words.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Messages from IELTS students after their results came in.</p>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap"><div class="wall">{q}</div></div></section>
{contact_band(L, "Your result could be next.", "Tell me your target band and deadline, and we’ll make a plan.")}
'''
page("testimonials/index.html", "Testimonials · Dave Nab", "What IELTS students say about learning with Dave Nab.", testi, cur="testimonials/")

# ------------------------------------------------------------------ GALLERY
def gallery(L):
    g = "".join(f'<figure class="reveal" style="--d:{(i%3)*.06:.2f}s">{img(L,f,c,w,h)}<figcaption>{c}</figcaption></figure>' for i,(f,c,w,h) in enumerate(GALLERY))
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "Gallery")}
  <span class="eyebrow fade-up" style="--d:.05s">Gallery</span>
  <h1 class="rise" style="margin-top:20px">{words("Moments from the |classroom.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Teams, classes, graduations and professional development at International House Sydney, Macquarie University College and UTS College.</p>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap"><div class="gallery">{g}</div></div></section>
<dialog class="lightbox" id="lightbox" aria-label="Photo"><button class="x" aria-label="Close">×</button><img src="" alt=""><p></p></dialog>
'''
page("gallery/index.html", "Gallery · Dave Nab", "Photos of Dave Nab with students and colleagues at IH Sydney, Macquarie University College and UTS College.", gallery, cur="gallery/")

# ------------------------------------------------------------------ ABOUT
def about(L):
    marq = "".join(img(L, f, "Dave Nab with students and colleagues", w, h, lazy=False) for f, w, h in MOMENTS)
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "About")}
  <span class="eyebrow fade-up" style="--d:.05s">About me</span>
  <h1 class="rise" style="margin-top:20px">{words("Hi, I’m |Dave Nab.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">I am a CELTA and DELTA qualified English language educator with over 15 years of experience across higher education, ELICOS, and international assessment contexts.</p>
</div></header>
<div class="wrap" style="margin-top:8px"><div class="stats reveal">
  <div><div class="n" data-count="15" data-suffix="+">15+</div><div class="l">Years teaching English</div></div>
  <div><div class="n">CELTA</div><div class="l">and DELTA qualified</div></div>
  <div><div class="n">Band 7</div><div class="l">Results students report</div></div>
  <div><div class="n">CEFR</div><div class="l">Calibrated speaking examiner</div></div>
</div></div>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap split" style="align-items:start">
  <div style="position:sticky;top:96px;display:grid;gap:18px">
    <div class="photo reveal-scale">{img(L,"dave-ih-sydney.webp","Dave Nab at International House Sydney City",734,1070,lazy=False)}</div>
  </div>
  <div class="prose">
    <p class="reveal">I currently teach at <strong>Macquarie University College</strong> and <strong>UTS College</strong>, supporting students who are preparing for university study and high stakes English examinations.</p>
    <p class="reveal">My qualifications underpin my approach to lesson design, language analysis, and principled teaching practice, and over the years I have developed a broad skill set that connects teaching, assessment, and academic leadership.</p>
    <h3 class="reveal">Teaching and Academic Development</h3>
    <p class="reveal">I specialise in IELTS, Academic English, and EAP, with a strong focus on academic writing, speaking performance, and feedback literacy. I design structured, outcome driven lessons that help students understand expectations and make measurable progress.</p>
    <h3 class="reveal">Assessment and Standards</h3>
    <p class="reveal">I have extensive experience in marking, moderation, and maintaining academic standards. I also work as a calibrated CEFR-aligned speaking examiner for an international English test, applying strict rating criteria and standardisation procedures. This experience allows me to give feedback that reflects real assessment practices.</p>
    <h3 class="reveal">Academic Coordination and Leadership</h3>
    <p class="reveal">I have supported semester preparation, moderation processes, staff onboarding, and student progression systems. As a former Head Teacher, I have led teaching teams, conducted observations, and contributed to quality assurance and compliance processes.</p>
    <p class="reveal" style="margin-top:24px;font-size:1.25rem;color:var(--text);font-weight:600;letter-spacing:-.02em">Across all roles, my focus remains consistent: <span class="hl">structured teaching, fair assessment, and high academic standards</span> that support both students and institutions.</p>
    <div class="cta reveal" style="margin-top:28px"><a class="btn" href="{LINKEDIN}" target="_blank" rel="noopener">{I['in']} LinkedIn</a><a class="btn" href="{INSTA}" target="_blank" rel="noopener">{I['ig']} Instagram</a><a class="btn" href="{L('gallery/')}">Gallery {ARR}</a></div>
  </div>
</div></section>
<section class="statement band"><div class="wrap">
  <p data-fill>Structured teaching, fair assessment, and high academic standards that support both students and institutions.</p>
  <div class="by reveal">My focus across every role, from the classroom to the examiner’s chair.</div>
</div></section>
<section id="moments" style="padding-bottom:0"><div class="wrap"><div class="sec-head"><div><span class="eyebrow reveal">Moments</span><h2 class="reveal">Classrooms, colleagues and graduations.</h2></div><a class="link reveal" href="{L('gallery/')}">Open the gallery {ARR}</a></div></div>
  <div class="marquee" aria-label="Photo strip"><div class="marquee-track">{marq}{marq.replace('alt="Dave Nab with students and colleagues"','alt="" aria-hidden="true"')}</div></div>
</section>
<div id="contact"></div>
{contact_band(L)}
'''
page("about/index.html", "About Dave Nab · CELTA & DELTA English Teacher", "Dave Nab is a CELTA and DELTA qualified English educator with 15+ years in higher education, ELICOS and international assessment, teaching at Macquarie University College and UTS College.", about, cur="about/")

# ------------------------------------------------------------------ RESOURCES
# ---------- resources data
# Each item: (class, tag, title, description, focus tags, status "live"|"soon", price "Free"|"$2"|None, link)
# link: "@path/" = page on this site, "https://..." = external. Paid items need their OWN PayPal link from Dave.
STUDENT_PACKS = [
 ("pack","Self-study pack","University-Ready Research Essay","Plan, research and write a source-based essay step by step: question analysis, annotated bibliography, outline, paragraphing, integrating sources and referencing, with model texts and checklists.",["B2–C1","Writing","Research"],"soon",None,None),
 ("pack","Self-study pack","Seminar &amp; Presentation Toolkit","Prepare and deliver an academic presentation, then handle questions: structure, signposting, slides, delivery and Q&amp;A language, with model scripts and audio.",["B2–C1","Speaking"],"soon",None,None),
 ("pack","Self-study pack","IELTS Writing Band 7 Toolkit","Marked sample answers at Bands 5–8 with criterion-by-criterion comments, plus the checklist I use when I give feedback.",["IELTS","Writing"],"soon",None,None),
 ("course","Self-paced course","Get Ready for Uni English","A short course on the skills first-year units expect: reading critically, taking notes from lectures, paraphrasing and summarising, and academic integrity.",["B2","All skills"],"soon",None,None),
]
STUDENT_FREE = [
 ("wordlist","Word list · Quizlet","A1 – Academic Word List","Flashcards for Academic Word List vocabulary. Study online, or play Quizlet’s games and tests.",["Vocabulary","AWL"],"live","Free","https://quizlet.com/au/1143969156/a1-flash-cards/?i=oj7gk&amp;x=1qqt"),
 ("wordlist","Word list · Quizlet","A4 Week 1 Flash Cards","A Quizlet flashcard set for weekly vocabulary practice.",["Vocabulary","Week 1"],"live","Free","https://quizlet.com/au/1216144633/a4-week-1-flash-cards/"),
 ("listen","App · Listening","DAVE Notes: Lecture Note-Taking Trainer","Watch a short TED talk or news story, take notes your way, then check them against the key ideas.",["Note-taking","Free app"],"live","Free","@note-taking-trainer-ted/"),
 ("gram","App · Grammar","Grammar Self-Correction Trainer","Find and fix your own errors with correction codes and small hints.",["Self-correction","Free app"],"live","Free","@grammar-self-correction/"),
]
TEACHER_KITS = [
 ("kit","Lesson kit","Paraphrasing &amp; Summarising","One complete lesson: slides, student worksheet, answer key, Quizlet set and teacher notes, with an integrity focus on avoiding patchwriting.",["B2–C1","Writing","Zero prep"],"soon",None,None),
 ("kit","Lesson kit","Integrating Sources &amp; Referencing","Reporting verbs, quoting versus paraphrasing, and in-text citation, with a source-integration task and a model paragraph.",["B2–C1","Writing","Zero prep"],"soon",None,None),
 ("kit","Lesson kit","Critical Reading: Evaluating Sources","Students judge the reliability and relevance of academic texts using clear criteria, then justify their choice.",["B2–C1","Reading","Zero prep"],"soon",None,None),
 ("kit","Lesson kit","Lecture Listening &amp; Note-Taking","Signposting, abbreviations and note formats, linked to the DAVE Notes app for follow-up practice.",["B1–C1","Listening","Zero prep"],"soon",None,None),
]
TEACHER_COURSES = [
 ("course","Course · 10 weeks","Academic Literacy Foundations","A ten-week sequence built around the research-project format used in Australian direct-entry programs: topic and question, annotated bibliography, presentation with Q&amp;A, integrated writing and a final research essay. Weekly slides, tasks, rubrics and model texts.",["B2–C1","Direct entry","EAP"],"soon",None,None),
 ("course","Course · 8 weeks","From Paragraph to Essay","Topic sentences and paragraph structure through to cohesion, argument and the full academic essay, with coded feedback practice.",["B1–B2","Writing"],"soon",None,None),
]
TEACHER_FREE = [
 ("slides","Slides · PPTX","Hedging in Academic Writing","A 13-slide lesson: notice, categorise and use hedging language, then avoid over-hedging.",["B2–C1","Writing","13 slides"],"live","$2","@resources/hedging-in-academic-writing/"),
 ("wordlist","Word list · Quizlet","A1 – Academic Word List","Use in class with Quizlet Live, or set it as homework.",["Vocabulary","AWL"],"live","Free","https://quizlet.com/au/1143969156/a1-flash-cards/?i=oj7gk&amp;x=1qqt"),
 ("wordlist","Word list · Quizlet","A4 Week 1 Flash Cards","A ready-made weekly vocabulary set for class or homework.",["Vocabulary","Week 1"],"live","Free","https://quizlet.com/au/1216144633/a4-week-1-flash-cards/"),
]
KIND = {"pack": ("var(--write)", "var(--write-bg)"), "course": ("var(--ink)", "var(--surface-2)"), "kit": ("var(--accent)", "var(--accent-soft)")}

def rcard(L, item, i=0):
    cls, tag, title, desc, focus, status, price, link = item
    href = (L(link[1:]) if link.startswith("@") else link) if link else None
    ext = bool(href) and href.startswith("http")
    style = f"--d:{(i % 3) * .06:.2f}s"
    if cls in KIND:
        style += f";--c:{KIND[cls][0]};--cbg:{KIND[cls][1]}"
    if status == "live" and price:
        right = f'<span class="price{" free" if price == "Free" else ""}">{price}</span>'
    else:
        right = '<span class="status">Coming soon</span>'
    go = ""
    if status == "live" and href:
        label = "Open on Quizlet" if "quizlet" in href else ("Open the app" if cls in ("listen", "gram") else "View &amp; preview")
        tgt = ' target="_blank" rel="noopener"' if ext else ""
        go = f'<div class="go"><a class="btn-card stretch" href="{href}"{tgt}>{label} {EXT if ext else ARR}</a></div>'
    tags = "".join(f"<span>{x}</span>" for x in focus)
    return f'<article class="card {cls} reveal" style="{style}"><div class="top"><span class="tag">{tag}</span>{right}</div><h3>{title}</h3><p>{desc}</p><div class="focus">{tags}</div>{go}</article>'

def shelf(L, hid, title, intro, items):
    cards = "".join(rcard(L, it, i) for i, it in enumerate(items))
    return f'<div class="shelf" id="{hid}"><div class="shelf-head"><h2 class="subhead">{title}</h2><p class="note">{intro}</p></div><div class="grid{' two' if len(items) % 2 == 0 else ''}">{cards}</div></div>'

def resources(L):
    return f"""
<header class="page-hero"><div class="wrap">
  {crumb(L, "Resources")}
  <span class="eyebrow fade-up" style="--d:.05s">Resources</span>
  <h1 class="rise" style="margin-top:20px">{words("Who are the resources |for?|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Pick your shelf. Students find self-study packs and free practice. Teachers find zero-prep lesson kits, full courses and free slides.</p>
</div></header>
<section style="padding-top:clamp(16px,3vw,32px)"><div class="wrap">
  <div class="aud-grid">
    <a class="aud big reveal" href="{L('resources/students/')}"><span class="chip">For students</span><h3>I’m preparing for university or IELTS</h3><p>Self-study packs with model answers and checklists, plus free Quizlet sets and practice apps.</p><span class="more">Student resources {ARR}</span></a>
    <a class="aud big reveal" style="--d:.08s" href="{L('resources/teachers/')}"><span class="chip">For teachers</span><h3>I teach EAP or academic English</h3><p>Zero-prep lesson kits, whole course sequences, and free single slides and worksheets.</p><span class="more">Teacher resources {ARR}</span></a>
  </div>
  <div class="notebox reveal" style="margin-top:40px"><h3>Licence</h3>Free materials may be used and shared for educational purposes. Keep the copyright in place and list <strong>davenab.com</strong> as the source. Paid materials are for the buyer’s own use or classes; please don’t re-upload or resell them.</div>
</div></section>
"""
page("resources/index.html", "Resources for Students and Teachers · Dave Nab", "Academic English resources in two places: self-study packs and free practice for students, and zero-prep lesson kits, courses and free slides for EAP teachers.", resources, cur="resources/")

def res_students(L):
    soon = f'Coming soon. Want one first? <a class="link" href="mailto:{EMAIL}">Email me</a> and I’ll tell you when it’s ready.'
    return f"""
<header class="page-hero"><div class="wrap">
  {crumb(L, ("resources/","Resources"), "For students")}
  <span class="eyebrow fade-up" style="--d:.05s">Resources for students</span>
  <h1 class="rise" style="margin-top:20px">{words("Study packs that do the |heavy lifting.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">For students heading into an Australian university, a direct-entry program or IELTS. Each pack walks you through one big task with models, checklists and the feedback I would give you in class.</p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="#packs">Self-study packs {ARR}</a><a class="btn" href="#free">Free practice</a></div>
</div></header>
<section style="padding-top:clamp(16px,3vw,32px)"><div class="wrap">
  {shelf(L, "packs", "Self-study packs &amp; courses", soon, STUDENT_PACKS)}
  {shelf(L, "free", "Free practice", "Quizlet sets and practice apps. No sign-in.", STUDENT_FREE)}
</div></section>
"""
page("resources/students/index.html", "Resources for Students · Dave Nab", "Self-study packs for academic English and IELTS, plus free Quizlet sets and practice apps for students preparing for university.", res_students, cur="resources/students/")

def res_teachers(L):
    return f"""
<header class="page-hero"><div class="wrap">
  {crumb(L, ("resources/","Resources"), "For teachers")}
  <span class="eyebrow fade-up" style="--d:.05s">Resources for teachers</span>
  <h1 class="rise" style="margin-top:20px">{words("Open it, teach it. |Zero prep.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Lesson kits and full course sequences for EAP and academic English, built from my own classroom-tested materials. Single slides, worksheets and Quizlet sets stay free.</p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="#kits">Lesson kits {ARR}</a><a class="btn" href="#courses">Courses</a><a class="btn" href="#free">Single resources</a></div>
</div></header>
<section style="padding-top:clamp(16px,3vw,32px)"><div class="wrap">
  <div class="kit-strip reveal"><b>Every lesson kit includes</b><span>Slides</span><span>Student worksheet</span><span>Answer key</span><span>Quizlet set</span><span>Teacher notes</span><span>App follow-up</span></div>
  {shelf(L, "kits", "Zero-prep lesson kits", "One complete lesson each. Coming soon.", TEACHER_KITS)}
  {shelf(L, "courses", "Whole courses", "Week-by-week sequences with progression, rubrics and model texts. Coming soon.", TEACHER_COURSES)}
  {shelf(L, "free", "Single resources", "Free and low-cost slides, worksheets and Quizlet sets.", TEACHER_FREE)}
  <!-- HOW TO ADD A RESOURCE: add an item to the lists in _tools/build.py (status "live", price, link); for its own page copy resources/_template/; add the page to /sitemap.xml. -->
</div></section>
"""
page("resources/teachers/index.html", "Resources for EAP Teachers · Dave Nab", "Zero-prep academic English lesson kits, full EAP course sequences, and free slides, worksheets and Quizlet sets for teachers.", res_teachers, cur="resources/teachers/")

def hedging(L):
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, ("resources/","Resources"), "Hedging in Academic Writing")}
  <span class="eyebrow fade-up" style="--d:.05s">Slides · PPTX · B2–C1</span>
  <h1 class="rise" style="margin-top:20px">{words("Hedging in |Academic Writing|")}</h1>
  <p class="lead fade-up" style="--d:.6s">A ready-to-teach lesson that helps students notice, categorise and use hedging language, so their claims sound cautious, credible and academic. It starts with discovery tasks and moves through to a short writing task.</p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="{PAY_HEDGING}" target="_blank" rel="noopener">Buy for $2 with PayPal {EXT}</a></div>
  <p class="note fade-up" style="--d:.8s;margin-top:14px">Secure checkout with PayPal (card or PayPal account). Your download opens straight after payment. If it doesn’t, the file is emailed to your PayPal address within 24 hours.</p>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="principles">
    <div class="pr reveal" style="background:var(--surface-2)"><h3>What’s included</h3><p>13 editable PowerPoint slides with pair and group tasks, a categorisation activity, suggested answers and a final writing task.</p></div>
    <div class="pr reveal" style="--d:.06s;background:var(--surface-2)"><h3>Level &amp; time</h3><p>B2–C1 (upper-intermediate to advanced) · about one lesson, depending on discussion time.</p></div>
    <div class="pr reveal" style="--d:.12s;background:var(--surface-2)"><h3>Skills</h3><p>Hedging devices (modal verbs, tentative verbs, adverbs, phrases), avoiding over-hedging, academic tone.</p></div>
  </div>
  <h2 class="subhead reveal" style="margin-top:64px">Preview</h2>
  <div class="previews">
    <img class="reveal" src="preview-1.jpg" alt="Title slide: Hedging in Academic Writing – Expressing Certainty and Uncertainty" loading="lazy" width="1000" height="563">
    <img class="reveal" style="--d:.06s" src="preview-2.jpg" alt="Warm-up slide comparing two statements about social media and depression" loading="lazy" width="1000" height="563">
    <img class="reveal" src="preview-3.jpg" alt="Slide showing four types of hedging: modal verbs, tentative verbs, adverbs and phrases, with examples" loading="lazy" width="1000" height="563">
    <img class="reveal" style="--d:.06s" src="preview-4.jpg" alt="Slide warning against over-hedging, with a too-much example and a better example" loading="lazy" width="1000" height="563">
  </div>
  <h2 class="subhead reveal" style="margin-top:64px">Lesson outline</h2>
  <ol class="outline reveal">
    <li>Warm-up: which statement sounds more academic?</li>
    <li>Noticing: spot the hedging language in four research sentences</li>
    <li>Concept: what hedging is and why academics use it</li>
    <li>Discovery: sort hedging devices into categories</li>
    <li>Input: modal verbs, tentative verbs, adverbs and phrases, with examples</li>
    <li>Practice: rewrite strong claims with appropriate hedging, then compare versions</li>
    <li>Accuracy: the problem of over-hedging</li>
    <li>Application: write and peer-review a short hedged paragraph</li>
  </ol>
  <div class="notebox reveal" style="margin-top:48px"><h3>Licence</h3>For use by the buyer in their own classes. Please don’t re-upload, share or resell the file.</div>
</div></section>
'''
LD = '''<meta property="og:image" content="https://davenab.com/resources/hedging-in-academic-writing/preview-1.jpg">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Hedging in Academic Writing – EAP Lesson Slides","description":"A 13-slide editable PowerPoint lesson on hedging in academic writing for B2–C1 learners.","image":"https://davenab.com/resources/hedging-in-academic-writing/preview-1.jpg","brand":{"@type":"Person","name":"Dave Nab"},"offers":{"@type":"Offer","price":"2.00","priceCurrency":"USD","availability":"https://schema.org/InStock","url":"https://davenab.com/resources/hedging-in-academic-writing/"}}
</script>
'''
page("resources/hedging-in-academic-writing/index.html", "Hedging in Academic Writing – EAP Lesson Slides (B2–C1, PPTX) · Dave Nab", "A ready-to-teach 13-slide PowerPoint lesson on hedging in academic writing for B2–C1 EAP students: discovery tasks, modal verbs, tentative verbs, adverbs and phrases, over-hedging, and a writing task. Editable PPTX.", hedging, cur="resources/", extra_head=LD)

# ------------------------------------------------------------------ APPS
def apps(L):
    cards = "".join(f'''<article class="card {c} reveal" style="--d:{(i%3)*.06:.2f}s" data-cat="{c}"><div class="top"><span class="tag">{s}</span>{'<span class="status live">Live</span>' if t in LIVE else '<span class="status">In development</span>'}</div><h3>{t}</h3><p>{d}</p><div class="focus">{''.join(f'<span>{x}</span>' for x in fo)}</div><div class="go">{f'<a class="btn-card stretch" href="{L(LIVE[t])}">Try it {ARR}</a>' if t in LIVE else '<span class="soon">Coming soon</span>'}</div></article>''' for i,(c,s,t,d,fo) in enumerate(APPS))
    return f'''
<header class="page-hero"><div class="wrap">
  {crumb(L, "Apps")}
  <span class="eyebrow fade-up" style="--d:.05s">Learning design × AI in education</span>
  <h1 class="rise" style="margin-top:20px">{words("Small, smart tools that help students |think, not just get answers.|")}</h1>
  <p class="lead fade-up" style="--d:.7s">AI-supported apps for academic English. Each app targets one real skill students need at university, gives feedback that makes them do the thinking, and runs in any browser with no sign-in.</p>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="sec-head" style="margin-bottom:28px"><div><h2 class="subhead" style="margin:0">The apps</h2><p style="margin-top:8px">New apps are added as they’re built and tested with students.</p></div>
    <div class="filters" role="group" aria-label="Filter apps by skill"><button aria-pressed="true" data-f="all">All</button><button aria-pressed="false" data-f="listen">Listening</button><button aria-pressed="false" data-f="read">Reading</button><button aria-pressed="false" data-f="write">Writing</button><button aria-pressed="false" data-f="gram">Grammar</button><button aria-pressed="false" data-f="vocab">Vocabulary</button></div></div>
  <!-- HOW TO UPDATE AN APP: put it in /<slug>/index.html, set status to <span class="status live">Live</span>, replace "Coming soon" with <a href="../<slug>/">Try it →</a>. -->
  <div class="grid">{cards}</div>
</div></section>
<section class="band"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow reveal">Design approach</span><h2 class="reveal">Three principles shape every app.</h2></div></div>
  <div class="principles">
    <div class="pr reveal"><h3>Feedback that makes students think</h3><p>The apps give hints, codes and comparisons instead of correct answers, so students do the thinking and remember more.</p></div>
    <div class="pr reveal" style="--d:.06s"><h3>One skill, done well</h3><p>Each tool targets a specific academic skill, like signposting, paragraph structure or hedging, and fits into existing lessons or self-study.</p></div>
    <div class="pr reveal" style="--d:.12s"><h3>Open and private</h3><p>No accounts and no installs: open the link and start. Student work stays on their own device.</p></div>
  </div>
</div></section>
'''
page("apps/index.html", "AI Learning Apps · Dave Nab", "AI-supported apps for academic English: listening, reading, writing, grammar and vocabulary. Free to use, no sign-in.", apps, cur="apps/")

# ------------------------------------------------------------------ BOOKING
GF = "https://docs.google.com/forms/d/e/1FAIpQLSda5OD0a74n93Vw6FKQF-HaWF5spCccaGKzCvCje4vWa11yKA"
def book(L):
    svc = [("ielts-live","IELTS Live Skills Mastery","Live 1-to-1, 5-session blocks"),("ielts-writing","IELTS Writing course","Self-paced Canvas course"),
           ("speaking-mock","IELTS Speaking Mock Test","$30 · 11–14 min interview"),("writing-mock","IELTS Writing Mock Test","$25 / $35 · Task 1 + Task 2"),
           ("speaking-fluency","Speaking Fluency","General English · 1 or 5 sessions"),("level-up","General English Level UP","CEFR A1 – C2")]
    svch = "".join(f'<label class="opt"><input type="radio" name="service" value="{v}" required><span><b>{t}</b><small>{d}</small></span></label>' for v,t,d in svc)
    days = "".join(f'<label class="pill"><input type="checkbox" name="days" value="{d}"><span>{d[:3]}</span></label>' for d in ["Monday","Tuesday","Wednesday","Thursday","Friday"])
    lv = "".join(f'<label class="pill"><input type="radio" name="level" value="{v}" required><span>{v}</span></label>' for v in ["Elementary","Pre Intermediate","Intermediate","Upper Intermediate","Advanced"])
    sc = "".join(f'<label class="pill"><input type="radio" name="score" value="{v}"><span>{v}</span></label>' for v in ["4.0","5.0","6.0","6.5","7.0"])
    return f'''
<header class="page-hero"><div class="wrap narrow">
  {crumb(L, "Book a class")}
  <span class="eyebrow fade-up" style="--d:.05s">Booking</span>
  <h1 class="rise" style="margin-top:20px">{words("Let’s find your |starting point.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">Tell me what you need and when you’re free. It takes about two minutes, and I’ll get back to you within 24 hours.</p>
</div></header>
<section style="padding-top:clamp(16px,3vw,32px)"><div class="wrap narrow">
  <form class="book" id="book" action="{GF}/formResponse" novalidate>
    <div class="steps" aria-hidden="true"><span class="on"></span><span></span><span></span><span></span></div>

    <fieldset class="fs reveal"><legend><span class="num">1</span> What are you looking for?</legend>
      <div class="opts">{svch}</div>
      <p class="err" data-for="service">Choose a course or test.</p>
    </fieldset>

    <fieldset class="fs reveal"><legend><span class="num">2</span> About you</legend>
      <div class="row2">
        <div class="field"><label for="f-name">Full name</label><input id="f-name" name="name" autocomplete="name" required><p class="err">Enter your full name.</p></div>
        <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required><p class="err">Enter a valid email address.</p></div>
        <div class="field"><label for="f-phone">Phone / WhatsApp</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" placeholder="+61 4xx xxx xxx" required><p class="err">Enter a phone number, with country code.</p></div>
        <div class="field"><label for="f-city">City you live in</label><input id="f-city" name="city" autocomplete="address-level2" required><p class="err">Enter your city.</p></div>
      </div>
    </fieldset>

    <fieldset class="fs reveal"><legend><span class="num">3</span> When suits you?</legend>
      <div class="field"><span class="lbl">Preferred class days</span><div class="pills">{days}</div><p class="err" data-for="days">Choose at least one day.</p></div>
      <div class="field"><span class="lbl">Preferred time (Sydney time)</span>
        <div class="opts two">
          <label class="opt"><input type="radio" name="time" value="Mornings between 8:00 am to 1:00 pm (Sydney time)" required><span><b>Mornings</b><small>8:00 am – 1:00 pm</small></span></label>
          <label class="opt"><input type="radio" name="time" value="Afternoons between 1:00 pm to 6:00 pm (Sydney time)"><span><b>Afternoons</b><small>1:00 pm – 6:00 pm</small></span></label>
        </div><p class="err" data-for="time">Choose a time of day.</p><p class="hint" id="tz-hint"></p></div>
      <div class="field" style="max-width:280px"><label for="f-date">Preferred start date <small>(optional)</small></label><input id="f-date" name="date" type="date"></div>
    </fieldset>

    <fieldset class="fs reveal"><legend><span class="num">4</span> Your English and your goal</legend>
      <div class="field"><span class="lbl">Current level <small>(choose the nearest if unsure)</small></span><div class="pills">{lv}</div><p class="err" data-for="level">Choose your current level.</p></div>
      <div class="field"><span class="lbl">Have you taken the IELTS test before?</span><div class="pills"><label class="pill"><input type="radio" name="taken" value="Yes" required><span>Yes</span></label><label class="pill"><input type="radio" name="taken" value="No"><span>No</span></label></div><p class="err" data-for="taken">Choose yes or no.</p></div>
      <div class="field reveal-if" id="score-wrap" hidden><span class="lbl">Your overall IELTS score</span><div class="pills">{sc}</div><p class="err" data-for="score">Choose your overall score.</p></div>
      <div class="field"><label for="f-goal">What do you want to improve? What is your target?</label><textarea id="f-goal" name="goal" rows="4" required placeholder="e.g. I need band 7 in Writing for my university application in March."></textarea><p class="err">Tell me a little about your goal.</p></div>
      <div class="field"><label for="f-heard">How did you hear about me?</label><input id="f-heard" name="heard" list="heard-list" required><datalist id="heard-list"><option value="Instagram"><option value="LinkedIn"><option value="A friend or classmate"><option value="Google search"><option value="Macquarie University College"><option value="UTS College"></datalist><p class="err">Let me know how you found me.</p></div>
    </fieldset>

    <div class="submit-row reveal">
      <button class="btn primary" type="submit" id="send">Send booking request <span class="arr" aria-hidden="true">→</span></button>
    </div>
    <p class="form-error" id="form-error" role="alert" hidden></p>
  </form>

  <div class="done" id="done" hidden tabindex="-1">
    <svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>
    <h2>Thanks, <span id="done-name">your request is in</span>.</h2>
    <p>I’ll get back to you within 24 hours by email or WhatsApp. If it’s urgent, email <b>{EMAIL}</b>.</p>
    <div class="cta" style="justify-content:center;margin-top:24px"><a class="btn" href="{L('')}">Back to home</a><a class="btn primary" href="{L('testimonials/')}">Read testimonials {ARR}</a></div>
  </div>

</div></section>
'''
page("book/index.html", "Book a Class · Dave Nab", "Book IELTS lessons, an IELTS mock test or a General English course with Dave Nab. Takes two minutes; replies within 24 hours.", book, cur="book/", extra_foot='<script src="{P}assets/book.js"></script>')

# ------------------------------------------------------------------ RESOURCE PAGE TEMPLATE (noindex)
def template(L):
    return f'''
<!-- TEMPLATE: copy this folder to /resources/<short-name>/, replace every [BRACKETED] part, delete the robots noindex line in <head>, fix the canonical URL, add a card on /resources/ and the URL to /sitemap.xml. -->
<header class="page-hero"><div class="wrap">
  {crumb(L, ("resources/","Resources"), "[Resource title]")}
  <span class="eyebrow fade-up" style="--d:.05s">[Slides · PPTX] · [B2–C1]</span>
  <h1 class="rise" style="margin-top:20px">{words("[Resource |title]|")}</h1>
  <p class="lead fade-up" style="--d:.6s">[What it is, who it’s for, and what students will be able to do after the lesson.]</p>
  <div class="cta fade-up" style="--d:.75s">
    <!-- Paid: this item's OWN PayPal payment link (ask Dave; one link per item; its Auto-return points to the file on Google Drive). Free: link to the file, e.g. files/name.pdf -->
    <a class="btn primary" href="[PAYPAL-LINK-FOR-THIS-ITEM]" target="_blank" rel="noopener">[Buy for $2 with PayPal ↗ / Download free ↓]</a>
  </div>
</div></header>
<section style="padding-top:clamp(24px,4vw,48px)"><div class="wrap">
  <div class="principles">
    <div class="pr reveal" style="background:var(--surface-2)"><h3>What’s included</h3><p>[e.g. 25 editable slides, teacher notes, answer key]</p></div>
    <div class="pr reveal" style="background:var(--surface-2)"><h3>Level &amp; time</h3><p>[e.g. B2–C1 · one 60-minute lesson]</p></div>
    <div class="pr reveal" style="background:var(--surface-2)"><h3>Skills</h3><p>[e.g. hedging, academic tone, sentence transformation]</p></div>
  </div>
  <h2 class="subhead reveal" style="margin-top:64px">Preview</h2>
  <!-- Add 2–4 preview images saved in this folder: <img class="reveal" src="preview-1.jpg" alt="[describe slide]" width="1000" height="563" loading="lazy"> -->
  <div class="previews"><p class="note">[Preview images go here.]</p></div>
  <div class="notebox reveal" style="margin-top:48px"><h3>Licence</h3>For use by the buyer in their own classes. Please don’t re-upload, share or resell the file.</div>
</div></section>
'''
page("resources/_template/index.html", "[Resource title] – EAP [Slides / Word List / Worksheet] ([Level]) · Dave Nab", "[One or two sentences a teacher would search for: topic, level, format, what’s included.]", template, cur="resources/", canonical="https://davenab.com/resources/[short-name]/", extra_head='<meta name="robots" content="noindex">\n')

# ------------------------------------------------------------------ 404 (GitHub Pages serves /404.html for any missing address)
def notfound(L):
    picks = [("apps/", "AI apps", "Free practice apps for academic English"), ("resources/students/", "Resources for students", "Self-study packs and Quizlet sets"),
             ("resources/teachers/", "Resources for teachers", "Lesson kits, courses and slides"), ("ielts-courses/", "IELTS Courses", "Live coaching and a self-paced Writing course"),
             ("ielts-mock-test/", "IELTS Mock Test", "Speaking and Writing, from $25"), ("book/", "Book a class", "Takes about two minutes")]
    cards = "".join(f'<a class="who-opt" href="{L(h)}"><b>{t}</b><span>{d}</span><i aria-hidden="true">→</i></a>' for h, t, d in picks)
    return f"""
<header class="page-hero"><div class="wrap">
  <span class="eyebrow fade-up" style="--d:.05s">Error 404</span>
  <h1 class="rise" style="margin-top:20px">{words("This page |isn’t here.|")}</h1>
  <p class="lead fade-up" style="--d:.6s">The address may have a typo, or the page has moved. <span id="nf-guess"></span></p>
  <div class="cta fade-up" style="--d:.75s"><a class="btn primary" href="{L('')}">Go to the home page {ARR}</a></div>
</div></header>
<section style="padding-top:clamp(16px,3vw,32px)"><div class="wrap">
  <h2 class="subhead">Popular pages</h2>
  <nav class="who nf-grid" aria-label="Popular pages">{cards}</nav>
</div></section>
<script>(function(){{var p=location.pathname.toLowerCase(),m=[["note","/note-taking-trainer-ted/","DAVE Notes"],["grammar","/grammar-self-correction/","the Grammar Self-Correction Trainer"],["hedg","/nominalisation-hedging-trainer/","the Nominalisation and Hedging Trainer"],["nominal","/nominalisation-hedging-trainer/","the Nominalisation and Hedging Trainer"],["mock","/ielts-mock-test/","IELTS Mock Test"],["ielts","/ielts-courses/","IELTS Courses"],["teacher","/resources/teachers/","Resources for teachers"],["student","/resources/students/","Resources for students"],["resource","/resources/","Resources"],["download","/resources/","Resources"],["app","/apps/","AI apps"],["book","/book/","Book a class"],["contact","/about/#contact","Contact"],["about","/about/","About"],["galler","/gallery/","Gallery"],["testimon","/testimonials/","Testimonials"],["general","/general-english/","General English"],["service","/ielts-courses/","Courses"]];for(var i=0;i<m.length;i++)if(p.indexOf(m[i][0])>-1){{var a=document.createElement("a");a.className="link";a.href=m[i][1];a.textContent="Were you looking for "+m[i][2]+"?";document.getElementById("nf-guess").appendChild(a);break;}}}})()</script>
"""
page("404.html", "Page not found · Dave Nab", "This page could not be found on davenab.com.", notfound, canonical="https://davenab.com/", extra_head='<meta name="robots" content="noindex">\n')

print("built")
