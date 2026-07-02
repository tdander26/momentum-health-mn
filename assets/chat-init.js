/*
 * Momentum chat widget loader.
 *
 * Drop ONE line before </body> on any page to add the assistant:
 *     <script src="/assets/chat-init.js" defer></script>
 *
 * This file holds all the editable copy/config in one place, then pulls in
 * chat.css + chat.js. It is additive — it renders a floating bubble and
 * touches nothing else on the page.
 *
 * The assistant answers questions about the practice and books the FREE
 * 15-minute new-patient consult. Open times come live from the same booking
 * engine as the site's scheduler (momentum-booking), so there's one source
 * of truth. Backend: https://momentum-booking.web.app/api/bot/
 */
(function () {
  'use strict';
  if (window.__momentumChatLoaded) return;
  window.__momentumChatLoaded = true;

  // ---- Config (edit freely) -------------------------------------------------
  window.MomentumChat = {
    // Backend base URL — must end with a slash. Endpoints: chat, slots,
    // booking-link, track. (This is the momentum-booking Firebase app.)
    restUrl: 'https://momentum-booking.web.app/api/bot/',

    // No WordPress nonce on this static site; the backend uses CORS, not nonces.
    nonce: '',

    // Shown in fallbacks ("please call ...").
    phone: '(763) 760-9176',

    // Bubble + panel.
    buttonLabel: 'Chat',
    panelTitle: 'Momentum Assistant',
    avatarUrl: '/favicon.svg', // gold "M" brand mark

    // First message the assistant shows when the panel opens. Swapped for an
    // after-hours variant below when the office is closed.
    greeting:
      "Hi! I'm the Momentum assistant. I can answer questions about the practice " +
      "or book you a free 15-minute consult with Dr. Anderson or Dr. Payne. " +
      "What can I help you with?",

    // Tappable starter chips under the greeting. label = what's shown,
    // message = what gets sent as if the visitor typed it.
    quickReplies: [
      { label: 'Book a free consult', message: "I'd like to book a free 15-minute consult" },
      { label: 'What do you treat?', message: 'What conditions do you help with?' },
      { label: 'Do you take insurance?', message: 'Do you take insurance?' }
    ],

    // Little attention nudge that pops next to the bubble after a delay.
    popoutText: 'Questions? Chat with us →',
    popoutDelay: 12, // seconds; set 0 to disable

    // Small print under the header.
    disclaimer: 'Automated assistant · not medical advice'
  };

  // ---- After-hours greeting -------------------------------------------------
  // Office hours (America/Chicago): Mon–Thu 10:00–1:30 and 3:00–6:00. Outside
  // those windows the greeting sets expectations — the bot still books 24/7.
  (function () {
    function officeOpenNow() {
      try {
        var parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
        }).formatToParts(new Date());
        var get = function (t) {
          for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
          return '';
        };
        var openDays = { Mon: 1, Tue: 1, Wed: 1, Thu: 1 };
        if (!openDays[get('weekday')]) return false;
        var mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
        return (mins >= 600 && mins < 810) || (mins >= 900 && mins < 1080); // 10:00–1:30, 3:00–6:00
      } catch (e) {
        return true; // if in doubt, use the normal greeting
      }
    }
    if (!officeOpenNow()) {
      window.MomentumChat.greeting =
        "Hi! The office is closed right now, but I'm here 24/7 — I can answer " +
        "questions about the practice or book you a free 15-minute consult with " +
        "Dr. Anderson or Dr. Payne. What can I help you with?";
    }
  })();

  // ---- Inject styles + widget ----------------------------------------------
  var v = '20260702b'; // bump to bust cache after edits
  function mount() {
    if (window.__momentumChatMounted) return;
    window.__momentumChatMounted = true;
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/assets/chat.css?v=' + v;
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = '/assets/chat.js?v=' + v;
    js.defer = true;
    (document.body || document.documentElement).appendChild(js);
  }

  // Readiness gate: only show the bubble once the backend assistant is deployed
  // AND its API key is set. Until then we stay completely hidden — no dead
  // "call the office" bubble. A positive result is cached for the session so we
  // probe at most once per visit; a negative result is NOT cached, so the bubble
  // appears on the next page view as soon as the backend goes live.
  try {
    if (sessionStorage.getItem('mchat_ready') === '1') { mount(); return; }
  } catch (e) { /* sessionStorage may be blocked */ }

  try {
    fetch(window.MomentumChat.restUrl + 'ping', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.ready) {
          try { sessionStorage.setItem('mchat_ready', '1'); } catch (e) { /* ignore */ }
          mount();
        }
      })
      .catch(function () { /* backend unreachable — stay hidden */ });
  } catch (e) { /* stay hidden */ }
})();
