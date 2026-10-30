/* =========================================================
   Transport de palettes — script.js
   1. Fond animé "réseau routier"
   2. Palettes isométriques (SVG)
   3. Formulaire dynamique + récapitulatif
   4. UI : nav, révélations, compteurs, modale
   ========================================================= */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. BACKGROUND : réseau routier animé ---------- */
(function background() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, DPR, nodes = [], edges = [], pulses = [], glows = [];
  let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;

  // générateur pseudo-aléatoire déterministe (le réseau reste stable)
  function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

  function build() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';

    const rand = rng(42);
    const cols = Math.max(4, Math.round(innerWidth / 230));
    const rows = Math.max(3, Math.round(innerHeight / 210));
    const cw = (W * 1.2) / cols, ch = (H * 1.2) / rows;
    nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({
          x: -W * .1 + c * cw + cw * (.2 + rand() * .6),
          y: -H * .1 + r * ch + ch * (.2 + rand() * .6),
          big: rand() > .72,
          ph: rand() * Math.PI * 2
        });
      }
    }

    // relie chaque noeud à ses 2-3 plus proches voisins
    const seen = new Set();
    edges = [];
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
        .filter(o => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 2 + (rand() > .6 ? 1 : 0));
      near.forEach(({ j }) => {
        const key = i < j ? i + '-' + j : j + '-' + i;
        if (seen.has(key)) return;
        seen.add(key);
        const b = nodes[j];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const off = (rand() - .5) * len * .35;
        edges.push({ a, b, cx: mx - dy / len * off, cy: my + dx / len * off });
      });
    });

    pulses = [];
    const count = Math.round(edges.length * .35);
    for (let i = 0; i < count; i++) pulses.push(newPulse(rand));

    glows = [
      { x: W * .15, y: H * .2, r: W * .35, c: '255,150,50', s: .0003, o: 0 },
      { x: W * .85, y: H * .75, r: W * .4, c: '40,200,190', s: .0002, o: 2 },
      { x: W * .5, y: H * .5, r: W * .3, c: '90,120,230', s: .00025, o: 4 }
    ];
  }

  function newPulse(r = Math.random) {
    return {
      e: edges[Math.floor(r() * edges.length)],
      t: r(), speed: .0015 + r() * .003, dir: r() > .5 ? 1 : -1,
      warm: r() > .35
    };
  }

  function pt(e, t) {
    const u = 1 - t;
    return {
      x: u * u * e.a.x + 2 * u * t * e.cx + t * t * e.b.x,
      y: u * u * e.a.y + 2 * u * t * e.cy + t * t * e.b.y
    };
  }

  function frame(time) {
    mouse.x += (mouse.tx - mouse.x) * .04;
    mouse.y += (mouse.ty - mouse.y) * .04;

    ctx.clearRect(0, 0, W, H);

    // base : dégradé nuit
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fbfcfe');
    bg.addColorStop(.55, '#f4f6fb');
    bg.addColorStop(1, '#eaeef6');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // halos de couleur qui dérivent lentement
    glows.forEach(g => {
      const gx = g.x + Math.sin(time * g.s + g.o) * W * .06;
      const gy = g.y + Math.cos(time * g.s * 1.3 + g.o) * H * .06;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.r);
      grad.addColorStop(0, `rgba(${g.c},.16)`);
      grad.addColorStop(1, `rgba(${g.c},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    });

    // parallaxe (souris + défilement)
    const px = -mouse.x * 18 * DPR;
    const py = (-mouse.y * 12 - scrollY * .08) * DPR;
    ctx.save();
    ctx.translate(px, py);

    // grille de points
    const gap = 46 * DPR;
    ctx.fillStyle = 'rgba(40,65,120,.16)';
    const ox = ((px % gap) + gap) % gap - px, oy = ((py % gap) + gap) % gap - py;
    for (let x = -gap + ox - gap; x < W + gap + px * -1 + gap; x += gap) {
      for (let y = -gap + oy - gap; y < H + gap + py * -1 + gap; y += gap) {
        ctx.fillRect(x, y, 1.4 * DPR, 1.4 * DPR);
      }
    }

    // routes
    ctx.lineCap = 'round';
    edges.forEach(e => {
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.quadraticCurveTo(e.cx, e.cy, e.b.x, e.b.y);
      ctx.strokeStyle = 'rgba(60,90,150,.07)';
      ctx.lineWidth = 6 * DPR;
      ctx.stroke();
      ctx.setLineDash([10 * DPR, 14 * DPR]);
      ctx.strokeStyle = 'rgba(50,80,140,.25)';
      ctx.lineWidth = 1.2 * DPR;
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // villes (noeuds)
    nodes.forEach(n => {
      const p = .5 + .5 * Math.sin(time * .002 + n.ph);
      const r = (n.big ? 4.5 : 2.6) * DPR;
      if (n.big) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + (6 + p * 10) * DPR, 0, 7);
        ctx.strokeStyle = `rgba(240,130,20,${.45 - p * .35})`;
        ctx.lineWidth = 1 * DPR;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 7);
      ctx.fillStyle = n.big ? 'rgba(255,140,20,.95)' : 'rgba(60,85,135,.5)';
      ctx.shadowColor = n.big ? 'rgba(255,150,40,.7)' : 'transparent';
      ctx.shadowBlur = n.big ? 14 * DPR : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // camions : lumières qui voyagent
    pulses.forEach((p, i) => {
      p.t += p.speed * p.dir * (reduceMotion ? 0 : 1);
      if (p.t > 1 || p.t < 0) { pulses[i] = newPulse(); pulses[i].t = pulses[i].dir > 0 ? 0 : 1; return; }
      const col = p.warm ? '240,125,10' : '12,160,145';
      const tail = 16;
      for (let k = 0; k < tail; k++) {
        const tt = p.t - p.dir * k * .006;
        if (tt < 0 || tt > 1) break;
        const q = pt(p.e, tt);
        const a = (1 - k / tail);
        ctx.beginPath();
        ctx.arc(q.x, q.y, (2.6 - k * .12) * DPR, 0, 7);
        ctx.fillStyle = `rgba(${col},${a * .55})`;
        ctx.fill();
      }
      const h = pt(p.e, p.t);
      ctx.beginPath();
      ctx.arc(h.x, h.y, 3 * DPR, 0, 7);
      ctx.fillStyle = `rgb(${col})`;
      ctx.shadowColor = `rgb(${col})`;
      ctx.shadowBlur = 16 * DPR;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.restore();
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  addEventListener('resize', () => { build(); if (reduceMotion) frame(0); });
  addEventListener('mousemove', e => {
    mouse.tx = e.clientX / innerWidth - .5;
    mouse.ty = e.clientY / innerHeight - .5;
  });
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  build();
  requestAnimationFrame(frame);
})();

/* ---------- 2. PALETTES ISOMETRIQUES ---------- */
(function pallets() {
  const svg = document.getElementById('palletSvg');
  const K = 12, CX = 225, CY = 215;
  const P = (x, y, z) => [CX + (x - y) * .866 * K, CY + (x + y) * .5 * K - z * K];
  const poly = pts => pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');

  let out = '';
  function box(x, y, z, w, d, h, c, stroke = 'rgba(0,0,0,.28)') {
    const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
    out += `<polygon points="${poly(left)}" fill="${c[1]}" stroke="${stroke}" stroke-width=".8" stroke-linejoin="round"/>`;
    out += `<polygon points="${poly(right)}" fill="${c[2]}" stroke="${stroke}" stroke-width=".8" stroke-linejoin="round"/>`;
    out += `<polygon points="${poly(top)}" fill="${c[0]}" stroke="${stroke}" stroke-width=".8" stroke-linejoin="round"/>`;
  }

  const wood = ['#e3b57a', '#b98445', '#946a36'];
  const kraft = ['#dba868', '#b8803f', '#976530'];
  const navy = ['#4b5d82', '#2f3d5c', '#222d46'];
  const amber = ['#ffc766', '#ff9a2e', '#d9701a'];
  const teal = ['#59e0d2', '#27a89b', '#1b7f76'];

  function pallet(ox, oy, cartons, layers, size) {
    const [w, d] = size;
    // longerons
    [0, (d - 1) / 2, d - 1].forEach(y => box(ox, oy + y, 0, w, 1, 1.4, wood));
    // plateau
    const n = 5, sw = w / n;
    for (let i = 0; i < n; i++) box(ox + i * sw + .2, oy, 1.4, sw - .4, d, .7, wood);
    // cartons
    const baseZ = 2.1;
    const ch = 4;
    const cw = w / 2, cd = d / 2;
    for (let l = 0; l < layers; l++) {
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j]) => {
        const col = cartons[(i + j + l) % cartons.length];
        box(ox + i * cw + .12, oy + j * cd + .12, baseZ + l * ch, cw - .24, cd - .24, ch - .08, col);
      });
    }
    // film étirable : voile translucide
    const zTop = baseZ + layers * ch;
    const hull = [P(ox, oy + d, baseZ), P(ox + w, oy + d, baseZ), P(ox + w, oy, baseZ), P(ox + w, oy, zTop), P(ox, oy, zTop), P(ox, oy + d, zTop)];
    out += `<polygon points="${poly(hull)}" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>`;
  }

  // ordre d'affichage : arrière → avant
  pallet(0, 0, [kraft, navy], 3, [12, 8]);
  pallet(14, 0, [navy, teal], 2, [12, 8]);
  pallet(0, 10, [amber, kraft], 2, [12, 8]);

  // ombre au sol
  const sh = [P(-1, -1, 0), P(27, -1, 0), P(27, 19, 0), P(-1, 19, 0)];
  svg.innerHTML = `<defs><radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1e2d50" stop-opacity=".28"/><stop offset="1" stop-color="#1e2d50" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="${CX + 30}" cy="${CY + 12 * K + 20}" rx="250" ry="62" fill="url(#sh)"/>` + out;
})();

/* ---------- 3. FORMULAIRE ---------- */
(function form() {
  const itemsEl = document.getElementById('items');
  const addBtn = document.getElementById('addItem');
  const warnBox = document.getElementById('warnBox');
  const formEl = document.getElementById('quoteForm');
  const TYPES = {
    europe: { name: 'Palette Europe (120 × 80)', L: 120, l: 80 },
    americaine: { name: 'Palette américaine (120 × 100)', L: 120, l: 100 },
    demi: { name: 'Demi-palette (80 × 60)', L: 80, l: 60 },
    quart: { name: 'Quart de palette (60 × 40)', L: 60, l: 40 },
    custom: { name: 'Format sur mesure', L: 120, l: 80 }
  };
  let count = 0;

  function addItem() {
    count++;
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="item-head">
        <span class="item-title">Palette n°<span class="idx"></span></span>
        <button type="button" class="item-del" aria-label="Supprimer cette ligne">✕</button>
      </div>
      <div class="item-grid">
        <label class="field">Type de palette
          <select class="f-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
        </label>
        <label class="field">Quantité
          <input type="number" class="f-qty" min="1" value="1" />
        </label>
        <label class="field unit" data-u="kg">Poids / palette
          <input type="number" class="f-weight" min="1" value="400" />
        </label>
      </div>
      <div class="dim-grid">
        <label class="field unit" data-u="cm">Longueur
          <input type="number" class="f-L" min="10" value="120" />
        </label>
        <label class="field unit" data-u="cm">Largeur
          <input type="number" class="f-l" min="10" value="80" />
        </label>
        <label class="field unit" data-u="cm">Hauteur
          <input type="number" class="f-H" min="10" value="120" />
        </label>
      </div>`;
    itemsEl.appendChild(div);

    const type = div.querySelector('.f-type');
    type.addEventListener('change', () => {
      const t = TYPES[type.value];
      div.querySelector('.f-L').value = t.L;
      div.querySelector('.f-l').value = t.l;
      update();
    });
    div.querySelector('.item-del').addEventListener('click', () => {
      if (itemsEl.children.length > 1) { div.remove(); update(); }
    });
    div.addEventListener('input', update);
    update();
  }

  function num(el) { return Math.max(0, parseFloat(el.value) || 0); }

  function update() {
    let pallets = 0, weight = 0, volume = 0, ldm = 0;
    const warns = [];
    [...itemsEl.children].forEach((it, i) => {
      it.querySelector('.idx').textContent = i + 1;
      it.querySelector('.item-del').style.visibility = itemsEl.children.length > 1 ? 'visible' : 'hidden';
      const q = num(it.querySelector('.f-qty'));
      const w = num(it.querySelector('.f-weight'));
      const L = num(it.querySelector('.f-L'));
      const l = num(it.querySelector('.f-l'));
      const H = num(it.querySelector('.f-H'));
      pallets += q; weight += q * w;
      volume += q * L * l * H / 1e6;
      ldm += q * (L / 100) * (l / 100) / 2.4;
      if (H > 220) warns.push(`Palette n°${i + 1} : hauteur supérieure à 220 cm, nous contacter.`);
      if (w > 1000) warns.push(`Palette n°${i + 1} : poids supérieur à 1 000 kg, une validation sera nécessaire.`);
      if (L > 240 || l > 240) warns.push(`Palette n°${i + 1} : dimension hors gabarit standard.`);
    });
    const fmt = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    document.getElementById('rPallets').textContent = fmt(pallets);
    document.getElementById('rWeight').textContent = fmt(weight) + ' kg';
    document.getElementById('rVolume').textContent = fmt(volume) + ' m³';
    document.getElementById('rLdm').textContent = fmt(ldm) + ' m';
    const fill = Math.min(100, Math.max(ldm / 13.6, weight / 24000) * 100);
    document.getElementById('rFill').textContent = Math.round(fill) + ' %';
    document.getElementById('rBar').style.width = fill + '%';
    warnBox.hidden = !warns.length;
    warnBox.innerHTML = warns.join('<br>');
  }

  addBtn.addEventListener('click', addItem);
  addItem();

  // date minimale = aujourd'hui
  const dateInput = document.getElementById('dateInput');
  dateInput.min = new Date().toISOString().split('T')[0];

  // soumission
  formEl.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    formEl.querySelectorAll('[required]').forEach(f => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    itemsEl.querySelectorAll('.f-qty, .f-weight, .f-L, .f-l, .f-H').forEach(f => {
      const bad = num(f) <= 0;
      f.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) {
      const first = formEl.querySelector('.invalid');
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.focus({ preventScroll: true });
      return;
    }

    const data = Object.fromEntries(new FormData(formEl).entries());
    data.options = [...formEl.querySelectorAll('input[name=opt]:checked')].map(c => c.value);
    data.palettes = [...itemsEl.children].map(it => ({
      type: it.querySelector('.f-type').value,
      quantite: num(it.querySelector('.f-qty')),
      poidsKg: num(it.querySelector('.f-weight')),
      longueurCm: num(it.querySelector('.f-L')),
      largeurCm: num(it.querySelector('.f-l')),
      hauteurCm: num(it.querySelector('.f-H'))
    }));
    console.log('Demande de devis :', data); // → à brancher sur votre backend / e-mail

    const ref = 'DEV-' + new Date().getFullYear().toString().slice(2) + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    document.getElementById('mName').textContent = data.contact;
    document.getElementById('mRef').textContent = ref;
    document.getElementById('modal').hidden = false;
    formEl.reset();
    itemsEl.innerHTML = '';
    addItem();
  });
  formEl.addEventListener('input', e => e.target.classList.remove('invalid'));
})();

/* ---------- 4. UI ---------- */
(function ui() {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const links = document.getElementById('navLinks');

  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 30), { passive: true });
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open'); burger.setAttribute('aria-expanded', false);
  }));

  // apparitions au scroll
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // compteurs
  const co = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count, suf = el.dataset.suffix || '';
      const t0 = performance.now(), dur = 1600;
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        el.textContent = v.toLocaleString('fr-FR') + suf;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      co.unobserve(el);
    });
  });
  document.querySelectorAll('[data-count]').forEach(el => co.observe(el));

  // halo lumineux sur les cartes
  document.querySelectorAll('.card').forEach(c => {
    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', e.clientX - r.left + 'px');
      c.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });

  // modale
  const modal = document.getElementById('modal');
  const close = () => { modal.hidden = true; };
  document.getElementById('closeModal').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
