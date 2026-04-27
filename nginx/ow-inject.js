/**
 * Open WebUI injection script — loaded into every OW iframe page.
 *
 * Responsibilities:
 *   1. Seed localStorage.token and ow_auth cookie from ?token= URL param
 *      so OW authenticates without a manual login step.
 *   2. Patch history.pushState/replaceState to keep URLs under /ow/ prefix.
 *   3. Intercept window.fetch to:
 *      a. Rewrite root-relative paths to /ow/... prefix.
 *      b. Filter /api/models responses to only show allowed_models for this team.
 *      c. Repair broken history.currentId in chat responses so OW renders
 *         correctly even when a prior stream interruption left an incomplete
 *         message object (missing required fields) as the current message.
 */
(function () {
  /* ── 1. Auth seed ───────────────────────────────────────────────────────── */
  var p = new URLSearchParams(window.location.search);
  var t = p.get("token");
  if (t) {
    localStorage.setItem("token", t);
    document.cookie = "ow_auth=" + t + "; path=/api/v1/; SameSite=Lax";
  }

  /* ── 2. History pushState/replaceState patch ────────────────────────────── */
  var _hp = history.pushState, _hr = history.replaceState;
  function _owfix(url) {
    return url && typeof url === "string" && url.charAt(0) === "/" && url.indexOf("/ow") !== 0
      ? "/ow" + url : url;
  }
  history.pushState = function (s, title, url) { return _hp.call(this, s, title, _owfix(url)); };
  history.replaceState = function (s, title, url) { return _hr.call(this, s, title, _owfix(url)); };

  /* ── 3. fetch interceptor ───────────────────────────────────────────────── */
  var am = p.get("allowed_models");
  var allowed = am ? am.split(",") : null;

  /**
   * A chat history message is "complete" when it has all fields OW requires to
   * render it: role (user/assistant), id (UUID), parentId (null or UUID), and
   * childrenIds (array, even if empty). A message missing any of these was
   * written by OW during an interrupted stream and must not be used as
   * history.currentId or OW will hang on "Loading..." indefinitely.
   */
  function _isCompleteMsg(m) {
    return (
      m !== null && m !== undefined &&
      typeof m.role === "string" &&
      typeof m.id === "string" &&
      Array.isArray(m.childrenIds) &&
      "parentId" in m &&
      !(m.role === "assistant" && !m.content)
    );
  }

  var _f = window.fetch;
  window.fetch = function (u, o) {
    /* Capture original URL for pattern-matching BEFORE rewriting */
    var url = typeof u === "string" ? u : (u instanceof Request ? u.url : "");

    /* 3a. Rewrite root-relative string URLs to /ow/... */
    if (typeof u === "string") {
      try {
        var _pu = new URL(u, window.location.origin);
        if (_pu.origin === window.location.origin && _pu.pathname.indexOf("/ow/") !== 0)
          u = "/ow" + _pu.pathname + _pu.search + _pu.hash;
      } catch (e) {}
    }

    /* 3a. Rewrite Request objects */
    if (u instanceof Request) {
      try {
        var _rp = new URL(u.url, window.location.origin);
        if (_rp.origin === window.location.origin && _rp.pathname.indexOf("/ow/") !== 0)
          u = new Request("/ow" + _rp.pathname + _rp.search + _rp.hash, u);
      } catch (e) {}
    }

    var res = _f.call(this, u, o);

    /* 3b. Filter model list to allowed_models for this team */
    if (allowed && (url.indexOf("/api/models") !== -1 || url.indexOf("/ow/api/models") !== -1)) {
      return res.then(function (r) {
        return r.clone().json().then(function (d) {
          if (d && d.data)
            d.data = d.data.filter(function (m) { return allowed.indexOf(m.id) !== -1; });
          return new Response(JSON.stringify(d), { status: r.status, statusText: r.statusText, headers: r.headers });
        });
      });
    }

    /* 3c. Repair broken history.currentId in single-chat fetch responses.
     *
     * Matches /api/v1/chats/{uuid} (exact, no trailing path segment) so that
     * list endpoints (/chats/?page=1) and sub-resources (/chats/{id}/tags) are
     * not intercepted.
     */
    var _chatRe = /\/api\/v1\/chats\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (_chatRe.test(url)) {
      return res.then(function (r) {
        if (!r.ok) return r;
        return r.clone().json().then(function (d) {
          try {
            var chat = d && d.chat;
            if (!chat) return new Response(JSON.stringify(d), { status: r.status, headers: { "Content-Type": "application/json" } });

            var hist = chat.history || {};
            var cur = hist.currentId;
            var hmsg = hist.messages || {};

            if (cur && !_isCompleteMsg(hmsg[cur])) {
              /* Walk the flat messages array backwards to find the last
               * complete message that also exists in history.messages. */
              var msgs = chat.messages || [];
              var lastGood = null;
              for (var i = msgs.length - 1; i >= 0; i--) {
                if (_isCompleteMsg(msgs[i]) && hmsg[msgs[i].id]) {
                  lastGood = msgs[i].id;
                  break;
                }
              }
              if (lastGood) {
                d = JSON.parse(JSON.stringify(d));
                d.chat.history.currentId = lastGood;
              }
            }
          } catch (e) { /* never block rendering */ }
          return new Response(JSON.stringify(d), { status: r.status, headers: { "Content-Type": "application/json" } });
        }).catch(function () { return r; });
      });
    }

    return res;
  };
})();
