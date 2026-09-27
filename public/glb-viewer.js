// <glb-viewer src="model.glb" label="What it is">fallback</glb-viewer>
//
// three.js viewer for a GLB: orbit, camera presets, explode, spin, fullscreen, and a parts list with hover labels
// and show/hide. Children of the tag are shown only if the viewer can't run.
//
// - Parts come from the GLB's scene extras, `viewer.parts = [{id, name, src, color}]`, each `id` naming
//   the node that holds that part's meshes. Without them, each top-level node is a part.
// - Colours come from the host page: --bg --panel --ink --dim --line --accent --accent-ink
//   --accent-soft --mono (the MakerSec theme tokens), with light defaults.
// - three.js and the model load when the viewer nears the screen; rendering pauses off screen.
// - The scroll wheel zooms only after a click on the model, so page scrolling passes through.

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0';
let three = null;
const loadThree = () =>
  (three ??= Promise.all([
    import(`${CDN}/+esm`),
    import(`${CDN}/examples/jsm/loaders/GLTFLoader.js/+esm`),
    import(`${CDN}/examples/jsm/controls/OrbitControls.js/+esm`),
  ]));

// Camera directions (Y up, model front facing +Z); the distance comes from the model's size.
const VIEWS = {
  '3/4': [-420, 260, 520],
  Front: [0, 60, 700],
  Side: [-700, 60, 0],
  Top: [0, 720, 1],
  Rear: [380, 220, -560],
};

const EYE_ON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const EYE_OFF =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 2l12 12M6.3 4c.5-.2 1.1-.3 1.7-.3 4.1 0 6.5 4.3 6.5 4.3s-.7 1.3-2 2.5M10 11.9c-.6.4-1.3.6-2 .6-4.1 0-6.5-4.5-6.5-4.5s.8-1.5 2.3-2.8"/></svg>';

const CSS = `
:host { display: block; margin-block: 1.5em; color: var(--ink, #1c1a2b); font-size: 14px; line-height: 1.45; }
:host(:fullscreen) { margin: 0; background: var(--bg, #eeeef3); }
:host(:fullscreen) .stage { height: 100%; max-height: none; border: 0; border-radius: 0; }
:host(:fullscreen) .parts { display: none; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; color: inherit; background: none; border: 0; margin: 0; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--accent, #5a33c8); outline-offset: 2px; }

.stage {
  position: relative; width: 100%; aspect-ratio: var(--gv-aspect, 4 / 3); min-height: 300px; max-height: 75svh;
  overflow: hidden; border: 1px solid var(--line, #d8d7e2); border-radius: 10px;
  background: radial-gradient(120% 90% at 50% 35%, var(--panel, #f8f8fb), var(--bg, #eeeef3));
}
.view { position: absolute; inset: 0; touch-action: none; cursor: grab; }
.view:active { cursor: grabbing; }
canvas { display: block; width: 100%; height: 100%; }
.msg {
  position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center;
  color: var(--dim, #65627a); font: 12px var(--mono, ui-monospace, monospace);
}
.msg a { color: var(--accent, #5a33c8); }
.hint { position: absolute; top: 10px; inset-inline: 12px; font-size: 11px; color: var(--dim, #65627a); pointer-events: none; }
.tip {
  position: absolute; z-index: 1; max-width: 240px; padding: 6px 9px; pointer-events: none; font-size: 12px;
  background: var(--panel, #f8f8fb); border: 1px solid var(--line, #d8d7e2); border-radius: 6px;
  box-shadow: 0 4px 14px rgb(20 16 40 / 0.14);
}
.tip b { display: block; font-weight: 500; }
.tip span, small, .count { color: var(--dim, #65627a); font: 11px var(--mono, ui-monospace, monospace); }

.hud {
  position: absolute; inset-inline: 10px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px;
  align-items: center; justify-content: space-between;
}
.seg, .explode {
  display: flex; align-items: center; gap: 2px; padding: 3px;
  background: var(--panel, #f8f8fb); border: 1px solid var(--line, #d8d7e2); border-radius: 8px;
  font-size: 12px; font-weight: 500;
}
.explode { gap: 8px; padding-inline: 10px; margin-left: auto; }
.explode input { width: 90px; margin: 0; accent-color: var(--accent, #5a33c8); }
.seg button { padding: 5px 9px; border-radius: 6px; }
.seg button:hover { background: var(--accent-soft, #e4e3ee); }
.seg button[aria-pressed='true'] { background: var(--accent, #5a33c8); color: var(--accent-ink, #fff); }

.parts {
  list-style: none; margin: 12px 0 0; padding: 0;
  display: grid; gap: 2px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
}
.parts li {
  display: grid; grid-template-columns: 12px minmax(0, 1fr) auto 28px; gap: 8px; align-items: center;
  margin: 0; padding: 4px 6px; border-radius: 6px;
}
.parts li::before { content: none; }
.parts li.sel { background: var(--accent-soft, #e4e3ee); }
.parts li.off .name, .parts li.off .count { opacity: 0.4; }
.swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgb(0 0 0 / 0.15); }
.name { padding: 0; text-align: left; font-size: 13px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
small { display: block; overflow: hidden; text-overflow: ellipsis; }
.count { font-size: 12px; font-variant-numeric: tabular-nums; }
.eye { display: grid; place-items: center; width: 28px; height: 24px; border-radius: 5px; color: var(--dim, #65627a); }
.eye:hover { background: var(--accent-soft, #e4e3ee); color: var(--ink, #1c1a2b); }
.eye svg { width: 16px; height: 16px; }
`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

class GlbViewer extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>${CSS}</style>
      <section class="stage" role="group" aria-label="${esc(this.getAttribute('label') || '3D model')}">
        <div class="view"></div>
        <div class="msg">Loading 3D model…</div>
        <div class="hint" hidden>Drag to orbit · click, then scroll or pinch to zoom · tap a part</div>
        <div class="tip" hidden></div>
        <div class="hud" hidden>
          <div class="seg" role="group" aria-label="Camera view">${Object.keys(VIEWS)
            .map((v, i) => `<button type="button" data-view="${v}" aria-pressed="${i === 0}">${v}</button>`)
            .join('')}</div>
          <label class="explode">Explode <input type="range" min="0" max="100" value="0"></label>
          <div class="seg">
            <button type="button" class="spin">Spin</button>
            <button type="button" class="full" aria-pressed="false">Fullscreen</button>
          </div>
        </div>
      </section>
      <ul class="parts" aria-label="Parts"></ul>`;

    this.onScreen = false;
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.onScreen = entry.isIntersecting;
        if (this.onScreen && !this.started) {
          this.started = true;
          this.init().catch((err) => this.fail(err));
        }
      },
      { rootMargin: '300px 0px' },
    );
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.renderer?.setAnimationLoop(null);
    this.renderer?.dispose();
  }

  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  fail(err) {
    console.warn('glb-viewer:', err);
    const src = esc(this.getAttribute('src'));
    this.$('.msg').hidden = false;
    this.$('.msg').innerHTML =
      `<div>Couldn't show the 3D model here.<br><a href="${src}" download>Download the .glb</a></div>`;
  }

  async init() {
    const [THREE, { GLTFLoader }, { OrbitControls }] = await loadThree();
    const model = (await new GLTFLoader().loadAsync(this.getAttribute('src'))).scene;
    const scene = new THREE.Scene();
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    this.$('.view').append(canvas);

    // Centre the model on the origin; everything else scales with its radius r.
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const pivot = new THREE.Group();
    pivot.position.copy(centre).negate();
    pivot.add(model);
    scene.add(pivot);

    const s = r / 200; // lights were tuned on a model of radius ~200
    scene.add(new THREE.HemisphereLight(0xf3f1ff, 0x3a3548, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.3);
    key.position.set(-260 * s, 420 * s, 320 * s);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0006;
    Object.assign(key.shadow.camera, { left: -1.35 * r, right: 1.35 * r, top: 1.35 * r, bottom: -1.35 * r });
    Object.assign(key.shadow.camera, { near: r / 4, far: r * 6 });
    const fill = new THREE.DirectionalLight(0xdcd6ff, 1.1);
    fill.position.set(300 * s, 120 * s, -260 * s);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 8, r * 8),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = box.min.y - centre.y - r * 0.001;
    floor.receiveShadow = true;
    scene.add(key, fill, floor);

    // Parts: named in the file's metadata, else every top-level node.
    const groups =
      model.userData.viewer?.parts ??
      model.children.map((node, i) => ({ node, name: node.name || `Part ${i + 1}` }));
    const parts = groups
      .map((g) => {
        const part = { ...g, meshes: [] };
        (g.node ?? model.getObjectByName(g.id))?.traverse((o) => o.isMesh && part.meshes.push(o));
        return part;
      })
      .filter((part) => part.meshes.length);
    const meshes = [];
    parts.forEach((part, i) => {
      part.color ??= `#${part.meshes[0].material.color.getHexString()}`;
      for (const m of part.meshes) {
        m.material = m.material.clone(); // so one part can be highlighted on its own
        m.material.emissiveIntensity = 0.55;
        m.castShadow = m.receiveShadow = true;
        m.userData.part = i;
        meshes.push(m);
      }
    });

    // Explode: each mesh moves away from the model centre (vertical a bit more), in its parent's frame.
    const at = new THREE.Vector3();
    for (const m of meshes) {
      new THREE.Box3().setFromObject(m).getCenter(at);
      const away = at
        .clone()
        .sub(centre)
        .multiply(new THREE.Vector3(1, 1.25, 1))
        .add(at);
      m.userData.base = m.position.clone();
      m.userData.dir = m.parent.worldToLocal(away).sub(m.parent.worldToLocal(at.clone()));
    }
    this.$('.explode input').oninput = (e) => {
      const k = (e.target.value / 100) * 0.85;
      for (const m of meshes) m.position.copy(m.userData.base).addScaledVector(m.userData.dir, k);
    };

    // Camera and controls
    const camera = new THREE.PerspectiveCamera(32, 1, r / 40, r * 25);
    const controls = new OrbitControls(camera, canvas);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, autoRotateSpeed: 1.1 });
    Object.assign(controls, { minDistance: r * 1.1, maxDistance: r * 7, enableZoom: false });
    const distance = r / Math.sin(THREE.MathUtils.degToRad(16)); // fills the 32 deg field of view
    const viewAt = (name) => new THREE.Vector3(...VIEWS[name]).setLength(distance);
    camera.position.copy(viewAt('3/4'));
    canvas.addEventListener('pointerdown', () => {
      controls.enableZoom = true;
    });
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') controls.enableZoom = false;
    });

    let tween = null;
    for (const button of this.shadowRoot.querySelectorAll('[data-view]')) {
      button.onclick = () => {
        for (const b of this.shadowRoot.querySelectorAll('[data-view]'))
          b.setAttribute('aria-pressed', b === button);
        const from = camera.position.clone();
        const to = viewAt(button.dataset.view);
        const t0 = performance.now();
        tween = (t) => {
          const u = reducedMotion() ? 1 : Math.min(1, (t - t0) / 650);
          camera.position.lerpVectors(from, to, 1 - (1 - u) ** 3);
          if (u === 1) tween = null;
        };
      };
    }
    controls.addEventListener('start', () => {
      tween = null;
      this.$('.hint').hidden = true;
    });

    const spin = this.$('.spin');
    const setSpin = (on) => {
      controls.autoRotate = on;
      spin.setAttribute('aria-pressed', on);
    };
    setSpin(!reducedMotion());
    spin.onclick = () => setSpin(!controls.autoRotate);

    // Parts list: click to highlight, eye to show/hide
    let selected = null;
    const select = (i) => {
      selected = i;
      parts.forEach((part, j) => {
        part.row.classList.toggle('sel', i === j);
        for (const m of part.meshes) m.material.emissive.setHex(i === j ? 0x3a2a7a : 0);
      });
    };
    parts.forEach((part, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="swatch" style="background:${esc(part.color)}"></span>
        <button class="name" type="button">${esc(part.name)}${part.src ? `<small>${esc(part.src)}</small>` : ''}</button>
        <span class="count">×${part.meshes.length}</span>
        <button class="eye" type="button" aria-pressed="true" aria-label="Hide ${esc(part.name)}">${EYE_ON}</button>`;
      li.querySelector('.name').onclick = () => select(selected === i ? null : i);
      const eye = li.querySelector('.eye');
      eye.onclick = () => {
        const on = eye.getAttribute('aria-pressed') !== 'true';
        eye.setAttribute('aria-pressed', on);
        eye.setAttribute('aria-label', `${on ? 'Hide' : 'Show'} ${part.name}`);
        eye.innerHTML = on ? EYE_ON : EYE_OFF;
        li.classList.toggle('off', !on);
        for (const m of part.meshes) m.visible = on;
      };
      this.$('.parts').append(li);
      part.row = li;
    });

    // Hover label (mouse) and tap to select
    const ray = new THREE.Raycaster();
    const tip = this.$('.tip');
    const pick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ray.setFromCamera(new THREE.Vector2((x / rect.width) * 2 - 1, 1 - (y / rect.height) * 2), camera);
      const hit = ray.intersectObjects(
        meshes.filter((m) => m.visible),
        false,
      )[0];
      return (
        hit && { part: parts[hit.object.userData.part], index: hit.object.userData.part, x, y, w: rect.width }
      );
    };
    const showTip = (hit) => {
      tip.hidden = !hit;
      if (!hit) return;
      tip.innerHTML = `<b>${esc(hit.part.name)}</b><span>${hit.part.src ? `${esc(hit.part.src)} · ` : ''}×${hit.part.meshes.length}</span>`;
      tip.style.left = `${Math.max(4, Math.min(hit.x + 14, hit.w - 250))}px`;
      tip.style.top = `${hit.y + 14}px`;
    };
    let down = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = [e.clientX, e.clientY];
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && !e.buttons) showTip(pick(e));
    });
    canvas.addEventListener('pointerleave', () => showTip(null));
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; // a drag, not a tap
      const hit = pick(e);
      select(hit ? hit.index : null);
      showTip(hit);
    });

    new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = this.$('.view');
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 44 : 32;
      camera.updateProjectionMatrix();
    }).observe(this.$('.view'));

    const full = this.$('.full');
    full.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : this.requestFullscreen());
    document.addEventListener('fullscreenchange', () =>
      full.setAttribute('aria-pressed', document.fullscreenElement === this),
    );

    // The page can show the rest of the metadata (title, notes, ...).
    this.dispatchEvent(new CustomEvent('model-load', { detail: model.userData.viewer ?? {} }));
    this.$('.msg').hidden = true;
    this.$('.hud').hidden = this.$('.hint').hidden = false;
    renderer.setAnimationLoop((t) => {
      if (!this.onScreen) return;
      tween?.(t);
      controls.update();
      renderer.render(scene, camera);
    });
  }
}

customElements.get('glb-viewer') || customElements.define('glb-viewer', GlbViewer);
