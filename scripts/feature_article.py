#!/usr/bin/env python3
"""Choose which post sits in the Featured slot on /blog/.

Plain Python, standard library only. Run it on your own computer from the
repo folder, then commit and push blog/index.html as usual. It only rewrites
the cards region of blog/index.html (between the cards:start / cards:end
comments): the chosen post moves into the Featured slot and the rest follow
newest first.

Three ways to use it:

  python3 scripts/feature_article.py
      List the posts and show which one is featured now.

  python3 scripts/feature_article.py hot-flashes-natural-relief
      Feature that post (the folder name under blog/).

  python3 scripts/feature_article.py --views this-week.csv [--before last-month.csv]
      Feature the most popular post from a Google Analytics export.
      In GA4 open Reports > Engagement > Pages and screens, pick the date
      range, and use Share > Download File > CSV.
      With only this-week.csv, the most viewed post wins.
      With --before (an export of the 4 weeks before), the post whose views
      jumped the most over its usual week wins, so a new or suddenly busy
      post beats one that is always steady.
      Add --dry-run to see the scores without changing anything.
"""
import argparse
import csv
import datetime as dt
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'blog', 'index.html')
MIN_VIEWS = 10

START = re.compile(r'<!-- cards:start[^>]*-->\n')
END = '<!-- cards:end -->'
CARD = re.compile(r'[ \t]*<a class="blog-card[^"]*" href="([^"]+)">.*?</a>', re.S)
DATE = re.compile(r'&middot; ([A-Z][a-z]+ \d{1,2}, \d{4}) &middot;')
TAG = '<div class="featured-tag">Featured</div>'


def normalize(path):
    path = path.split('?')[0].split('#')[0]
    if path.endswith('index.html'):
        path = path[:-len('index.html')]
    return path if path.endswith('/') else path + '/'


def read_views(filename):
    """Return {path: views} from a GA4 CSV export (or any CSV with a page
    path column and a Views column). Lines starting with # are skipped."""
    with open(filename, newline='', encoding='utf-8-sig') as f:
        text = ''.join(l for l in f if not l.startswith('#') and l.strip())
    rows = csv.DictReader(io.StringIO(text))
    cols = rows.fieldnames or []
    path_col = next((c for c in cols if 'path' in c.lower()), None)
    views_col = next((c for c in cols if c.strip().lower() == 'views'), None)
    if not path_col or not views_col:
        sys.exit(f'{filename}: need a page path column and a Views column, found {cols}')
    views = {}
    for row in rows:
        path = (row[path_col] or '').strip()
        if not path.startswith('/blog/'):
            continue
        try:
            n = int(float((row[views_col] or '0').replace(',', '')))
        except ValueError:
            continue
        views[normalize(path)] = views.get(normalize(path), 0) + n
    return views


def score(recent, before, hrefs):
    """Return (winning href or None, {href: (views, usual week, jump)})."""
    table = {}
    for h in hrefs:
        r = recent.get(normalize(h), 0)
        usual = before.get(normalize(h), 0) / 4 if before is not None else 0
        table[h] = (r, usual, r - usual)
    eligible = [h for h in hrefs if table[h][0] >= MIN_VIEWS]
    if not eligible:
        return None, table
    jumped = [h for h in eligible if table[h][2] > 0] if before is not None else []
    if jumped:
        return max(jumped, key=lambda h: (table[h][2], table[h][0])), table
    return max(eligible, key=lambda h: table[h][0]), table


def card_date(card):
    m = DATE.search(card)
    return dt.datetime.strptime(m.group(1), '%B %d, %Y') if m else dt.datetime.min


def unfeature(card):
    card = card.replace('blog-card featured-card', 'blog-card', 1)
    return re.sub(r'\n\s*' + re.escape(TAG), '', card, count=1)


def reindent(card, base):
    lines = card.strip('\n').split('\n')
    indent = len(lines[0]) - len(lines[0].lstrip())
    return '\n'.join(' ' * base + l[indent:] if l.strip() else '' for l in lines)


def as_featured(card):
    card = reindent(card, 4).replace('class="blog-card"', 'class="blog-card featured-card"', 1)
    return card.replace('">\n', '">\n      ' + TAG + '\n', 1)


def region(html):
    return html[START.search(html).end():html.index(END)]


def rewrite(html, winner):
    start = START.search(html)
    end = html.index(END)
    cards = {m.group(1): unfeature(m.group(0)) for m in CARD.finditer(html[start.end():end])}
    rest = sorted((h for h in cards if h != winner),
                  key=lambda h: card_date(cards[h]), reverse=True)
    body = (as_featured(cards[winner]) + '\n\n    <div class="blog-grid">\n\n'
            + '\n\n'.join(reindent(cards[h], 6) for h in rest)
            + '\n\n    </div>\n')
    return html[:start.end()] + body + html[end:]


def current_featured(html):
    m = re.search(r'<a class="blog-card featured-card" href="([^"]+)"', html)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser(description='Choose the featured post on /blog/.')
    ap.add_argument('post', nargs='?', help='folder name of the post to feature')
    ap.add_argument('--views', metavar='CSV', help='GA4 Pages and screens export for the recent period')
    ap.add_argument('--before', metavar='CSV', help='export for the 4 weeks before, to measure the jump')
    ap.add_argument('--dry-run', action='store_true', help='show the choice, change nothing')
    args = ap.parse_args()

    with open(INDEX, encoding='utf-8') as f:
        html = f.read()
    hrefs = [m.group(1) for m in CARD.finditer(region(html))]
    now = current_featured(html)

    if args.post:
        winner = normalize('/blog/' + args.post.strip('/').split('/')[-1])
        if winner not in hrefs:
            sys.exit(f'No card for {winner}. Posts: ' + ', '.join(hrefs))
    elif args.views:
        recent = read_views(args.views)
        before = read_views(args.before) if args.before else None
        winner, table = score(recent, before, hrefs)
        for h in hrefs:
            r, usual, jump = table[h]
            extra = f'  usual week={usual:7.1f}  jump={jump:+7.1f}' if before is not None else ''
            print(f'{h:50} views={r:5}{extra}')
        if winner is None:
            print(f'No post reached {MIN_VIEWS} views; leaving the featured post alone.')
            return
    else:
        for h in hrefs:
            print(('* ' if h == now else '  ') + h)
        print('(* is featured now)')
        return

    if winner == now:
        print(f'{winner} is already featured.')
        return
    print(f'Featured: {winner} (was {now})')
    if args.dry_run:
        return
    with open(INDEX, 'w', encoding='utf-8') as f:
        f.write(rewrite(html, winner))
    print('Updated blog/index.html. Commit and push it to publish.')


if __name__ == '__main__':
    main()
