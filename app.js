(() => {
  "use strict";

  const S = window.STORY;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  /* ───────── Тексты из story.js ───────── */
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), S);
  $$("[data-text]").forEach((el) => {
    const v = get(el.dataset.text);
    if (v != null) el.textContent = v;
  });
  $$("[data-src]").forEach((el) => { el.src = get(el.dataset.src); });

  $$("[data-alt]").forEach((el) => { el.alt = get(el.dataset.alt); });

  // Порядок появления элементов в каждой сцене
  $$(".scene").forEach((scene) => {
    $$("[data-reveal]", scene).forEach((el, i) => el.style.setProperty("--i", i));
  });

  /* ───────── Сцены и небо ───────── */
  const SCENES = ["intro", "candles", "first", "memories", "travels", "coast", "concert", "stars", "letter", "final"];
  //            верх неба   середина   низ        текст      звёзды
  const SKY = {
    intro:    ["#0B0920", "#17123A", "#251A4A", "#F6EAE4", 1],
    candles:  ["#0C0A22", "#1B1337", "#2C1A3E", "#F6EAE4", 1],
    first:    ["#110D2C", "#241846", "#3B2353", "#F6EAE4", 1],
    memories: ["#161236", "#2F1F4E", "#53305F", "#F6EAE4", .9],
    travels:  ["#1C1640", "#3E2659", "#734068", "#F6EAE4", .75],
    coast:    ["#241938", "#574057", "#AD7778", "#FFF2E8", .6],
    concert:  ["#170F2E", "#3D234A", "#663957", "#FFF0EB", .85],
    stars:    ["#15123A", "#33235A", "#7C476E", "#F6EAE4", .95],
    letter:   ["#2B2556", "#6E4878", "#D3878A", "#FBEFEA", .3],
    final:    ["#9FB2E2", "#F0BCC0", "#FFD9A3", "#2A1838", 0]
  };

  const sceneEls = SCENES.map((name) => $(`.scene[data-scene="${name}"]`));
  const progress = $(".progress");
  const progressDots = SCENES.slice(1).map(() => {
    const d = document.createElement("span");
    progress.appendChild(d);
    return d;
  });

  const handlers = {};
  const entered = new Set();
  let current = 0;

  function go(index) {
    if (index < 0 || index >= SCENES.length) return;
    const prev = SCENES[current];
    handlers[prev]?.leave?.();
    sceneEls[current].classList.remove("is-active");

    current = index;
    const name = SCENES[index];
    const el = sceneEls[index];
    el.classList.add("is-active");
    document.body.dataset.scene = name;

    const [top, mid, bot, ink, stars] = SKY[name];
    root.style.setProperty("--sky-top", top);
    root.style.setProperty("--sky-mid", mid);
    root.style.setProperty("--sky-bot", bot);
    root.style.setProperty("--ink", ink);
    root.style.setProperty("--stars", stars);
    $('meta[name="theme-color"]').setAttribute("content", top);

    progressDots.forEach((d, i) => {
      d.classList.toggle("done", i < index - 1);
      d.classList.toggle("now", i === index - 1);
    });
    progress.setAttribute("aria-valuenow", Math.max(1, index));

    el.scrollTop = 0;
    if (!entered.has(name)) {
      entered.add(name);
      handlers[name]?.init?.(el);
    }
    handlers[name]?.enter?.(el);

    const heading = $("h1, h2", el);
    setTimeout(() => heading?.focus({ preventScroll: true }), 400);
  }

  const next = () => go(current + 1);
  const done = (sceneEl) => sceneEl.classList.add("is-done");

  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="next"]')) next();
  });

  /* ───────── Музыка ───────── */
  const musicBtn = $(".music");
  let audio = null;
  if (S.music) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = .55;
    audio.preload = "auto";
    const firstInteraction = new AbortController();
    const setPlaying = (on) => {
      musicBtn.setAttribute("aria-pressed", String(on));
      musicBtn.setAttribute("aria-label", on ? "Выключить музыку" : "Включить музыку");
    };
    audio.addEventListener("loadedmetadata", () => { musicBtn.hidden = false; });
    audio.addEventListener("playing", () => {
      firstInteraction.abort();
      setPlaying(true);
    });
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("error", () => { musicBtn.hidden = true; });
    audio.src = S.music;

    const playMusic = () => audio.play().catch(() => setPlaying(!audio.paused));
    const startOnInteraction = (event) => {
      if (!audio.error && audio.paused && !musicBtn.contains(event.target)) playMusic();
    };
    for (const event of ["click", "keydown"]) {
      document.addEventListener(event, startOnInteraction, { signal: firstInteraction.signal });
    }
    musicBtn.addEventListener("click", () => {
      firstInteraction.abort();
      if (audio.paused) playMusic();
      else audio.pause();
    });
    playMusic();
  }
  const duckMusic = (on) => {
    if (!audio) return;
    audio.volume = on ? .08 : .55;
  };

  /* ───────── Звёздное небо ───────── */
  (function starfield() {
    const c = $(".stars");
    const ctx = c.getContext("2d");
    let stars = [], w = 0, h = 0, dpr = 1;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 2600);
      stars = Array.from({ length: count }, () => {
        const y = Math.random() ** 1.6 * h; // гуще вверху
        return {
          x: Math.random() * w,
          y,
          r: Math.random() < .08 ? 1.3 + Math.random() * .8 : .4 + Math.random() * .8,
          a: .35 + Math.random() * .65,
          p: Math.random() * Math.PI * 2,
          s: .4 + Math.random() * 1.2,
          warm: Math.random() < .18
        };
      });
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = reduceMotion ? 1 : .55 + .45 * Math.sin(t / 1000 * s.s + s.p);
        ctx.globalAlpha = s.a * tw * (1 - (s.y / h) * .55);
        ctx.fillStyle = s.warm ? "#FFE3B5" : "#F3ECFF";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    let last = 0;
    function loop(t) {
      if (t - last > 50) { draw(t); last = t; }
      if (!reduceMotion) requestAnimationFrame(loop);
    }
    build();
    requestAnimationFrame(loop);
    let rt;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { build(); draw(performance.now()); }, 150);
    });
  })();

  /* ───────── 1. Свечи ───────── */
  handlers.candles = (() => {
    let total = 0, lit = 0, sceneEl, micStream = null, micCtx = null, micRaf = 0;
    const micBtn = $(".mic-btn");

    function layout(container) {
      const n = S.age;
      // Три ряда на верхнем ярусе торта (координаты в системе 360×300)
      const rows = [
        { y: 142, x0: 92,  x1: 268, share: .38 },
        { y: 153, x0: 82,  x1: 278, share: .34 },
        { y: 165, x0: 104, x1: 256, share: .28 }
      ];
      let counts = rows.map((r) => Math.round(n * r.share));
      counts[1] += n - counts.reduce((a, b) => a + b, 0);
      rows.forEach((r, ri) => {
        const k = counts[ri];
        for (let i = 0; i < k; i++) {
          const t = k === 1 ? .5 : i / (k - 1);
          const x = r.x0 + (r.x1 - r.x0) * t + (ri === 1 ? 0 : (Math.random() - .5) * 4);
          const y = r.y + Math.sin(t * Math.PI) * (ri === 0 ? -5 : ri === 2 ? 5 : 0);
          const c = document.createElement("span");
          c.className = "candle";
          c.style.left = (x / 360 * 100) + "%";
          c.style.top = ((y - 44) / 300 * 100) + "%";
          c.style.zIndex = String(ri + 1);
          c.style.setProperty("--fd", (1 + Math.random() * .8).toFixed(2) + "s");
          c.style.setProperty("--fdelay", (-Math.random() * 2).toFixed(2) + "s");
          c.innerHTML = '<span class="wick"></span><span class="flame"></span><span class="smoke"></span>';
          container.appendChild(c);
        }
      });
      total = lit = n;
    }

    function setGlow() {
      root.style.setProperty("--glow", (lit / total).toFixed(3));
    }

    function blow(candle) {
      if (!candle || candle.classList.contains("out")) return;
      candle.classList.add("out");
      lit--;
      setGlow();
      if (navigator.vibrate) navigator.vibrate(8);
      if (lit === 0) finish();
    }

    function finish() {
      stopMic();
      setTimeout(() => {
        root.style.setProperty("--glow", "0");
        done(sceneEl);
      }, 700);
    }

    function bindSwipe(cake) {
      let down = false, lx = 0, ly = 0;
      const hitAt = (x, y) => {
        for (const el of document.elementsFromPoint(x, y)) {
          const c = el.closest(".candle");
          if (c && !c.classList.contains("out")) { blow(c); return; }
        }
      };
      cake.addEventListener("pointerdown", (e) => {
        down = true; lx = e.clientX; ly = e.clientY;
        cake.setPointerCapture?.(e.pointerId);
        hitAt(lx, ly);
      });
      cake.addEventListener("pointermove", (e) => {
        if (!down && e.pointerType !== "mouse") return;
        const x = e.clientX, y = e.clientY;
        if (!down) { hitAt(x, y); return; } // мышью можно просто водить
        const dist = Math.hypot(x - lx, y - ly);
        const steps = Math.max(1, Math.ceil(dist / 5));
        for (let i = 1; i <= steps; i++) hitAt(lx + (x - lx) * i / steps, ly + (y - ly) * i / steps);
        lx = x; ly = y;
      });
      const up = () => { down = false; };
      cake.addEventListener("pointerup", up);
      cake.addEventListener("pointercancel", up);
      // Клавиатура: Enter/пробел на торте задувает по одной свече
      cake.tabIndex = 0;
      cake.setAttribute("role", "button");
      cake.setAttribute("aria-label", "Торт со свечами. Нажми, чтобы задуть свечу");
      cake.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          blow($(".candle:not(.out)", cake));
        }
      });
    }

    async function startMic() {
      if (micStream) { stopMic(); return; }
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch {
        micBtn.textContent = "Микрофон недоступен — задуй пальцем";
        micBtn.disabled = true;
        return;
      }
      duckMusic(true);
      micBtn.classList.add("listening");
      micBtn.textContent = S.candles.micListening;
      const AC = window.AudioContext || window.webkitAudioContext;
      micCtx = new AC();
      const src = micCtx.createMediaStreamSource(micStream);
      const an = micCtx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let floor = 0.01, frames = 0, cooldown = 0;
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        // подстраиваемся под фоновый шум
        if (rms < floor * 2.5) floor = floor * .97 + rms * .03;
        const blowing = rms > Math.max(.045, floor * 5);
        frames = blowing ? frames + 1 : 0;
        if (cooldown > 0) cooldown--;
        if (frames > 2 && cooldown === 0) {
          const litC = $$(".candle:not(.out)", sceneEl);
          const howMany = Math.min(litC.length, 1 + Math.floor(Math.random() * 2));
          for (let i = 0; i < howMany; i++) {
            blow(litC.splice(Math.floor(Math.random() * litC.length), 1)[0]);
          }
          cooldown = 4;
        }
        micRaf = requestAnimationFrame(tick);
      };
      tick();
    }

    function stopMic() {
      cancelAnimationFrame(micRaf);
      micStream?.getTracks().forEach((t) => t.stop());
      micStream = null;
      micCtx?.close().catch(() => {});
      micCtx = null;
      duckMusic(false);
      micBtn.classList.remove("listening");
      if (!micBtn.disabled) micBtn.textContent = S.candles.micButton;
    }

    return {
      init(el) {
        sceneEl = el;
        const cake = $(".cake", el);
        layout($(".candles", el));
        bindSwipe(cake);
        if (!navigator.mediaDevices?.getUserMedia) micBtn.hidden = true;
        micBtn.addEventListener("click", startMic);
      },
      enter() {
        setTimeout(setGlow, 600);
      },
      leave() {
        stopMic();
        root.style.setProperty("--glow", "0");
      }
    };
  })();

  /* ───────── 2. Стирашка ───────── */
  handlers.first = (() => {
    let canvas, ctx, sceneEl, cleared = false, moves = 0;

    function paint() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#C98A3A");
      g.addColorStop(.3, "#F6D28A");
      g.addColorStop(.5, "#FFF0C8");
      g.addColorStop(.7, "#E7B45E");
      g.addColorStop(1, "#B9782E");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // фактура фольги
      for (let i = 0; i < 900; i++) {
        ctx.globalAlpha = Math.random() * .18;
        ctx.fillStyle = Math.random() < .5 ? "#FFFFFF" : "#7A4A12";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
      // блёстки
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * w, y = Math.random() * h, s = 2 + Math.random() * 4;
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.beginPath();
        ctx.moveTo(x, y - s); ctx.lineTo(x + s * .25, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * .25, y);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x, y + s * .25); ctx.lineTo(x + s, y); ctx.lineTo(x, y - s * .25);
        ctx.closePath(); ctx.fill();
      }
      // большое «?» по центру
      ctx.fillStyle = "rgba(122, 74, 18, .35)";
      ctx.font = `italic 300 ${Math.round(w * .5)}px "Cormorant Garamond", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", w / 2, h / 2);
    }

    function scratch(x, y, px, py) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(34, canvas.clientWidth * .14);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (++moves % 10 === 0) check();
    }

    function check() {
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      let clear = 0, n = 0;
      for (let i = 3; i < data.length; i += 4 * 24) { n++; if (data[i] < 120) clear++; }
      if (clear / n > .5) reveal();
    }

    function reveal() {
      if (cleared) return;
      cleared = true;
      canvas.classList.add("cleared");
      if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
      done(sceneEl);
    }

    return {
      init(el) {
        sceneEl = el;
        canvas = $(".foil", el);
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        (document.fonts?.ready || Promise.resolve()).then(paint);

        let down = false, px = 0, py = 0;
        // offsetX/Y уже учитывают поворот карточки
        const pos = (e) => [e.offsetX, e.offsetY];
        canvas.addEventListener("pointerdown", (e) => {
          if (cleared) return;
          down = true;
          canvas.setPointerCapture?.(e.pointerId);
          [px, py] = pos(e);
          scratch(px + .1, py + .1, px, py);
        });
        canvas.addEventListener("pointermove", (e) => {
          if (!down || cleared) return;
          const [x, y] = pos(e);
          scratch(x, y, px, py);
          px = x; py = y;
        });
        const up = () => { if (down) { down = false; check(); } };
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);
        // Клавиатура: открыть фото целиком
        canvas.tabIndex = 0;
        canvas.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); }
        });
      }
    };
  })();

  /* ───────── 3. Карточки воспоминаний ───────── */
  handlers.memories = (() => {
    let cards = [], idx = 0, sceneEl, note;

    function showNote() {
      note.classList.add("swap");
      setTimeout(() => {
        note.textContent = idx < cards.length ? S.memories.cards[idx].note : "";
        note.classList.remove("swap");
      }, 260);
    }

    function fling(card, dir) {
      card.classList.remove("dragging");
      card.style.transform = `translate(${dir * 130}vw, -6vh) rotate(${dir * 24}deg)`;
      card.classList.add("gone");
      card.tabIndex = -1;
      idx++;
      if (navigator.vibrate) navigator.vibrate(6);
      if (idx >= cards.length) {
        note.textContent = "";
        setTimeout(() => done(sceneEl), 350);
      } else {
        cards[idx].tabIndex = 0;
        showNote();
      }
    }

    function bind(card, i) {
      let sx = 0, sy = 0, dx = 0, dy = 0, down = false;
      card.addEventListener("pointerdown", (e) => {
        if (i !== idx) return;
        down = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
        card.setPointerCapture?.(e.pointerId);
        card.classList.add("dragging");
      });
      card.addEventListener("pointermove", (e) => {
        if (!down) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        card.style.transform = `translate(${dx}px, ${dy * .4}px) rotate(${dx / 14}deg)`;
      });
      const up = () => {
        if (!down) return;
        down = false;
        const moved = Math.hypot(dx, dy);
        if (Math.abs(dx) > 70) fling(card, Math.sign(dx));
        else if (moved < 8) fling(card, i % 2 ? 1 : -1); // просто нажатие
        else { card.classList.remove("dragging"); card.style.transform = ""; }
      };
      card.addEventListener("pointerup", up);
      card.addEventListener("pointercancel", up);
      card.addEventListener("keydown", (e) => {
        if (i !== idx) return;
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); fling(card, 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); fling(card, -1); }
      });
    }

    return {
      init(el) {
        sceneEl = el;
        note = $(".note", el);
        const stack = $(".stack", el);
        const list = S.memories.cards;
        cards = list.map((m, i) => {
          const f = document.createElement("figure");
          f.className = "polaroid";
          f.style.zIndex = String(list.length - i);
          f.style.setProperty("--r", `${(i % 2 ? 1 : -1) * (2 + Math.random() * 3.5)}deg`);
          f.setAttribute("role", "button");
          f.setAttribute("aria-label", `${m.alt || m.caption}. Нажми, чтобы листать дальше`);
          f.tabIndex = i === 0 ? 0 : -1;
          f.innerHTML = `<div class="photo"><img alt="" draggable="false" loading="${i < 2 ? "eager" : "lazy"}"></div><figcaption class="cap"></figcaption>`;
          $("img", f).src = m.photo;
          $(".cap", f).textContent = m.caption;
          stack.appendChild(f);
          bind(f, i);
          return f;
        });
        note.textContent = list[0]?.note || "";
      }
    };
  })();

  const concertVideo = $(".concert-film video");
  handlers.concert = {
    init() {
      concertVideo.poster = S.concert.poster;
      concertVideo.src = S.concert.video;
      const mix = () => duckMusic(!concertVideo.paused && !concertVideo.muted && concertVideo.volume > 0);
      for (const event of ["playing", "pause", "volumechange", "ended"]) {
        concertVideo.addEventListener(event, mix);
      }
    },
    leave() {
      concertVideo.pause();
      duckMusic(false);
    }
  };

  /* ───────── 5. Созвездие-сердце ───────── */
  handlers.stars = (() => {
    const NS = "http://www.w3.org/2000/svg";
    let pts = [], nextI = 0, sceneEl, linesG, starEls = [];

    function heartPoints(n) {
      const out = [];
      for (let k = 0; k < n; k++) {
        const t = (k / n) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        out.push([50 + x * 2.6, 45 - y * 2.6]);
      }
      return out;
    }

    function line(a, b) {
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", a[0]); l.setAttribute("y1", a[1]);
      l.setAttribute("x2", b[0]); l.setAttribute("y2", b[1]);
      l.setAttribute("pathLength", "1");
      linesG.appendChild(l);
      requestAnimationFrame(() => requestAnimationFrame(() => l.classList.add("drawn")));
    }

    function tap(i) {
      if (sceneEl.classList.contains("is-done")) return;
      if (i !== nextI) {
        const s = starEls[i];
        s.classList.remove("nope"); void s.getBBox(); s.classList.add("nope");
        return;
      }
      starEls[i].classList.remove("next");
      starEls[i].classList.add("lit");
      if (i > 0) line(pts[i - 1], pts[i]);
      if (navigator.vibrate) navigator.vibrate(6);
      nextI++;
      if (nextI < pts.length) {
        starEls[nextI].classList.add("next");
        starEls[nextI].focus?.({ preventScroll: true });
      } else {
        setTimeout(() => line(pts[pts.length - 1], pts[0]), 250);
        setTimeout(() => done(sceneEl), 900);
      }
    }

    return {
      init(el) {
        sceneEl = el;
        const svg = $(".constellation", el);
        linesG = $(".lines", svg);
        const pointsG = $(".points", svg);
        const dust = $(".dust", svg);
        pts = heartPoints(16);

        // Мелкая звёздная пыль вокруг
        for (let i = 0; i < 46; i++) {
          const c = document.createElementNS(NS, "circle");
          c.setAttribute("cx", (Math.random() * 104 - 2).toFixed(1));
          c.setAttribute("cy", (Math.random() * 104 - 2).toFixed(1));
          c.setAttribute("r", (.15 + Math.random() * .35).toFixed(2));
          c.setAttribute("opacity", (.2 + Math.random() * .5).toFixed(2));
          dust.appendChild(c);
        }

        $(".heart-fill", svg).setAttribute("d", "M" + pts.map((p) => p.map((v) => v.toFixed(2)).join(" ")).join(" L") + " Z");

        starEls = pts.map(([x, y], i) => {
          const g = document.createElementNS(NS, "g");
          g.setAttribute("class", "star" + (i === 0 ? " next" : ""));
          g.setAttribute("tabindex", "0");
          g.setAttribute("role", "button");
          g.setAttribute("aria-label", `Звезда ${i + 1} из ${pts.length}`);
          g.innerHTML =
            `<circle class="halo" cx="${x}" cy="${y}" r="5"/>` +
            `<circle class="core" cx="${x}" cy="${y}" r="${i % 4 === 0 ? 1.2 : .9}"/>` +
            `<circle class="hit" cx="${x}" cy="${y}" r="6"/>`;
          g.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(i); }
          });
          pointsG.appendChild(g);
          return g;
        });

        // Касание по всему полю: берём ближайшую звезду, а ту, что мерцает, — с запасом
        svg.addEventListener("pointerdown", (e) => {
          const m = svg.getScreenCTM();
          if (!m) return;
          const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
          const d = pts.map(([x, y]) => Math.hypot(x - pt.x, y - pt.y));
          if (nextI < pts.length && d[nextI] < 9) { e.preventDefault(); tap(nextI); return; }
          let best = 0;
          d.forEach((v, i) => { if (v < d[best]) best = i; });
          if (d[best] < 6) { e.preventDefault(); tap(best); }
        });
      }
    };
  })();

  /* ───────── 6. Записка ───────── */
  handlers.letter = {
    init(el) {
      const env = $(".envelope", el);
      env.addEventListener("click", () => {
        env.classList.add("open");
        env.setAttribute("aria-label", S.letter.letterText);
        if (navigator.vibrate) navigator.vibrate(10);
        done(el);
      }, { once: true });
    }
  };

  /* ───────── 7. Финал и лепестки ───────── */
  handlers.final = (() => {
    function petals() {
      if (reduceMotion) return;
      const c = $(".petals");
      const ctx = c.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth, h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = ["#F2A9B6", "#F7C6CD", "#FFC46B", "#FFE1A8", "#E68797", "#FFFFFF"];
      const list = Array.from({ length: 70 }, () => ({
        x: Math.random() * w,
        y: -20 - Math.random() * h * .9,
        s: 5 + Math.random() * 7,
        vy: 40 + Math.random() * 60,
        sway: 20 + Math.random() * 40,
        p: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - .5) * 2.2,
        c: colors[Math.floor(Math.random() * colors.length)]
      }));
      let start = 0;
      const frame = (t) => {
        if (!start) start = t;
        const el = (t - start) / 1000;
        ctx.clearRect(0, 0, w, h);
        let alive = 0;
        for (const p of list) {
          const y = p.y + p.vy * el;
          if (y > h + 20) continue;
          alive++;
          const x = p.x + Math.sin(el * 1.3 + p.p) * p.sway;
          const flip = Math.abs(Math.cos(el * 2 + p.p));
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.rot + el * p.vr);
          ctx.scale(1, .35 + flip * .65);
          ctx.fillStyle = p.c;
          ctx.globalAlpha = .9;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.s, p.s * .62, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (alive) requestAnimationFrame(frame);
        else ctx.clearRect(0, 0, w, h);
      };
      requestAnimationFrame(frame);
    }

    return {
      init(el) {
        $(".replay", el).addEventListener("click", () => location.reload());
      },
      enter() {
        setTimeout(petals, 2600);
      }
    };
  })();

  // Для проверки: ?scene=travels открывает сразу нужную сцену
  const startAt = SCENES.indexOf(new URLSearchParams(location.search).get("scene"));
  go(startAt > 0 ? startAt : 0);
})();
