// Pulsante "Copia" per l'indirizzo email.
document.querySelectorAll("[data-copy]").forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener("click", () => {
    const done = () => {
      btn.textContent = btn.dataset.done;
      setTimeout(() => (btn.textContent = label), 1800);
    };
    navigator.clipboard?.writeText(btn.dataset.copy).then(done).catch(() => {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById("email"));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    });
  });
});

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Veicolo: cavi e centraline si accendono uno alla volta mentre la sezione scorre nello schermo.
document.querySelectorAll("[data-car]").forEach((sec) => {
  if (reduceMotion) return; // tutto acceso, fermo
  const parts = [...sec.querySelectorAll(".wire, .node")];
  sec.classList.add("armed");
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = sec.getBoundingClientRect();
    // 0 quando la sezione entra dal basso, 1 quando il suo centro arriva a metà schermo.
    const k = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.5 + r.height * 0.5)));
    parts.forEach((p, i) => p.classList.toggle("lit", i / parts.length < k * 1.05));
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
});

// Timeline: la pista si riempie quando la sezione è visibile.
document.querySelectorAll("[data-timeline]").forEach((tl) => {
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  tl.classList.add("armed");
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { tl.classList.add("in"); io.disconnect(); }
  }), { threshold: 0.4 });
  io.observe(tl);
});

// Scia luminosa del cursore (solo mouse, solo se il movimento è consentito).
if (!reduceMotion && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const cv = document.createElement("canvas");
  cv.className = "trail";
  cv.setAttribute("aria-hidden", "true");
  document.body.append(cv);
  const cx = cv.getContext("2d");
  const rgb = getComputedStyle(document.documentElement).getPropertyValue("--trail").trim() || "24, 119, 242";
  let pts = [], raf = 0, dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener("resize", size);
  const frame = () => {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    pts.forEach((p) => (p.a -= 0.05));
    pts = pts.filter((p) => p.a > 0);
    cx.lineWidth = 2; cx.lineCap = "round";
    for (let i = 1; i < pts.length; i++) {
      cx.strokeStyle = `rgba(${rgb}, ${pts[i].a * 0.8})`;
      cx.beginPath(); cx.moveTo(pts[i - 1].x, pts[i - 1].y); cx.lineTo(pts[i].x, pts[i].y); cx.stroke();
    }
    raf = pts.length ? requestAnimationFrame(frame) : 0;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pts.push({ x: e.clientX, y: e.clientY, a: 1 });
    if (pts.length > 40) pts.shift();
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
}

// Form contatti: compone un'email nel programma di posta del visitatore (il sito non salva né invia dati).
document.querySelectorAll("form[data-mailto]").forEach((f) => {
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (n) => (f.elements[n]?.value || "").trim();
    const labels = [...f.querySelectorAll("label")].map((l) => l.firstChild.textContent.trim());
    const body = ["name", "email", "type", "timing", "message"]
      .map((n, i) => `${labels[i]}: ${n === "message" ? "\n" : ""}${v(n)}`).join("\n");
    location.href = `mailto:${f.dataset.mailto}?subject=${encodeURIComponent(`${f.dataset.subject} — ${v("name")}`)}&body=${encodeURIComponent(body)}`;
  });
});
