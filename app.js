const STORAGE_KEY = "cloze_pwa_cards_v1";

function nowISO() { return new Date().toISOString(); }

function loadCards() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function parseCloze(text) {
  // Find {{answer}} segments
  const re = /{{(.+?)}}/g;
  const answers = [];
  let match;
  while ((match = re.exec(text)) !== null) answers.push(match[1].trim());

  const question = text.replace(re, "____");
  return { question, answers };
}

function makeCard(rawText) {
  const t = (rawText || "").trim();
  if (!t) return { error: "Empty." };

  const { question, answers } = parseCloze(t);
  if (answers.length === 0) return { error: "No cloze found. Use {{answer}}." };

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    raw: t,
    question,
    answers,
    createdAt: nowISO()
  };
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function setStatus(msg, ok = true) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = ok ? "var(--muted)" : "var(--danger)";
  if (msg) setTimeout(() => { el.textContent = ""; el.style.color = "var(--muted)"; }, 2500);
}

function render() {
  const wrap = document.getElementById("review");
  const cards = loadCards();

  if (cards.length === 0) {
    wrap.innerHTML = `<p class="hint">No cards yet. Add one above.</p>`;
    return;
  }

  wrap.innerHTML = "";
  for (const c of cards.slice().reverse()) {
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = c.id;

    const q = document.createElement("p");
    q.className = "q";
    q.textContent = c.question;

    const a = document.createElement("p");
    a.className = "a";
    a.textContent = c.answers.join(" | ");

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnReveal = document.createElement("button");
    btnReveal.type = "button";
    btnReveal.textContent = "Reveal";
    btnReveal.addEventListener("click", () => {
      div.classList.toggle("revealed");
      btnReveal.textContent = div.classList.contains("revealed") ? "Hide" : "Reveal";
    });

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.textContent = "Delete";
    btnDelete.className = "danger";
    btnDelete.addEventListener("click", () => {
      const next = loadCards().filter(x => x.id !== c.id);
      saveCards(next);
      render();
    });

    actions.append(btnReveal, btnDelete);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Created: ${c.createdAt}`;

    div.append(q, a, actions, meta);
    wrap.append(div);
  }
}

// Buttons
document.getElementById("btnAdd").addEventListener("click", () => {
  const ta = document.getElementById("inputText");
  const card = makeCard(ta.value);
  if (card.error) return setStatus(card.error, false);

  const cards = loadCards();
  cards.push(card);
  saveCards(cards);
  ta.value = "";
  setStatus("Added.");
  render();
});

document.getElementById("btnNew").addEventListener("click", () => {
  document.getElementById("inputText").value = "";
  setStatus("Cleared.");
});

document.getElementById("btnExport").addEventListener("click", () => {
  const cards = loadCards();
  downloadJSON("cloze-cards.json", { version: 1, exportedAt: nowISO(), cards });
  setStatus("Exported.");
});

document.getElementById("fileImport").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  try {
    const text = await f.text();
    const obj = JSON.parse(text);
    const imported = Array.isArray(obj.cards) ? obj.cards : [];
    // Minimal validation
    const cleaned = imported
      .filter(c => c && typeof c.raw === "string" && Array.isArray(c.answers))
      .map(c => ({
        id: c.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
        raw: c.raw,
        question: c.question || parseCloze(c.raw).question,
        answers: c.answers.length ? c.answers : parseCloze(c.raw).answers,
        createdAt: c.createdAt || nowISO()
      }));

    const cards = loadCards();
    saveCards(cards.concat(cleaned));
    setStatus(`Imported ${cleaned.length}.`);
    render();
  } catch {
    setStatus("Import failed (bad JSON).", false);
  } finally {
    e.target.value = "";
  }
});

// Service worker registration (needs HTTPS; GitHub Pages is HTTPS)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch {
      // ignore
    }
  });
}

render();
