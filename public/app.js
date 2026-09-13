/* makersec — small, dependency-free page behaviour */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem('makersec-theme', theme); } catch (e) { /* private mode */ }
    var label = document.querySelector('.theme-label');
    if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
  }

  (function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('makersec-theme'); } catch (e) { /* ignore */ }
    if (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) stored = 'light';
    applyTheme(stored || 'dark');
  })();

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------- index filtering ---------- */
  var input = document.getElementById('filter');
  var feed = document.getElementById('feed');
  var noResults = document.querySelector('.no-results');
  var activeTags = new Set();

  function applyFilter() {
    if (!feed) return;
    var q = (input && input.value || '').trim().toLowerCase();
    var cards = feed.querySelectorAll('.card');
    var shown = 0;
    cards.forEach(function (card) {
      var haystack = card.dataset.search || '';
      var tags = (card.dataset.tags || '').split(' ');
      var matchText = !q || haystack.indexOf(q) !== -1;
      var matchTags = true;
      activeTags.forEach(function (t) { if (tags.indexOf(t) === -1) matchTags = false; });
      var show = matchText && matchTags;
      card.hidden = !show;
      if (show) shown++;
    });
    if (noResults) noResults.hidden = shown !== 0 || cards.length === 0;
  }

  if (input) {
    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; applyFilter(); input.blur(); }
    });
  }

  document.addEventListener('click', function (e) {
    var chip = e.target.closest('.tag-filter .chip');
    if (chip) {
      e.preventDefault();
      var tag = chip.dataset.tag;
      if (activeTags.has(tag)) { activeTags.delete(tag); chip.setAttribute('aria-pressed', 'false'); }
      else { activeTags.add(tag); chip.setAttribute('aria-pressed', 'true'); }
      applyFilter();
      return;
    }
    if (e.target.closest('[data-clear]')) {
      activeTags.clear();
      document.querySelectorAll('.tag-filter .chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      if (input) input.value = '';
      applyFilter();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && input && document.activeElement !== input && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  /* ---------- copy buttons on code blocks ---------- */
  document.querySelectorAll('.prose pre').forEach(function (pre) {
    if (pre.closest('.diagram')) return;
    var wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'copy';
    btn.addEventListener('click', function () {
      var text = pre.innerText;
      var done = function () {
        btn.textContent = 'copied';
        setTimeout(function () { btn.textContent = 'copy'; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { btn.textContent = 'failed'; });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = 'failed'; }
        document.body.removeChild(ta);
      }
    });
    wrap.appendChild(btn);
  });

  /* ---------- table of contents ---------- */
  var toc = document.getElementById('toc');
  if (toc) {
    var headings = document.querySelectorAll('.prose h2[id], .prose h3[id], .prose h4[id]');
    if (headings.length >= 3) {
      headings.forEach(function (h) {
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.className = 'lvl-' + h.tagName[1];
        a.textContent = h.textContent.replace(/#$/, '').trim();
        toc.appendChild(a);
      });
      var block = toc.closest('.toc-block');
      if (block) block.hidden = false;

      if ('IntersectionObserver' in window) {
        var links = {};
        toc.querySelectorAll('a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var link = links[entry.target.id];
            if (!link) return;
            if (entry.isIntersecting) {
              toc.querySelectorAll('a.on').forEach(function (a) { a.classList.remove('on'); });
              link.classList.add('on');
            }
          });
        }, { rootMargin: '-80px 0px -70% 0px' });
        headings.forEach(function (h) { observer.observe(h); });
      }
    }
  }

  /* ---------- mermaid, only if the page actually has a diagram ---------- */
  if (document.querySelector('pre.mermaid')) {
    var script = document.createElement('script');
    script.type = 'module';
    script.textContent = [
      "import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';",
      "mermaid.initialize({ startOnLoad: true, theme: document.documentElement.dataset.theme === 'light' ? 'neutral' : 'dark', fontFamily: 'ui-monospace, monospace' });",
    ].join('\n');
    document.body.appendChild(script);
  }
})();
