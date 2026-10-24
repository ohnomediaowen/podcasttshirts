/* PodcastTShirts.com: applies saved shop edits for every visitor, and provides edit mode at ?edit */
(function () {
  var IMG_RE = /^(img\/[\w.-]+|\/api\/image\/[a-z0-9-]+(\?v=\d+)?)$/;
  var COLOR_RE = /^#[0-9a-f]{3,8}$/i;
  var ID_RE = /^[a-z0-9-]{1,60}$/;
  var ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  var SHOW_STR = ["name", "title", "intro", "copyright"];
  var SHOW_IMG = ["thumb", "logo", "headerLogo"];
  var PROD_STR = ["name", "short", "choice", "desc", "note", "badge", "hint", "cta", "alt"];
  var ORIGINAL = JSON.parse(JSON.stringify({ site: window.SITE, shows: window.SHOWS }));
  var saved = { site: {}, shows: {} };

  var str = function (v, max) { return typeof v === "string" ? v.slice(0, max || 3000) : undefined; };
  var num = function (v) { var n = Number(v); return isFinite(n) && n >= 0 && n < 10000 ? Math.round(n * 100) / 100 : undefined; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function colors(o) {
    var out = {};
    if (o && typeof o === "object") Object.keys(o).forEach(function (k) { if (/^[a-zA-Z]{1,12}$/.test(k) && typeof o[k] === "string" && COLOR_RE.test(o[k])) out[k] = o[k]; });
    return out;
  }

  function cleanProduct(p, base) {
    if (!p || typeof p !== "object" || !ID_RE.test(p.id || "")) return null;
    var out = clone(base || {});
    out.id = p.id;
    PROD_STR.forEach(function (k) { if (k in p) { var v = str(p[k]); if (v === undefined) return; if (v.trim() === "") delete out[k]; else out[k] = v; } });
    if ("price" in p) { var n = num(p.price); if (n !== undefined) out.price = n; }
    if ("maxQty" in p) { var q = num(p.maxQty); if (q) out.maxQty = Math.max(1, Math.min(20, Math.round(q))); }
    if (Array.isArray(p.sizes)) {
      var s = ALL_SIZES.filter(function (z) { return p.sizes.indexOf(z) >= 0; });
      if (s.length) { out.sizes = s; if (s.indexOf(out.def) < 0) out.def = s.indexOf("M") >= 0 ? "M" : s[0]; }
    }
    if (Array.isArray(p.images)) { var im = p.images.filter(function (x) { return typeof x === "string" && IMG_RE.test(x); }); if (im.length) out.images = im; }
    if (typeof p.swatch === "string" && COLOR_RE.test(p.swatch)) out.swatch = p.swatch;
    if (p.card) out.card = colors(p.card);
    if (p.badgeStyle) out.badgeStyle = colors(p.badgeStyle);
    if (!out.name || !Array.isArray(out.sizes) || !out.sizes.length || !Array.isArray(out.images) || !out.images.length || typeof out.price !== "number") return null;
    if (!out.maxQty) out.maxQty = 5;
    return out;
  }

  function apply(c) {
    if (c.site && typeof c.site === "object") {
      var pn = str(c.site.podNote); if (pn) window.SITE.podNote = pn;
      var ce = str(c.site.contactEmail, 200); if (ce && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ce)) window.SITE.contactEmail = ce;
    }
    var shows = (c.shows && typeof c.shows === "object") ? c.shows : {};
    window.SHOWS.forEach(function (show, i) {
      var o = shows[show.id];
      if (!o || typeof o !== "object") return;
      SHOW_STR.forEach(function (k) { var v = str(o[k]); if (v && v.trim()) show[k] = v; });
      var sh = num(o.shipping); if (sh !== undefined) show.shipping = sh;
      SHOW_IMG.forEach(function (k) { if (typeof o[k] === "string" && IMG_RE.test(o[k])) show[k] = o[k]; });
      if (o.pickup && typeof o.pickup === "object" && show.pickup) {
        var pl = str(o.pickup.label), pno = str(o.pickup.note);
        if (pl && pl.trim()) show.pickup.label = pl; if (pno && pno.trim()) show.pickup.note = pno;
      }
      if (Array.isArray(o.products) && !show.comingSoon) {
        var orig = {}; ORIGINAL.shows[i].products.forEach(function (p) { orig[p.id] = p; });
        var seen = {};
        var list = o.products.map(function (p) {
          var base = orig[p && p.id] || (p && p.copyOf && orig[p.copyOf]) || null;
          var cp = cleanProduct(p, base); if (!cp || seen[cp.id]) return null; seen[cp.id] = 1; return cp;
        }).filter(Boolean).slice(0, 24);
        if (list.length) show.products = list;
      }
    });
  }

  var started = false;
  function start() { if (started) return; started = true; window.__startShop(); if (editMode) bootEditor(); }
  var editMode = /[?&]edit\b/.test(location.search);
  fetch("/api/content", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (c) { saved = { site: c.site || {}, shows: c.shows || {} }; try { apply(saved); } catch (e) { console.error(e); } })
    .catch(function () {})
    .then(start);
  setTimeout(start, 2500);

  /* ---------------- edit mode ---------------- */
  var pw = "";
  function api(path, opts) {
    opts = opts || {};
    var h = opts.headers || {}; h["x-edit-password"] = pw; opts.headers = h;
    return fetch(path, opts);
  }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  function injectCss() {
    var css = "" +
      ".pe-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:8px;align-items:center;background:#141414;color:#f4f1eb;padding:8px 8px 8px 16px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:600 14px/1.2 Archivo,system-ui,sans-serif;white-space:nowrap}" +
      ".pe-bar button,.pe-drawer button{font:inherit;border:0;border-radius:999px;padding:9px 15px;cursor:pointer;background:#f4f1eb;color:#141414}" +
      ".pe-bar button.go,.pe-drawer button.go{background:#d9531e;color:#fff}" +
      ".pe-drawer{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);z-index:10000;background:#fbfaf7;color:#141414;box-shadow:-10px 0 40px rgba(0,0,0,.3);display:flex;flex-direction:column;font:400 15px/1.45 Archivo,system-ui,sans-serif}" +
      ".pe-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #ddd}.pe-head h2{font:800 18px Archivo,sans-serif;margin:0}" +
      ".pe-body{overflow:auto;padding:16px 18px 30px;flex:1}.pe-foot{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:12px 18px;border-top:1px solid #ddd;background:#fff}" +
      ".pe-body label{display:block;font-weight:700;font-size:13px;margin:12px 0 4px}.pe-body input[type=text],.pe-body input[type=number],.pe-body input[type=email],.pe-body textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border:1.5px solid #bbb;border-radius:8px;background:#fff;color:#141414}" +
      ".pe-body textarea{min-height:70px;resize:vertical}.pe-body .help{font-size:12.5px;color:#666;margin:3px 0 0}.pe-body h3{font:800 15px Archivo,sans-serif;margin:22px 0 4px;text-transform:uppercase;letter-spacing:.06em;color:#d9531e}" +
      ".pe-body details{border:1.5px solid #ccc;border-radius:12px;margin:10px 0;background:#fff}.pe-body summary{cursor:pointer;padding:10px 12px;font-weight:700;display:flex;gap:10px;align-items:center}" +
      ".pe-body summary img{width:38px;height:38px;object-fit:cover;border-radius:6px;border:1px solid #ddd}.pe-body details>div{padding:0 12px 12px}" +
      ".pe-sizes{display:flex;gap:6px;flex-wrap:wrap}.pe-sizes label{display:flex;gap:4px;align-items:center;margin:0;font-weight:600;border:1.5px solid #bbb;border-radius:8px;padding:5px 8px}" +
      ".pe-img{display:flex;gap:10px;align-items:center}.pe-img img{width:72px;height:72px;object-fit:contain;background:#eee;border-radius:8px;border:1px solid #ddd}" +
      ".pe-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.pe-row button{padding:6px 11px;font-size:13px;background:#eee}.pe-row button.danger{background:#fde4e1;color:#a3261b}" +
      ".pe-msg{font-size:13px;color:#555}.pe-modal{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px}" +
      ".pe-modal form{background:#fbfaf7;border-radius:18px;padding:26px;width:min(360px,100%);font-family:Archivo,sans-serif;color:#141414}.pe-modal h3{font:800 22px Archivo,sans-serif;margin:0 0 6px}" +
      ".pe-modal input{width:100%;box-sizing:border-box;font:500 16px Archivo,sans-serif;padding:11px 12px;border:2px solid #141414;border-radius:10px;margin:10px 0}.pe-modal button{width:100%;font:700 16px Archivo,sans-serif;padding:11px;border:0;border-radius:999px;background:#d9531e;color:#fff;cursor:pointer}" +
      ".pe-modal .err{color:#a3261b;font-weight:700;font-size:14px;min-height:18px}";
    var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
  }

  function bootEditor() {
    injectCss();
    try { pw = sessionStorage.getItem("pts-pw") || ""; } catch (e) {}
    if (pw) api("/api/auth", { method: "POST" }).then(function (r) { r.ok ? showBar() : login(); }, function () { login(); });
    else login();
  }

  function login() {
    var m = el('<div class="pe-modal"><form><h3>Edit the shop</h3><p>Enter your password.</p><input type="password" autocomplete="current-password" placeholder="Password" required><div class="err"></div><button>Start editing</button></form></div>');
    document.body.appendChild(m);
    var input = m.querySelector("input"); input.focus();
    m.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault(); pw = input.value;
      api("/api/auth", { method: "POST" }).then(function (r) {
        if (r.ok) { try { sessionStorage.setItem("pts-pw", pw); } catch (x) {} m.remove(); showBar(); }
        else m.querySelector(".err").textContent = r.status === 429 ? "Too many tries. Wait a minute." : "That password didn't work.";
      }, function () { m.querySelector(".err").textContent = "Couldn't reach the server."; });
    });
  }

  function showBar() {
    var bar = el('<div class="pe-bar"><span>✏️ Edit mode</span><button class="go" data-a="edit">Edit this page</button><button data-a="exit">Exit</button></div>');
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var a = e.target.dataset.a;
      if (a === "edit") openDrawer();
      if (a === "exit") location.href = location.pathname + location.hash;
    });
  }

  function currentShow() {
    var id = (location.hash || "").slice(1);
    return window.SHOWS.filter(function (s) { return s.id === id; })[0] || null;
  }

  function field(label, key, value, type, help) {
    var input = type === "textarea"
      ? '<textarea data-k="' + key + '">' + esc(value) + "</textarea>"
      : '<input type="' + (type || "text") + '" data-k="' + key + '" value="' + esc(value) + '"' + (type === "number" ? ' step="0.01" min="0"' : "") + ">";
    return "<label>" + esc(label) + "</label>" + input + (help ? '<p class="help">' + esc(help) + "</p>" : "");
  }

  function openDrawer() {
    var old = document.querySelector(".pe-drawer"); if (old) old.remove();
    var show = currentShow();
    var draft, body;
    if (!show) {
      draft = { podNote: window.SITE.podNote, contactEmail: window.SITE.contactEmail };
      body = "<p>These settings appear on every show's page. To edit a show and its shirts, open its tab first, then click Edit this page.</p>" +
        field("Printing note (top banner)", "podNote", draft.podNote, "textarea") +
        field("Contact email", "contactEmail", draft.contactEmail, "email");
    } else if (show.comingSoon) {
      draft = null;
      body = "<p>This slot is a <strong>Coming soon</strong> placeholder, so there's nothing to edit yet. Ask Claude to turn it into a real show when you have its logo and shirts.</p>";
    } else {
      draft = clone(show);
      body = renderShowForm(draft);
    }
    var d = el('<div class="pe-drawer" role="dialog" aria-label="Edit page"><div class="pe-head"><h2>' + esc(show ? show.name : "Shop settings") + '</h2><button data-a="close">Close</button></div>' +
      '<div class="pe-body">' + body + '</div><div class="pe-foot"><span class="pe-msg"></span>' + (draft ? '<button class="go" data-a="save">Save changes</button>' : "") + "</div></div>");
    document.body.appendChild(d);
    var msg = d.querySelector(".pe-msg");

    function rerender() { d.querySelector(".pe-body").innerHTML = renderShowForm(draft); }

    d.addEventListener("input", function (e) {
      var k = e.target.dataset.k; if (!k || !draft) return;
      var path = k.split(".");
      var target = draft;
      if (path[0] === "p") { target = draft.products[+path[1]]; path = path.slice(2); }
      if (path[0] === "pickup") { target = draft.pickup; path = path.slice(1); }
      if (e.target.type === "checkbox") return;
      target[path[0]] = e.target.type === "number" ? e.target.value : e.target.value;
      msg.textContent = "Unsaved changes";
    });
    d.addEventListener("change", function (e) {
      if (e.target.dataset.size !== undefined && draft) {
        var p = draft.products[+e.target.dataset.pi];
        var set = ALL_SIZES.filter(function (z) { var cb = d.querySelector('[data-pi="' + e.target.dataset.pi + '"][data-size="' + z + '"]'); return cb && cb.checked; });
        if (!set.length) { e.target.checked = true; msg.textContent = "A shirt needs at least one size."; return; }
        p.sizes = set; msg.textContent = "Unsaved changes";
      }
    });
    d.addEventListener("click", function (e) {
      var a = e.target.dataset.a; if (!a) return;
      if (a === "close") { if (msg.textContent !== "Unsaved changes" || confirm("Close without saving your changes?")) d.remove(); return; }
      if (a === "save") return save();
      var i = +e.target.dataset.pi;
      if (a === "up" && i > 0) { var t = draft.products[i - 1]; draft.products[i - 1] = draft.products[i]; draft.products[i] = t; rerender(); msg.textContent = "Unsaved changes"; }
      if (a === "down" && i < draft.products.length - 1) { var t2 = draft.products[i + 1]; draft.products[i + 1] = draft.products[i]; draft.products[i] = t2; rerender(); msg.textContent = "Unsaved changes"; }
      if (a === "remove") {
        if (draft.products.length === 1) { msg.textContent = "A show needs at least one shirt."; return; }
        if (confirm("Remove “" + (draft.products[i].short || draft.products[i].name) + "” from the shop?")) { draft.products.splice(i, 1); rerender(); msg.textContent = "Unsaved changes"; }
      }
      if (a === "copy") {
        var src = draft.products[i], cp = clone(src);
        cp.copyOf = ORIGINAL.shows.some(function (s) { return s.products.some(function (p) { return p.id === src.id; }); }) ? src.id : src.copyOf;
        cp.id = (src.id.replace(/-copy-[a-z0-9]+$/, "") + "-copy-" + Math.random().toString(36).slice(2, 6)).slice(0, 60);
        cp.name = "New shirt"; cp.short = "New shirt"; cp.choice = "New shirt"; delete cp.badge; delete cp.note; delete cp.hint;
        draft.products.splice(i + 1, 0, cp); rerender(); msg.textContent = "New shirt added below. Give it a name and photo, then save.";
        var det = d.querySelectorAll("details")[i + 1]; if (det) { det.open = true; det.scrollIntoView({ block: "start" }); }
      }
      if (a === "img") pickImage(e.target.dataset.target, e.target.dataset.pi);
    });

    function pickImage(target, pi) {
      var f = document.createElement("input"); f.type = "file"; f.accept = "image/png,image/jpeg,image/webp,image/gif";
      f.onchange = function () {
        var file = f.files[0]; if (!file) return;
        if (file.size > 4 * 1024 * 1024) { msg.textContent = "Image must be under 4 MB."; return; }
        msg.textContent = "Uploading…";
        var key = (draft.id + "-" + (target === "product" ? draft.products[+pi].id : target) + "-" + Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
        api("/api/upload/" + key, { method: "PUT", headers: { "content-type": file.type }, body: file })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok || !res.j.url) { msg.textContent = res.j.error || "Upload failed."; return; }
            if (target === "product") draft.products[+pi].images = [res.j.url]; else draft[target] = res.j.url;
            rerender(); msg.textContent = "Photo uploaded. Click Save changes to keep it.";
          }, function () { msg.textContent = "Upload failed."; });
      };
      f.click();
    }

    function save() {
      var btn = d.querySelector('[data-a="save"]'); btn.disabled = true; msg.textContent = "Saving…";
      var next = { site: clone(saved.site || {}), shows: clone(saved.shows || {}) };
      if (!show) {
        next.site.podNote = draft.podNote; next.site.contactEmail = draft.contactEmail;
      } else {
        var o = {};
        SHOW_STR.forEach(function (k) { o[k] = draft[k]; });
        o.shipping = draft.shipping;
        SHOW_IMG.forEach(function (k) { if (draft[k]) o[k] = draft[k]; });
        if (draft.pickup) o.pickup = { label: draft.pickup.label, note: draft.pickup.note };
        o.products = draft.products.map(function (p) {
          var out = { id: p.id };
          if (p.copyOf) out.copyOf = p.copyOf;
          PROD_STR.forEach(function (k) { if (p[k] !== undefined) out[k] = p[k]; });
          out.price = p.price; out.maxQty = p.maxQty; out.sizes = p.sizes; out.images = p.images;
          if (p.swatch) out.swatch = p.swatch; if (p.card) out.card = p.card; if (p.badgeStyle) out.badgeStyle = p.badgeStyle;
          return out;
        });
        var bad = o.products.filter(function (p) { return !String(p.name || "").trim() || !(Number(p.price) >= 0) || String(p.price).trim() === ""; });
        if (bad.length) { msg.textContent = "Every shirt needs a name and a price."; btn.disabled = false; return; }
        next.shows[show.id] = o;
      }
      api("/api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) })
        .then(function (r) {
          if (r.status === 401) { try { sessionStorage.removeItem("pts-pw"); } catch (x) {} msg.textContent = "Password expired. Reload to log in again."; btn.disabled = false; return; }
          if (!r.ok) { msg.textContent = "Save failed. Try again."; btn.disabled = false; return; }
          msg.textContent = "Saved ✓ Reloading…";
          setTimeout(function () { location.reload(); }, 500);
        }, function () { msg.textContent = "Save failed. Check your connection."; btn.disabled = false; });
    }
  }

  function renderShowForm(s) {
    var h = "<h3>Show</h3>" +
      field("Name (tabs and tile)", "name", s.name) +
      field("Page title", "title", s.title) +
      field("Intro text", "intro", s.intro, "textarea") +
      field("Shipping price ($)", "shipping", s.shipping, "number") +
      (s.pickup ? field("Pickup option label", "pickup.label", s.pickup.label) + field("Pickup note", "pickup.note", s.pickup.note, "textarea") : "") +
      field("Footer name (© line)", "copyright", s.copyright);
    if (s.thumb || s.logo || s.headerLogo) {
      h += "<h3>Logos</h3>";
      [["thumb", "Tile image (home page)"], ["logo", "Tile logo (home page)"], ["headerLogo", "Header logo (this page)"]].forEach(function (x) {
        if (!s[x[0]]) return;
        h += "<label>" + x[1] + '</label><div class="pe-img"><img src="' + esc(s[x[0]]) + '" alt=""><button data-a="img" data-target="' + x[0] + '">Replace image</button></div>';
      });
    }
    h += '<h3>Shirts</h3><p class="help">Click a shirt to edit it. Use “Add a shirt like this” to create a new one.</p>';
    s.products.forEach(function (p, i) {
      h += '<details><summary><img src="' + esc(p.images[0]) + '" alt="">' + esc(p.short || p.name) + " · $" + esc(Number(p.price).toFixed(2)) + "</summary><div>" +
        '<div class="pe-img" style="margin-top:8px"><img src="' + esc(p.images[0]) + '" alt=""><button data-a="img" data-target="product" data-pi="' + i + '">Replace photo</button></div>' +
        field("Full name (order details)", "p." + i + ".name", p.name) +
        field("Card name (short)", "p." + i + ".short", p.short || "") +
        field("Order-form label", "p." + i + ".choice", p.choice || "") +
        field("Description", "p." + i + ".desc", p.desc, "textarea") +
        field("Price ($)", "p." + i + ".price", p.price, "number") +
        "<label>Sizes</label><div class=\"pe-sizes\">" + ALL_SIZES.map(function (z) {
          return '<label><input type="checkbox" data-pi="' + i + '" data-size="' + z + '"' + (p.sizes.indexOf(z) >= 0 ? " checked" : "") + ">" + z + "</label>";
        }).join("") + "</div>" +
        field("Max per order", "p." + i + ".maxQty", p.maxQty || 5, "number") +
        field("Badge (optional)", "p." + i + ".badge", p.badge || "", "text", "Shows as a tag on the card, like “Limited edition” or “Pre-order”. Leave empty for none.") +
        field("Extra note (optional)", "p." + i + ".note", p.note || "", "textarea") +
        field("Button text", "p." + i + ".cta", p.cta || "") +
        field("Photo description (for screen readers)", "p." + i + ".alt", p.alt || "") +
        '<div class="pe-row"><button data-a="up" data-pi="' + i + '">↑ Move up</button><button data-a="down" data-pi="' + i + '">↓ Move down</button>' +
        '<button data-a="copy" data-pi="' + i + '">＋ Add a shirt like this</button><button class="danger" data-a="remove" data-pi="' + i + '">Remove</button></div>' +
        "</div></details>";
    });
    return h;
  }
})();
