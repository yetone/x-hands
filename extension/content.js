(() => {
  if (window.__xHands) return;
  window.__xHands = true;

  const OUT = 'cubic-bezier(.23, 1, .32, 1)';
  const INOUT = 'cubic-bezier(.77, 0, .175, 1)';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deg = Math.PI / 180;

  // Trimmed image geometry (pixels in the source image)
  const SUIT = { w: 1494, h: 1004, tip: [1490, 18], base: [0, 850], hit: [1200, 360] };
  const SLAP = { w: 1958, h: 771, palm: [450, 430] };
  const SUIT_ANGLE = Math.atan2(SUIT.tip[1] - SUIT.base[1], SUIT.tip[0] - SUIT.base[0]); // ≈ -29°
  const ARM_ANGLE = -58 * deg; // the arm reaches up-right from the bottom-left

  const url = p => chrome.runtime.getURL(p);
  const imgs = ['assets/hand-suit.webp', 'assets/hand-slap.webp'].map(p => {
    const i = new Image(); i.src = url(p); return i;
  });
  const ready = Promise.all(imgs.map(i => i.decode().catch(() => {})));

  /* ---------- overlay ---------- */
  let host, root;
  function overlay() {
    if (host?.isConnected) return root;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .hand { position: fixed; left: 0; top: 0; visibility: hidden; will-change: transform; }
        .hand img { position: absolute; display: block; filter: drop-shadow(0 14px 22px rgba(0,0,0,.3)); }
        .pill {
          position: fixed; left: 0; top: 0; visibility: hidden;
          font: 700 15px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
          color: rgb(29,155,240); border: 1px solid rgba(29,155,240,.55); border-radius: 999px;
          padding: 9px 16px; white-space: nowrap; background: var(--bg, #fff);
        }
        .boom { position: fixed; left: 0; top: 0; opacity: 0; }
        .boom svg { position: absolute; width: 150px; height: 150px; left: -75px; top: -75px; }
        .boom .word {
          position: absolute; left: -70px; top: -110px; width: 140px; text-align: center;
          font: 900 48px/1 "PingFang SC", "Microsoft YaHei", sans-serif; color: #ffd400;
          -webkit-text-stroke: 3px #111; paint-order: stroke fill; transform: rotate(-12deg);
        }
        .flash { position: fixed; inset: 0; background: #fff; opacity: 0; }
      </style>
      <div class="flash"></div>
      <div class="pill"></div>
      <div class="hand suit"><img src="${imgs[0].src}" alt=""></div>
      <div class="hand slap"><img src="${imgs[1].src}" alt=""></div>
      <div class="boom"><svg viewBox="-75 -75 150 150"><polygon fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/></svg><div class="word"></div></div>`;
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, r = i % 2 ? 34 : 70 - (i % 4) * 6;
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    root.querySelector('polygon').setAttribute('points', pts.join(' '));
    document.documentElement.appendChild(host);
    return root;
  }

  const tf = (p, rot = 0, sc = 1) => `translate(${p.x}px, ${p.y}px) rotate(${rot}deg) scale(${sc})`;
  const add = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });
  const rotate = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

  /* ---------- find the composer ---------- */
  const isZh = () => /^zh/i.test(document.documentElement.lang || navigator.language);

  function postButtonFor(textarea) {
    for (let el = textarea; el && el !== document.body; el = el.parentElement) {
      const b = el.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      if (b) return b;
    }
    return null;
  }
  function visibleComposer() {
    return [...document.querySelectorAll('[data-testid^="tweetTextarea_"][contenteditable="true"], [data-testid^="tweetTextarea_"] [contenteditable="true"]')]
      .find(e => { const r = e.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; });
  }

  /* ---------- the show ---------- */
  let playing = false;

  async function play(textarea) {
    if (playing) return;
    playing = true;
    try {
      await ready;
      const R = overlay();
      const vw = innerWidth, vh = innerHeight;
      const suit = R.querySelector('.suit'), slap = R.querySelector('.slap');
      const pill = R.querySelector('.pill'), boom = R.querySelector('.boom');

      // 1. a fake "推广" pill appears left of the Post button
      const btn = textarea && postButtonFor(textarea);
      const br = btn?.getBoundingClientRect();
      pill.textContent = isZh() ? '推广' : 'Promote';
      pill.style.setProperty('--bg', getComputedStyle(document.body).backgroundColor || '#fff');
      pill.style.visibility = 'hidden';
      pill.style.transform = 'none';
      const pw = pill.offsetWidth, ph = pill.offsetHeight;
      let px, py;
      if (br && br.width) { px = br.left - 12 - pw; py = br.top + br.height / 2 - ph / 2; }
      else { px = vw - pw - 120; py = 70; }
      px = Math.max(8, px); py = Math.max(8, Math.min(vh - ph - 8, py));
      const pillAt = (dx = 0, dy = 0, rot = 0, sc = 1) => `translate(${px + dx}px, ${py + dy}px) rotate(${rot}deg) scale(${sc})`;
      pill.style.visibility = 'visible';
      pill.style.transformOrigin = '50% 50%';
      await pill.animate([
        { transform: pillAt(0, 0, 0, .9), opacity: 0 },
        { transform: pillAt(), opacity: 1 }
      ], { duration: 200, easing: OUT, fill: 'forwards' }).finished;

      // 2. size the suit hand so its sleeve reaches past the bottom-left corner
      const TIP = { x: px + pw * 0.5, y: py + ph * 0.8 };
      const L = Math.min(1400, Math.max(380, (vh + 80 - TIP.y) / Math.sin(-ARM_ANGLE)));
      const k = L / Math.hypot(SUIT.tip[0] - SUIT.base[0], SUIT.tip[1] - SUIT.base[1]);
      const SW = SUIT.w * k;
      const ROT = (ARM_ANGLE - SUIT_ANGLE) / deg;
      Object.assign(suit.firstElementChild.style, {
        width: SW + 'px', left: -SUIT.tip[0] * k + 'px', top: -SUIT.tip[1] * k + 'px'
      });
      const hitOff = rotate((SUIT.hit[0] - SUIT.tip[0]) * k, (SUIT.hit[1] - SUIT.tip[1]) * k, ROT * deg);
      const HIT = add(TIP, hitOff.x, hitOff.y);
      const away = { x: -Math.cos(ARM_ANGLE), y: -Math.sin(ARM_ANGLE) }; // from tip toward the sleeve

      suit.style.visibility = 'visible';
      await suit.animate([
        { transform: tf(add(TIP, away.x * L * .7, away.y * L * .7), ROT - 8) },
        { transform: tf(TIP, ROT) }
      ], { duration: 900, easing: OUT, fill: 'forwards' }).finished;

      // tap-tap-tap
      const nudge = rotate(-6, 10, 0);
      for (let i = 0; i < 3; i++) {
        pill.animate([
          { transform: pillAt(), background: 'var(--bg)' },
          { transform: pillAt(0, 0, 0, .96), background: 'rgba(29,155,240,.18)', offset: .4 },
          { transform: pillAt(), background: 'var(--bg)' }
        ], { duration: 380, easing: INOUT });
        await suit.animate([
          { transform: tf(TIP, ROT) },
          { transform: tf(add(TIP, nudge.x, nudge.y), ROT, .985), offset: .4 },
          { transform: tf(TIP, ROT) }
        ], { duration: 380, easing: INOUT }).finished;
      }
      await sleep(250);

      // 3. the other hand: peek in from the right, pull back, swing
      const reach = Math.max(330, (vw - HIT.x + 60) / ((SLAP.w - SLAP.palm[0]) / SLAP.w), SW * 0.7);
      const SLW = Math.min(reach, 2200), s2 = SLW / SLAP.w;
      Object.assign(slap.firstElementChild.style, {
        width: SLW + 'px', left: -SLAP.palm[0] * s2 + 'px', top: -SLAP.palm[1] * s2 + 'px'
      });
      const peek = Math.max(80, Math.min(SLW * .45, vw - 140 - HIT.x));
      slap.style.visibility = 'visible';
      await slap.animate([
        { transform: tf(add(HIT, vw - HIT.x + SLW * .3, -40), 18) },
        { transform: tf(add(HIT, peek, -30), 14) }
      ], { duration: 380, easing: OUT, fill: 'forwards' }).finished;
      await sleep(220);
      await slap.animate([
        { transform: tf(add(HIT, peek, -30), 14) },
        { transform: tf(add(HIT, peek + 50, -45), 20) }
      ], { duration: 160, easing: OUT, fill: 'forwards' }).finished;
      await slap.animate([
        { transform: tf(add(HIT, peek + 50, -45), 20), filter: 'blur(0)' },
        { transform: tf(HIT, -6), filter: 'blur(1.5px)' }
      ], { duration: 120, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }).finished;

      // 4. impact
      boom.querySelector('.word').textContent = isZh() ? '啪！' : 'SLAP!';
      boom.querySelector('.word').style.fontSize = isZh() ? '48px' : '36px';
      const B = add(HIT, -20, -10);
      boom.animate([
        { opacity: 1, transform: tf(B, 0, .6) },
        { opacity: 1, transform: tf(B, 0, 1.1), offset: .25 },
        { opacity: 1, transform: tf(B, 0, 1), offset: .7 },
        { opacity: 0, transform: tf(B, 0, 1.05) }
      ], { duration: 650, easing: OUT });
      R.querySelector('.flash').animate([{ opacity: .45 }, { opacity: 0 }], { duration: 160, easing: OUT });
      if (!reduced()) {
        const shakeEl = textarea?.closest('[role="dialog"]') || textarea?.closest('[data-testid="primaryColumn"]');
        shakeEl?.animate([
          { transform: 'translate(0,0)' }, { transform: 'translate(-9px,4px)' }, { transform: 'translate(7px,-3px)' },
          { transform: 'translate(-4px,2px)' }, { transform: 'translate(2px,-1px)' }, { transform: 'translate(0,0)' }
        ], { duration: 260, easing: 'linear' });
      }
      const fly = Math.max(vw, vh) * 1.1;
      suit.animate([
        { transform: tf(TIP, ROT) },
        { transform: tf(add(TIP, -70, 50), ROT - 18), offset: .15 },
        { transform: tf(add(TIP, away.x * fly - 200, away.y * fly), ROT - 55) }
      ], { duration: 650, easing: 'cubic-bezier(.2,.8,.4,1)', fill: 'forwards' })
        .finished.then(() => { suit.style.visibility = 'hidden'; });
      pill.animate([
        { transform: pillAt(), opacity: 1 },
        { transform: pillAt(-60, 40, -25), opacity: 1, offset: .3 },
        { transform: pillAt(-220, vh, -140), opacity: 0 }
      ], { duration: 700, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' })
        .finished.then(() => { pill.style.visibility = 'hidden'; });

      await slap.animate([
        { transform: tf(HIT, -6), filter: 'blur(1.5px)' },
        { transform: tf(add(HIT, -40, 8), -12), filter: 'blur(0)' }
      ], { duration: 180, easing: OUT, fill: 'forwards' }).finished;
      await sleep(550);
      await slap.animate([
        { transform: tf(add(HIT, -40, 8), -12) },
        { transform: tf(add(HIT, -30, 4), -4) },
        { transform: tf(add(HIT, -40, 8), -12) }
      ], { duration: 300, easing: INOUT, fill: 'forwards' }).finished;
      await slap.animate([
        { transform: tf(add(HIT, -40, 8), -12) },
        { transform: tf(add(HIT, vw - HIT.x + SLW, -20), 10) }
      ], { duration: 380, easing: OUT, fill: 'forwards' }).finished;
      slap.style.visibility = 'hidden';
    } finally {
      host?.remove();
      host = root = null;
      playing = false;
    }
  }

  /* ---------- trigger: once per composer, after a pause in typing ---------- */
  const done = new WeakSet();
  let timer;
  document.addEventListener('input', e => {
    const el = e.target instanceof Element && e.target.closest('[contenteditable="true"]');
    if (!el || !el.closest('[data-testid^="tweetTextarea_"]') && !el.matches('[data-testid^="tweetTextarea_"]')) return;
    const box = el.closest('[data-testid^="tweetTextarea_"]') || el;
    if (done.has(box)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if ((el.textContent || '').trim().length < 4 || done.has(box) || !el.isConnected) return;
      done.add(box);
      play(el);
    }, 900);
  }, true);

  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type === 'x-hands:play') play(visibleComposer());
  });
})();
