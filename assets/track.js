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

  function decorateAll() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), decorate);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorateAll);
  } else {
    decorateAll();
  }
  // Links created after load (e.g. the chat widget's booking button) get
  // decorated at click time, before navigation.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) decorate(a);
  }, true);
})();
