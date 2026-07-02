(function () {
	'use strict';

	var state = {
		open: false,
		busy: false,
		messages: [],
		sessionId: getOrCreateSessionId()
	};

	var root, log, input, sendBtn, bubble, typingEl;

	function getOrCreateSessionId() {
		try {
			var sid = sessionStorage.getItem('mchat_session_id');
			if (!sid) {
				sid = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
				sessionStorage.setItem('mchat_session_id', sid);
			}
			return sid;
		} catch (e) {
			return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
		}
	}

	// ---- Conversation persistence across page navigations ----------------------
	// The thread (and whether the panel was open) survives clicking between pages,
	// so a mid-conversation visitor never loses their place. Session-scoped: a new
	// tab or browser restart starts fresh.
	var HISTORY_KEY = 'mchat_history';

	function persist() {
		try {
			sessionStorage.setItem(HISTORY_KEY, JSON.stringify({
				messages: state.messages.slice(-40),
				open: state.open
			}));
		} catch (e) { /* sessionStorage may be blocked or full */ }
	}

	function loadHistory() {
		try {
			var raw = sessionStorage.getItem(HISTORY_KEY);
			if (!raw) return null;
			var data = JSON.parse(raw);
			if (!data || !Array.isArray(data.messages) || !data.messages.length) return null;
			return data;
		} catch (e) {
			return null;
		}
	}

	function el(tag, attrs, children) {
		var node = document.createElement(tag);
		if (attrs) {
			Object.keys(attrs).forEach(function (k) {
				if (k === 'class') node.className = attrs[k];
				else if (k === 'text') node.textContent = attrs[k];
				else if (k === 'html') node.innerHTML = attrs[k];
				else node.setAttribute(k, attrs[k]);
			});
		}
		(children || []).forEach(function (c) { node.appendChild(c); });
		return node;
	}

	function render() {
		bubble = el('button', { class: 'mchat-bubble', 'aria-label': 'Open scheduling assistant' });
		var iconOpen = '<svg class="mchat-bubble-icon-open" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
		var iconClose = '<svg class="mchat-bubble-icon-close" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
		bubble.innerHTML = iconOpen + '<span class="mchat-bubble-label">' + (MomentumChat.buttonLabel || 'Schedule') + '</span>' + iconClose;
		bubble.addEventListener('click', toggle);

		root = el('div', { class: 'mchat-panel', 'aria-hidden': 'true', role: 'dialog', 'aria-label': 'Chat with Momentum Health' });

		// Header with avatar
		var header = el('div', { class: 'mchat-header' });
		var avatar = el('div', { class: 'mchat-avatar' });
		if (MomentumChat.avatarUrl) {
			var img = el('img', { src: MomentumChat.avatarUrl, alt: '', class: 'mchat-avatar-img' });
			avatar.appendChild(img);
		} else {
			avatar.textContent = 'M';
		}
		var headerText = el('div', { class: 'mchat-header-text' });
		headerText.appendChild(el('div', { class: 'mchat-title', text: MomentumChat.panelTitle || 'Scheduling Assistant' }));
		headerText.appendChild(el('div', { class: 'mchat-subtitle', text: 'Usually replies instantly' }));
		var close = el('button', { class: 'mchat-close', 'aria-label': 'Close chat', text: '×' });
		close.addEventListener('click', toggle);
		header.appendChild(avatar);
		header.appendChild(headerText);
		header.appendChild(close);

		var disclaimer = el('div', { class: 'mchat-disclaimer', text: MomentumChat.disclaimer });
		log = el('div', { class: 'mchat-log' });

		var form = el('form', { class: 'mchat-form' });
		input = el('input', { type: 'text', class: 'mchat-input', placeholder: 'Type a message…', autocomplete: 'off', 'aria-label': 'Message' });
		sendBtn = el('button', { type: 'submit', class: 'mchat-send', 'aria-label': 'Send message', title: 'Send' });
		sendBtn.textContent = 'Send';
		form.appendChild(input);
		form.appendChild(sendBtn);
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			send();
		});

		root.appendChild(header);
		root.appendChild(disclaimer);
		root.appendChild(log);
		root.appendChild(form);

		document.body.appendChild(bubble);
		document.body.appendChild(root);

		var restored = loadHistory();
		if (restored) {
			// Mid-conversation page navigation: replay the thread instead of
			// greeting again, and reopen the panel if it was open (without
			// stealing focus — no auto-keyboard on mobile).
			state.messages = restored.messages;
			state.messages.forEach(function (m) { renderMsgDom(m.role, m.content); });
			if (restored.open) {
				state.open = true;
				root.setAttribute('aria-hidden', 'false');
				root.classList.add('mchat-open');
				bubble.classList.add('mchat-bubble-open');
			}
		} else {
			addMessage('assistant', MomentumChat.greeting);
			renderQuickReplies();
		}
		schedulePopout();
	}

	function renderQuickReplies() {
		var replies = MomentumChat.quickReplies || [];
		if (!replies.length) return;
		var wrap = el('div', { class: 'mchat-quick-replies' });
		replies.forEach(function (qr) {
			var btn = el('button', { type: 'button', class: 'mchat-quick-reply', text: qr.label });
			btn.addEventListener('click', function () {
				// Remove the whole row once one is tapped.
				if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
				input.value = qr.message;
				send();
			});
			wrap.appendChild(btn);
		});
		log.appendChild(wrap);
		scrollLogToBottom();
	}

	// Mid-conversation tappable options (e.g. timing: ASAP / Next week / Any Friday),
	// sent by the assistant via an [OPTIONS] directive. Reuses the quick-reply chips.
	function renderOptions(options) {
		if (!options || !options.length) return;
		var wrap = el('div', { class: 'mchat-quick-replies' });
		options.forEach(function (opt) {
			var text = String(opt);
			var btn = el('button', { type: 'button', class: 'mchat-quick-reply', text: text });
			btn.addEventListener('click', function () {
				if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
				input.value = text;
				send();
			});
			wrap.appendChild(btn);
		});
		log.appendChild(wrap);
		scrollLogToBottom();
	}

	var popoutEl;
	function schedulePopout() {
		var text = (MomentumChat.popoutText || '').trim();
		var delay = Math.max(0, MomentumChat.popoutDelay || 0) * 1000;
		if (!text || delay === 0) return;
		try {
			if (sessionStorage.getItem('mchat_popout_dismissed')) return;
			if (sessionStorage.getItem('mchat_opened')) return;
		} catch (e) { /* ignore */ }
		setTimeout(function () {
			if (state.open) return;
			showPopout(text);
		}, delay);
	}

	function showPopout(text) {
		popoutEl = el('div', { class: 'mchat-popout', role: 'button', 'aria-label': 'Open chat: ' + text });
		var msg = el('span', { class: 'mchat-popout-text', text: text });
		var close = el('button', { class: 'mchat-popout-close', 'aria-label': 'Dismiss', text: '×' });
		close.addEventListener('click', function (e) {
			e.stopPropagation();
			dismissPopout();
		});
		popoutEl.appendChild(msg);
		popoutEl.appendChild(close);
		popoutEl.addEventListener('click', function () {
			dismissPopout();
			if (!state.open) toggle();
		});
		document.body.appendChild(popoutEl);
		// Trigger entrance animation.
		requestAnimationFrame(function () {
			popoutEl.classList.add('mchat-popout-visible');
		});
		// Auto-dismiss after 25s if untouched.
		setTimeout(function () {
			if (popoutEl) dismissPopout();
		}, 25000);
	}

	function dismissPopout() {
		if (!popoutEl) return;
		popoutEl.classList.remove('mchat-popout-visible');
		try { sessionStorage.setItem('mchat_popout_dismissed', '1'); } catch (e) { /* ignore */ }
		var el2 = popoutEl;
		popoutEl = null;
		setTimeout(function () {
			if (el2.parentNode) el2.parentNode.removeChild(el2);
		}, 250);
	}

	function toggle() {
		state.open = !state.open;
		root.setAttribute('aria-hidden', state.open ? 'false' : 'true');
		root.classList.toggle('mchat-open', state.open);
		bubble.classList.toggle('mchat-bubble-open', state.open);
		persist();
		if (state.open) {
			if (popoutEl) dismissPopout();
			setTimeout(function () { input.focus(); }, 220);
			// Track the first open per browser session.
			try {
				if (!sessionStorage.getItem('mchat_opened')) {
					sessionStorage.setItem('mchat_opened', '1');
					track('open');
				}
			} catch (e) { /* sessionStorage may be blocked */ }
		}
	}

	function track(event) {
		try {
			fetch(MomentumChat.restUrl + 'track', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': MomentumChat.nonce },
				body: JSON.stringify({ event: event }),
				keepalive: true
			});
		} catch (e) { /* fire and forget */ }
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// Defense-in-depth: the backend already strips [TOOL]/[OPTIONS] control
	// directives, but strip them client-side too so a backend miss, a model
	// quirk, or an OLD message replayed from sessionStorage can never render a
	// raw "[OPTIONS]...[/OPTIONS]" tag in a bubble. Handles paired blocks plus
	// any stray/unclosed tag fragments; case-insensitive.
	function stripDirectives(text) {
		return String(text)
			.replace(/\[OPTIONS\][\s\S]*?\[\/OPTIONS\]/gi, '')
			.replace(/\[TOOL\][\s\S]*?\[\/TOOL\]/gi, '')
			.replace(/\[\/?OPTIONS\]/gi, '')
			.replace(/\[\/?TOOL\]/gi, '')
			.replace(/[ \t]+\n/g, '\n')
			.trim();
	}

	function renderText(text) {
		var out = escapeHtml(stripDirectives(text));
		// Markdown links: [label](url)
		out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
			return '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>';
		});
		// Bare http/https URLs (skip ones already inside an href)
		out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, pre, url) {
			return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
		});
		return out;
	}

	// Render one message bubble into the log (no state change) — used both for
	// live messages and for replaying persisted history on page load.
	function renderMsgDom(role, text) {
		var msg = el('div', { class: 'mchat-msg mchat-msg-' + role });
		msg.innerHTML = renderText(text);
		log.appendChild(msg);
		scrollLogToBottom();
	}

	function addMessage(role, text) {
		state.messages.push({ role: role, content: text });
		renderMsgDom(role, text);
		persist();
	}

	// Renders like an assistant bubble but is NOT added to state.messages, so
	// error text never pollutes the AI-visible history or saved transcripts.
	function addNotice(text) {
		var msg = el('div', { class: 'mchat-msg mchat-msg-assistant' });
		msg.innerHTML = renderText(text);
		log.appendChild(msg);
		scrollLogToBottom();
	}

	// One-tap retry chip shown under an error notice. Runs onRetry and removes
	// itself; reuses the quick-reply styling.
	function showRetry(onRetry) {
		var wrap = el('div', { class: 'mchat-quick-replies' });
		var btn = el('button', { type: 'button', class: 'mchat-quick-reply', text: 'Try again' });
		btn.addEventListener('click', function () {
			if (state.busy) return;
			if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
			onRetry();
		});
		wrap.appendChild(btn);
		log.appendChild(wrap);
		scrollLogToBottom();
	}

	function showTyping() {
		if (typingEl) return;
		typingEl = el('div', { class: 'mchat-typing', 'aria-label': 'Assistant is typing' });
		typingEl.appendChild(el('span'));
		typingEl.appendChild(el('span'));
		typingEl.appendChild(el('span'));
		log.appendChild(typingEl);
		scrollLogToBottom();
	}

	function hideTyping() {
		if (typingEl && typingEl.parentNode) {
			typingEl.parentNode.removeChild(typingEl);
		}
		typingEl = null;
	}

	function scrollLogToBottom() {
		requestAnimationFrame(function () {
			log.scrollTop = log.scrollHeight;
		});
	}

	function addSlotButtons(slots, hasMore) {
		if (!slots.length) {
			addMessage('assistant', "I don't see any open slots in the next few weeks. The easiest thing is to call the office at " + (MomentumChat.phone || 'the number on our site') + ".");
			return;
		}
		var wrap = el('div', { class: 'mchat-slots' });
		slots.forEach(function (slot) {
			var btn = el('button', { type: 'button', class: 'mchat-slot', text: slot.label });
			btn.addEventListener('click', function () { chooseSlot(slot); });
			wrap.appendChild(btn);
		});
		if (hasMore) {
			var lastStartsAt = slots[slots.length - 1].starts_at;
			var moreBtn = el('button', { type: 'button', class: 'mchat-slot mchat-slot-more', text: 'Show more times →' });
			moreBtn.addEventListener('click', function () {
				moreBtn.disabled = true;
				moreBtn.textContent = 'Loading more times…';
				showTyping();
				fetchSlots(lastStartsAt, moreBtn);
			});
			wrap.appendChild(moreBtn);
		}
		log.appendChild(wrap);
		scrollLogToBottom();
	}

	function chooseSlot(slot) {
		fetch(MomentumChat.restUrl + 'booking-link', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': MomentumChat.nonce },
			body: JSON.stringify({ starts_at: slot.starts_at, provider_id: slot.provider_id, session_id: state.sessionId })
		})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				if (data.url) {
					addMessage('assistant', "Perfect — " + slot.label + ". One last step:");
					var link = el('a', { href: data.url, target: '_blank', rel: 'noopener', class: 'mchat-cta' });
					link.innerHTML = 'Confirm appointment <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
					link.addEventListener('click', function () { track('booking_click'); });
					log.appendChild(link);
					scrollLogToBottom();
				}
			});
	}

	function setBusy(b) {
		state.busy = b;
		sendBtn.disabled = b;
		// Don't disable the input — it dismisses the mobile keyboard and forces
		// the user to re-tap to type again. send() already gates on state.busy.
		if (!b) {
			// Re-focus the input after a response so they can keep typing.
			setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
		}
	}

	function send() {
		var text = input.value.trim();
		if (!text || state.busy) return;
		input.value = '';
		addMessage('user', text);
		deliver();
	}

	// Sends the current thread to the assistant. Retry-safe: the user's message
	// is already in state.messages, so the "Try again" chip just calls this again.
	function deliver() {
		setBusy(true);
		showTyping();

		fetch(MomentumChat.restUrl + 'chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': MomentumChat.nonce },
			body: JSON.stringify({ messages: state.messages, session_id: state.sessionId })
		})
			.then(function (r) { return r.json().catch(function () { return { code: 'bad_response', message: 'Server returned an unreadable response (HTTP ' + r.status + ').' }; }); })
			.then(function (data) {
				hideTyping();
				data = data || {};
				if (data.code && data.message) {
					addNotice(data.message + ' If this keeps happening, please call ' + (MomentumChat.phone || 'the office') + '.');
					showRetry(deliver);
					setBusy(false);
					return;
				}
				if (data.reply) {
					addMessage('assistant', data.reply);
				}
				if (data.options && data.options.length) {
					renderOptions(data.options);
				}
				if (data.tool && data.tool.action === 'fetch_slots') {
					state.timeframe = (data.tool.timeframe || '').toString();
					showTyping();
					fetchSlots();
				} else {
					if (!data.reply && !(data.options && data.options.length)) {
						addNotice("Sorry, I didn't catch a response. If this keeps happening, please call " + (MomentumChat.phone || 'the office') + '.');
						showRetry(deliver);
					}
					setBusy(false);
				}
			})
			.catch(function (err) {
				hideTyping();
				if (window.console && console.error) console.error('Momentum Chat fetch error:', err);
				addNotice("I'm having trouble connecting right now. You can try again, or call " + (MomentumChat.phone || 'the office') + '.');
				showRetry(deliver);
				setBusy(false);
			});
	}

	function fetchSlots(startsAfter, moreBtn) {
		var payload = { session_id: state.sessionId };
		if (startsAfter) payload.starts_after = startsAfter;
		if (state.timeframe) payload.timeframe = state.timeframe;
		fetch(MomentumChat.restUrl + 'slots', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': MomentumChat.nonce },
			body: JSON.stringify(payload)
		})
			.then(function (r) { return r.json(); })
			.then(function (data) {
				hideTyping();
				if (moreBtn && moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn);
				if (data.code && data.message) {
					addNotice("I can't pull up the calendar right now (" + data.message + "). You can try again, or call the office at " + (MomentumChat.phone || 'the number on our site') + ".");
					showRetry(function () { setBusy(true); showTyping(); fetchSlots(startsAfter); });
				} else if (data.slots && data.slots.length) {
					if (!startsAfter) track('slots_shown');
					addSlotButtons(data.slots, !!data.has_more);
				} else if (data.message) {
					// Soft "no open times for that" note (e.g. a closed day) — not an error.
					addMessage('assistant', data.message);
					if (data.options && data.options.length) renderOptions(data.options);
				} else if (startsAfter) {
					addMessage('assistant', "Those are all the open times I see right now. Want to call the office at " + (MomentumChat.phone || 'the number on our site') + " to find something further out?");
				} else {
					addMessage('assistant', "I don't see any open times right now. Please call the office at " + (MomentumChat.phone || 'the number on our site') + ".");
				}
				setBusy(false);
			})
			.catch(function () {
				hideTyping();
				if (moreBtn && moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn);
				addNotice("I'm having trouble reaching the calendar. You can try again, or call the office at " + (MomentumChat.phone || 'the number on our site') + ".");
				showRetry(function () { setBusy(true); showTyping(); fetchSlots(startsAfter); });
				setBusy(false);
			});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', render);
	} else {
		render();
	}
})();
