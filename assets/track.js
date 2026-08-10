/* Ad-click attribution for the static momentum site.
   Captures Google Ads click ids (gclid/gbraid/wbraid) into a 90-day
   first-party cookie and appends them to outbound booking links
   (Jane, momentum-booking, TidyCal) so conversions fired on those domains
   attribute to the ad click. Cookies can't cross domains; URL params can.
   Mirrors the WPCode footer fix on drtoddanderson.com. */
(function () {
  'use strict';
  var PARAMS = ['gclid', 'gbraid', 'wbraid'];
  var HOSTS = ['janeapp.com', 'momentum-booking.web.app', 'tidycal.com'];

  var qs = new URLSearchParams(location.search);
  PARAMS.forEach(function (p) {
    var v = qs.get(p);
    if (v) {
      document.cookie = p + '=' + encodeURIComponent(v) +
        ';max-age=' + 90 * 24 * 3600 + ';path=/;SameSite=Lax';
    }
  });

  function saved(p) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + p + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function decorate(a) {
    var href = a.getAttribute('href') || '';
    if (!/^https?:/i.test(href)) return;
    var isBooking = HOSTS.some(function (h) { return href.indexOf(h) !== -1; });
    if (!isBooking) return;
    try {
      var u = new URL(href);
      var changed = false;
      PARAMS.forEach(function (p) {
        var v = saved(p);
        if (v && !u.searchParams.get(p)) { u.searchParams.set(p, v); changed = true; }
      });
      if (changed) a.setAttribute('href', u.toString());
    } catch (e) { /* leave the link untouched */ }
  }

  // Forward saved click ids into the booking widget's data-url attributes too.
  // embed.js forwards gclid from the PAGE URL only — a returning visitor
  // (gclid in our cookie, no longer in the URL) would otherwise open the
  // widget and book without attribution. embed.js reads data-url at mount
  // (inline) and at click time (popup), so decorating at load covers both.
  function decorateDataUrls() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-url]'), function (el) {
      var raw = el.getAttribute('data-url') || '';
      if (raw.indexOf('momentum-booking.web.app') === -1) return;
      try {
        var u = new URL(raw);
        var changed = false;
        PARAMS.forEach(function (p) {
          var v = saved(p);
          if (v && !u.searchParams.get(p)) { u.searchParams.set(p, v); changed = true; }
        });
        if (changed) el.setAttribute('data-url', u.toString());
      } catch (e) { /* leave the attribute untouched */ }
    });
  }

  function decorateAll() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), decorate);
    decorateDataUrls();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorateAll);
  } else {
    decorateAll();
  }

  // ---- GA4 funnel events (analytics only — NOT Ads conversions) ----
  // Popup opens: how many ad clickers actually reach the calendar.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.booking-popup') : null;
    if (el && typeof window.gtag === 'function') {
      window.gtag('event', 'widget_popup_open', { transport_type: 'beacon' });
    }
  }, true);
  // Completed widget bookings: embed.js re-dispatches the iframe's
  // booking.event_scheduled postMessage as a document event. This gives GA4 an
  // independent record of every widget booking — a cross-check on the Ads
  // "Booking confirmed" tag, which has never yet fired in production.
  document.addEventListener('booking.event_scheduled', function () {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'widget_booking_scheduled', { transport_type: 'beacon' });
    }
  });
  // Links created after load (e.g. the chat widget's booking button) get
  // decorated at click time, before navigation.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) decorate(a);
  }, true);
})();
