/* makersec — small, dependency-free page behaviour */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem('makersec-theme', theme); } catch (e) { /* private mode */ }
    var label = document.querySelector('.theme-label');
    if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
    document.dispatchEvent(new CustomEvent('makersec:theme', { detail: theme }));
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

  /* ---------- mermaid diagrams, styled after Whimsical ---------- */
  // Soft pastel boxes, grey curved connectors, tinted containers. Authors can colour a
  // node with a palette class, e.g.  wyse("Dell Wyse"):::blue
  var PALETTE = {
    light: {
      blue:   ['#e3f0ff', '#9cc3f5', '#1d3b5c'],
      green:  ['#e2f6ea', '#93d6ae', '#1b4a31'],
      yellow: ['#fff5d6', '#f0cf73', '#5a4410'],
      pink:   ['#fde7ef', '#f2a7c0', '#5e2138'],
      purple: ['#eee8fd', '#bda9f2', '#35246a'],
      gray:   ['#f1f3f5', '#cdd3da', '#2f3740'],
    },
    dark: {
      blue:   ['#13263b', '#4a82c0', '#d3e6ff'],
      green:  ['#122a1f', '#469d70', '#c9f1db'],
      yellow: ['#2b2412', '#b8963e', '#f7e6b4'],
      pink:   ['#2e1621', '#bb5d80', '#f9d3e1'],
      purple: ['#1f1936', '#8270cc', '#e1d9ff'],
      gray:   ['#161d26', '#3d4a59', '#d6dee8'],
    },
  };

  function mermaidConfig(theme) {
    var dark = theme === 'dark';
    return {
      startOnLoad: false,
      theme: 'base',
      look: 'classic',
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      themeVariables: {
        fontSize: '15px',
        background: 'transparent',
        primaryColor: dark ? '#161d26' : '#ffffff',
        primaryBorderColor: dark ? '#3d4a59' : '#d5dbe2',
        primaryTextColor: dark ? '#dce6f0' : '#1f2933',
        secondaryColor: dark ? '#13263b' : '#e3f0ff',
        tertiaryColor: dark ? '#122a1f' : '#e2f6ea',
        lineColor: dark ? '#5d6d80' : '#a3adb8',
        textColor: dark ? '#aab6c3' : '#3e4c59',
        clusterBkg: dark ? 'rgba(148, 170, 200, 0.05)' : 'rgba(241, 244, 248, 0.85)',
        clusterBorder: dark ? '#243140' : '#dfe4ea',
        titleColor: dark ? '#95a4b6' : '#52606d',
        edgeLabelBackground: dark ? '#0f151d' : '#ffffff',
        nodeBorder: dark ? '#3d4a59' : '#d5dbe2',
        mainBkg: dark ? '#161d26' : '#ffffff',
      },
      flowchart: { curve: 'basis', padding: 18, nodeSpacing: 46, rankSpacing: 58, htmlLabels: true, diagramPadding: 12, subGraphTitleMargin: { top: 8, bottom: 16 } },
      sequence: { actorMargin: 60, boxMargin: 12, mirrorActors: false },
    };
  }

  function withPalette(src, theme) {
    if (!/^\s*(flowchart|graph)\b/.test(src)) return src;
    var defs = Object.keys(PALETTE[theme]).map(function (name) {
      var c = PALETTE[theme][name];
      return '  classDef ' + name + ' fill:' + c[0] + ',stroke:' + c[1] + ',color:' + c[2] + ',stroke-width:1.5px';
    });
    return src.replace(/\s*$/, '') + '\n' + defs.join('\n') + '\n';
  }

  // Mermaid centres group titles on the top edge, right where arrows enter. Whimsical
  // pins them to the top-left corner instead.
  function pinClusterTitles(pre) {
    Array.prototype.forEach.call(pre.querySelectorAll('g.cluster'), function (group) {
      var rect = group.querySelector('rect');
      var label = group.querySelector('.cluster-label');
      if (!rect || !label) return;
      var x = parseFloat(rect.getAttribute('x'));
      var y = parseFloat(rect.getAttribute('y'));
      if (isNaN(x) || isNaN(y)) return;
      label.setAttribute('transform', 'translate(' + (x + 14) + ', ' + (y + 9) + ')');
    });
  }

  var diagrams = Array.prototype.slice.call(document.querySelectorAll('pre.mermaid'));
  if (diagrams.length) {
    diagrams.forEach(function (pre) {
      pre.dataset.source = pre.textContent;
      pre.parentNode.classList.add('diagram-pending');
    });

    var mermaidLib = null;
    var renderSeq = 0;

    var render = function () {
      if (!mermaidLib) return;
      var theme = root.dataset.theme === 'light' ? 'light' : 'dark';
      var seq = ++renderSeq;
      mermaidLib.initialize(mermaidConfig(theme));
      diagrams.forEach(function (pre) {
        pre.removeAttribute('data-processed');
        pre.textContent = withPalette(pre.dataset.source, theme);
      });
      mermaidLib.run({ nodes: diagrams }).catch(function (err) {
        console.warn('mermaid failed', err);
      }).then(function () {
        if (seq !== renderSeq) return;
        diagrams.forEach(function (pre) {
          pinClusterTitles(pre);
          pre.parentNode.classList.remove('diagram-pending');
        });
      });
    };

    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
      .then(function (mod) { mermaidLib = mod.default; render(); })
      .catch(function () {
        // Offline or blocked CDN: show the diagram source instead of an empty box.
        diagrams.forEach(function (pre) { pre.parentNode.classList.remove('diagram-pending'); });
      });

    document.addEventListener('makersec:theme', render);
  }
})();
