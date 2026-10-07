#!/usr/bin/env python3
"""Pick the blog's featured article by momentum: the post whose views jumped
the most this week compared with its usual week.

Runs daily from .github/workflows/trending-featured.yml. Reads page views per
/blog/<slug>/ from Google Analytics 4, scores every post, and rewrites the
cards region of blog/index.html (between the cards:start / cards:end
comments) so the winner sits in the Featured slot and the rest follow newest
first. When there is too little traffic to call a winner, the page is left
alone, so a quiet week never reshuffles the blog.

Scoring, per post:
  recent   = views in the last 7 full days
  baseline = views in the 28 days before that, divided by 4 (a usual week)
  spike    = recent - baseline
The post with the biggest positive spike wins (ties go to more recent views).
If no post spiked, the most viewed post this week wins. A post needs at least
MIN_RECENT_VIEWS this week to be considered at all. A brand new post has no
baseline, so its first week counts entirely as spike.

Usage:
  GA4_PROPERTY_ID=123 GOOGLE_APPLICATION_CREDENTIALS=key.json python3 scripts/feature_trending.py
  python3 scripts/feature_trending.py --views views.json   # offline/testing
views.json looks like {"/blog/slug/": {"recent": 40, "prior": 60}, ...}
where prior is the 28-day total before the recent week.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'blog', 'index.html')
MIN_RECENT_VIEWS = int(os.environ.get('MIN_RECENT_VIEWS', '10'))

START = re.compile(r'<!-- cards:start[^>]*-->\n')
END = '<!-- cards:end -->'
CARD = re.compile(r'[ \t]*<a class="blog-card[^"]*" href="([^"]+)">.*?</a>', re.S)
DATE = re.compile(r'&middot; ([A-Z][a-z]+ \d{1,2}, \d{4}) &middot;')
TAG = '<div class="featured-tag">Featured</div>'


def fetch_views(property_id):
    """Return {path: {"recent": n, "prior": n}} for /blog/ pages from GA4."""
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        DateRange, Dimension, Filter, FilterExpression, Metric, RunReportRequest)

    client = BetaAnalyticsDataClient()
    views = {}
    for key, start, end in (('recent', '7daysAgo', 'yesterday'),
                            ('prior', '35daysAgo', '8daysAgo')):
        report = client.run_report(RunReportRequest(
            property=f'properties/{property_id}',
            dimensions=[Dimension(name='pagePath')],
            metrics=[Metric(name='screenPageViews')],
            date_ranges=[DateRange(start_date=start, end_date=end)],
            dimension_filter=FilterExpression(filter=Filter(
                field_name='pagePath',
                string_filter=Filter.StringFilter(
                    match_type=Filter.StringFilter.MatchType.BEGINS_WITH, value='/blog/'))),
            limit=1000,
        ))
        for row in report.rows:
            path = normalize(row.dimension_values[0].value)
            entry = views.setdefault(path, {'recent': 0, 'prior': 0})
            entry[key] += int(row.metric_values[0].value)
    return views


def normalize(path):
    path = path.split('?')[0].split('#')[0]
    if path.endswith('index.html'):
        path = path[:-len('index.html')]
    return path if path.endswith('/') else path + '/'


def score(views, hrefs):
    """Return (winning href or None, {href: (recent, baseline, spike)})."""
    table = {}
    for href in hrefs:
        v = views.get(normalize(href), {})
        recent = v.get('recent', 0)
        baseline = v.get('prior', 0) / 4
        table[href] = (recent, baseline, recent - baseline)
    eligible = [h for h in hrefs if table[h][0] >= MIN_RECENT_VIEWS]
    if not eligible:
        return None, table
    spiked = [h for h in eligible if table[h][2] > 0]
    if spiked:
        return max(spiked, key=lambda h: (table[h][2], table[h][0])), table
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


def rewrite(html, winner):
    start = START.search(html)
    end = html.index(END)
    region = html[start.end():end]
    cards = {m.group(1): unfeature(m.group(0)) for m in CARD.finditer(region)}
    if winner not in cards:
        raise SystemExit(f'{winner} has no card on the blog index')
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
    ap = argparse.ArgumentParser()
    ap.add_argument('--views', help='JSON file of views instead of calling GA4')
    ap.add_argument('--dry-run', action='store_true', help='print the choice, write nothing')
    args = ap.parse_args()

    if args.views:
        with open(args.views) as f:
            views = {normalize(k): v for k, v in json.load(f).items()}
    else:
        prop = os.environ.get('GA4_PROPERTY_ID')
        if not prop:
            print('GA4_PROPERTY_ID is not set; leaving the featured article alone.')
            return
        views = fetch_views(prop)

    with open(INDEX) as f:
        html = f.read()
    region = html[START.search(html).end():html.index(END)]
    hrefs = [m.group(1) for m in CARD.finditer(region)]
    winner, table = score(views, hrefs)

    for h in hrefs:
        r, b, s = table[h]
        print(f'{h:50} recent={r:5}  usual week={b:7.1f}  spike={s:+7.1f}')
    if winner is None:
        print(f'No post reached {MIN_RECENT_VIEWS} views this week; leaving the featured article alone.')
        return
    print(f'Featured: {winner} (was {current_featured(html)})')
    if args.dry_run or winner == current_featured(html):
        return

    with open(INDEX, 'w') as f:
        f.write(rewrite(html, winner))


if __name__ == '__main__':
    sys.exit(main())
