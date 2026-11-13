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
