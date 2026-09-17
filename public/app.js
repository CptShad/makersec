/* makersec — small, dependency-free page behaviour */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- look: dark/light scheme and visual theme ---------- */
  // The inline script in <head> applies stored choices before first paint; this only
  // keeps the controls in step and saves changes.
  try {
    // Before themes existed, 'makersec-theme' held the scheme.
    var legacy = localStorage.getItem('makersec-theme');
    if (legacy === 'dark' || legacy === 'light') {
      if (!localStorage.getItem('makersec-scheme')) localStorage.setItem('makersec-scheme', legacy);
      localStorage.removeItem('makersec-theme');
    }
  } catch (e) { /* storage unavailable */ }

  var schemeLabel = document.querySelector('.theme-label');
  var picker = document.querySelector('[data-theme-picker]');
  var pickBtn = picker && picker.querySelector('.theme-pick-btn');
  var menu = picker && picker.querySelector('[role="listbox"]');
  var options = menu ? Array.prototype.slice.call(menu.querySelectorAll('[role="option"]')) : [];
  var active = -1;

  function syncControls() {
    if (schemeLabel) schemeLabel.textContent = root.dataset.scheme === 'light' ? 'Light' : 'Dark';
    if (!picker) return;
    options.forEach(function (opt) {
      var on = opt.dataset.value === root.dataset.theme;
      opt.setAttribute('aria-selected', on ? 'true' : 'false');
      if (!on) return;
      var label = opt.textContent.trim();
      pickBtn.querySelector('.theme-pick-label').textContent = label;
      pickBtn.querySelector('.swatch').setAttribute('style', opt.querySelector('.swatch').getAttribute('style'));
      pickBtn.setAttribute('aria-label', 'Theme: ' + label);
    });
  }

  function setLook(key, value) {
    root.dataset[key] = value;
    try { localStorage.setItem('makersec-' + key, value); } catch (e) { /* private mode */ }
    syncControls();
    document.dispatchEvent(new CustomEvent('makersec:look'));
  }

  /* theme picker: a listbox opened from a button */
  function highlight(i) {
    active = (i + options.length) % options.length;
    options.forEach(function (opt, n) { opt.classList.toggle('active', n === active); });
    menu.setAttribute('aria-activedescendant', options[active].id);
  }

  function openMenu() {
    menu.hidden = false;
    pickBtn.setAttribute('aria-expanded', 'true');
    highlight(Math.max(0, options.findIndex(function (o) { return o.dataset.value === root.dataset.theme; })));
    menu.focus();
  }

  function closeMenu(refocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    pickBtn.setAttribute('aria-expanded', 'false');
    if (refocus) pickBtn.focus();
  }

  function choose(i) {
    setLook('theme', options[i].dataset.value);
    closeMenu(true);
  }

  syncControls();
  if (picker) {
    picker.hidden = false;

    pickBtn.addEventListener('click', function () {
      if (menu.hidden) openMenu(); else closeMenu(true);
    });
    pickBtn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(); }
    });

    menu.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); highlight(active + 1); break;
        case 'ArrowUp': e.preventDefault(); highlight(active - 1); break;
        case 'Home': e.preventDefault(); highlight(0); break;
        case 'End': e.preventDefault(); highlight(options.length - 1); break;
        case 'Enter':
        case ' ': e.preventDefault(); choose(active); break;
        case 'Escape': e.preventDefault(); closeMenu(true); break;
        case 'Tab': closeMenu(false); break;
      }
    });

    options.forEach(function (opt, i) {
      opt.addEventListener('mousemove', function () { if (i !== active) highlight(i); });
      opt.addEventListener('click', function () { choose(i); });
    });

    document.addEventListener('click', function (e) {
      if (!picker.contains(e.target)) closeMenu(false);
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-scheme-toggle]')) return;
    setLook('scheme', root.dataset.scheme === 'light' ? 'dark' : 'light');
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

  // Diagram colours come from the active theme's --diagram-* tokens in style.css.
  function token(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function mermaidConfig() {
    return {
      startOnLoad: false,
      theme: 'base',
      look: 'classic',
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      themeVariables: {
        fontSize: '15px',
        background: 'transparent',
        primaryColor: token('--diagram-node'),
        primaryBorderColor: token('--diagram-node-border'),
        primaryTextColor: token('--diagram-node-text'),
        secondaryColor: token('--diagram-secondary'),
        tertiaryColor: token('--diagram-tertiary'),
        lineColor: token('--diagram-line'),
        textColor: token('--diagram-text'),
        clusterBkg: token('--diagram-group'),
        clusterBorder: token('--diagram-group-border'),
        titleColor: token('--diagram-title'),
        edgeLabelBackground: token('--diagram-edge-label'),
        nodeBorder: token('--diagram-node-border'),
        mainBkg: token('--diagram-node'),
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
      var scheme = root.dataset.scheme === 'light' ? 'light' : 'dark';
      var seq = ++renderSeq;
      mermaidLib.initialize(mermaidConfig());
      diagrams.forEach(function (pre) {
        pre.removeAttribute('data-processed');
        pre.textContent = withPalette(pre.dataset.source, scheme);
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

    document.addEventListener('makersec:look', render);
  }
})();
