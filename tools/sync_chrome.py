#!/usr/bin/env python3
"""Copy the shared header and footer (partials/) into every page.

Run from the repo root after editing anything in partials/:

    python3 tools/sync_chrome.py

Each page gets the markup between <!-- site-header --> / <!-- /site-header -->
and <!-- site-footer --> / <!-- /site-footer --> markers, plus links to
/assets/site.css and /assets/site.js. The first run replaces the page's old
<nav> and <footer>. Ad landing pages get the short header (logo + phone).
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = '20261127c'  # bump when site.css or site.js change

LANDING = {'thyroid/index.html', 'hashimotos/index.html', 'hormones/index.html',
           'gut-health/index.html', 'free-consult/index.html', 'blood-work-analysis/index.html'}
SKIP = {'free-consult-light/index.html'}  # noindex test page, left alone on purpose

def read(p): return (ROOT / p).read_text(encoding='utf8')

HEADER = {'full': read('partials/header-full.html').strip(), 'landing': read('partials/header-landing.html').strip()}
FOOTER = read('partials/footer.html').strip()

def block(name, html): return f'<!-- site-{name} -->\n{html}\n<!-- /site-{name} -->'

def put(s, name, html, fallback):
    marked = re.compile(rf'<!-- site-{name} -->.*?<!-- /site-{name} -->', re.S)
    if marked.search(s):
        return marked.sub(lambda m: block(name, html), s, count=1)
    return fallback(s, block(name, html))

def header_first(s, b):
    body = s.index('<body')
    m = re.compile(r'<nav\b.*?</nav>', re.S).search(s, body)
    if not m: raise SystemExit('no <nav> to replace')
    return s[:m.start()] + b + s[m.end():]

def footer_first(s, b):
    m = re.compile(r'<footer\b.*?</footer>', re.S).search(s)
    if m: return s[:m.start()] + b + s[m.end():]
    i = s.rindex('</body>')
    return s[:i] + b + '\n' + s[i:]

def assets(s):
    s = re.sub(r'\s*<link rel="stylesheet" href="/assets/site\.css[^"]*"\s*/?>', '', s)
    s = re.sub(r'\s*<script src="/assets/site\.js[^"]*" defer></script>', '', s)
    if '/assets/icons.css' not in s:
        s = s.replace('</head>', '  <link rel="stylesheet" href="/assets/icons.css" />\n</head>', 1)
    s = s.replace('</head>', f'  <link rel="stylesheet" href="/assets/site.css?v={VERSION}" />\n</head>', 1)
    i = s.rindex('</body>')
    return s[:i] + f'<script src="/assets/site.js?v={VERSION}" defer></script>\n' + s[i:]

def main():
    pages = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*.html')
                   if not {'partials', '.git', 'node_modules'} & set(p.relative_to(ROOT).parts))
    for rel in pages:
        if rel in SKIP: continue
        s = read(rel); o = s
        s = put(s, 'header', HEADER['landing' if rel in LANDING else 'full'], header_first)
        s = put(s, 'footer', FOOTER, footer_first)
        s = assets(s)
        if s != o:
            (ROOT / rel).write_text(s, encoding='utf8'); print('updated', rel)

if __name__ == '__main__':
    main()
