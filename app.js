const STORAGE_KEY = "cloze_pwa_cards_v1";

// Separate buckets so each option has its own review area
const K1 = "cloze_pwa_opt1_cards_v1";
const K2 = "cloze_pwa_opt2_cards_v1";
const K3 = "cloze_pwa_opt3_cards_v1";
const K4 = "cloze_pwa_opt4_cards_v1";

function nowISO() { return new Date().toISOString(); }

function loadCards(key = STORAGE_KEY) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}
function saveCards(cards, key = STORAGE_KEY) {
  localStorage.setItem(key, JSON.stringify(cards));
}

function parseCloze(text) {
  const re = /{{(.+?)}}/g;
  const answers = [];
  let match;
  while ((match = re.exec(text)) !== null) answers.push(match[1].trim());
  const question = text.replace(re, "____");
  return { question, answers };
}

function makeCardFromClozeText(rawText) {
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

function makeCardFromQA(question, answers) {
  const q = (question || "").trim();
  const a = (answers || []).map(x => String(x).trim()).filter(Boolean);
  if (!q) return { error: "Question is empty." };
  if (a.length === 0) return { error: "Answer is empty." };
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    raw: q,
    question: q,
    answers: a,
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

function setStatus(id, msg, ok = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "var(--muted)" : "var(--danger)";
  if (msg) setTimeout(() => { el.textContent = ""; el.style.color = "var(--muted)"; }, 2500);
}

function renderInto(key, wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;

  const cards = loadCards(key);

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
      const next = loadCards(key).filter(x => x.id !== c.id);
      saveCards(next, key);
      renderInto(key, wrapId);
    });

    actions.append(btnReveal, btnDelete);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Created: ${c.createdAt}`;

    div.append(q, a, actions, meta);
    wrap.append(div);
  }
}

/* -------------------------
   ORIGINAL BLOCK (unchanged)
-------------------------- */
function renderOriginal() { renderInto(STORAGE_KEY, "review"); }

document.getElementById("btnAdd")?.addEventListener("click", () => {
  const ta = document.getElementById("inputText");
  const card = makeCardFromClozeText(ta.value);
  if (card.error) return setStatus("status", card.error, false);

  const cards = loadCards(STORAGE_KEY);
  cards.push(card);
  saveCards(cards, STORAGE_KEY);
  ta.value = "";
  setStatus("status", "Added.");
  renderOriginal();
});

document.getElementById("btnNew")?.addEventListener("click", () => {
  const ta = document.getElementById("inputText");
  if (ta) ta.value = "";
  setStatus("status", "Cleared.");
});

document.getElementById("btnExport")?.addEventListener("click", () => {
  const cards = loadCards(STORAGE_KEY);
  downloadJSON("cloze-cards.json", { version: 1, exportedAt: nowISO(), cards });
  setStatus("status", "Exported.");
});

document.getElementById("fileImport")?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  try {
    const text = await f.text();
    const obj = JSON.parse(text);
    const imported = Array.isArray(obj.cards) ? obj.cards : [];

    const cleaned = imported
      .filter(c => c && typeof c.raw === "string" && Array.isArray(c.answers))
      .map(c => ({
        id: c.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
        raw: c.raw,
        question: c.question || parseCloze(c.raw).question,
        answers: c.answers.length ? c.answers : parseCloze(c.raw).answers,
        createdAt: c.createdAt || nowISO()
      }));

    const cards = loadCards(STORAGE_KEY);
    saveCards(cards.concat(cleaned), STORAGE_KEY);
    setStatus("status", `Imported ${cleaned.length}.`);
    renderOriginal();
  } catch {
    setStatus("status", "Import failed (bad JSON).", false);
  } finally {
    e.target.value = "";
  }
});

/* -------------------------
   OPTION 1: Wrap selection
   - remembers caret/selection (mobile-friendly)
-------------------------- */
const t1 = document.getElementById("t1");
let t1Start = 0, t1End = 0;

function remember1() {
  if (!t1) return;
  t1Start = t1.selectionStart ?? 0;
  t1End = t1.selectionEnd ?? t1Start;
}

if (t1) ["click", "keyup", "select", "input"].forEach(ev => t1.addEventListener(ev, remember1));

document.getElementById("t1Cloze")?.addEventListener("click", () => {
  if (!t1) return;
  t1.focus();

  const start = t1Start, end = t1End;

  if (start !== end) {
    const selected = t1.value.slice(start, end);
    t1.setRangeText(`{{${selected}}}`, start, end, "end"); // replaces range [web:550]
  } else {
    const ins = "{{answer}}";
    t1.setRangeText(ins, start, end, "end");
    t1.setSelectionRange(start + 2, start + 2 + "answer".length);
  }
  remember1();
});

document.getElementById("t1Add")?.addEventListener("click", () => {
  if (!t1) return;
  const card = makeCardFromClozeText(t1.value);
  if (card.error) return setStatus("s1", card.error, false);

  const cards = loadCards(K1);
  cards.push(card);
  saveCards(cards, K1);
  t1.value = "";
  setStatus("s1", "Added.");
  renderInto(K1, "r1");
});

/* -------------------------
   OPTION 2: Inline blank + answer
-------------------------- */
const t2 = document.getElementById("t2");
const t2Answer = document.getElementById("t2Answer");
let t2Start = 0, t2End = 0;

function remember2() {
  if (!t2) return;
  t2Start = t2.selectionStart ?? 0;
  t2End = t2.selectionEnd ?? t2Start;
}
if (t2) ["click", "keyup", "select", "input"].forEach(ev => t2.addEventListener(ev, remember2));

document.getElementById("t2Blank")?.addEventListener("click", () => {
  if (!t2) return;
  t2.focus();
  t2.setRangeText("____", t2Start, t2End, "end"); // inserts/replaces at caret [web:550]
  remember2();
  setStatus("s2", "Inserted blank. Type the answer below.");
});

document.getElementById("t2Add")?.addEventListener("click", () => {
  if (!t2 || !t2Answer) return;
  const card = makeCardFromQA(t2.value, [t2Answer.value]);
  if (card.error) return setStatus("s2", card.error, false);

  const cards = loadCards(K2);
  cards.push(card);
  saveCards(cards, K2);
  t2.value = "";
  t2Answer.value = "";
  setStatus("s2", "Added.");
  renderInto(K2, "r2");
});

/* -------------------------
   OPTION 3: Tap-to-hide editor (contenteditable)
-------------------------- */
const t3 = document.getElementById("t3");

function clearBlanks3() {
  if (!t3) return;
  t3.querySelectorAll("span.blank").forEach((sp) => {
    const ans = sp.dataset.answer || ""; // custom data via dataset [web:615]
    sp.replaceWith(document.createTextNode(ans));
  });
}

function editorToCard3() {
  if (!t3) return { error: "Editor missing." };

  const answers = [];
  const parts = [];

  t3.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.matches("span.blank")) {
      answers.push(node.dataset.answer || "");
      parts.push("____");
    } else {
      parts.push(node.textContent || "");
    }
  });

  const question = parts.join("").replace(/s+/g, " ").trim();
  return makeCardFromQA(question, answers);
}

function toggleWordAtTap(e) {
  if (!t3) return;

  const sel = window.getSelection && window.getSelection();
  if (sel && !sel.isCollapsed) return;

  const target = e.target;

  if (target && target.matches && target.matches("span.blank")) {
    const ans = target.dataset.answer || "";
    target.replaceWith(document.createTextNode(ans));
    return;
  }

  const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
  if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) return;

  const textNode = range.startContainer;
  const text = textNode.textContent || "";
  const idx = range.startOffset;

  const isWordChar = (ch) => /[A-Za-z0-9À-ÿ'_’-]/.test(ch);
  let L = idx, R = idx;
  while (L > 0 && isWordChar(text[L - 1])) L--;
  while (R < text.length && isWordChar(text[R])) R++;

  const word = text.slice(L, R).trim();
  if (!word) return;

  const before = document.createTextNode(text.slice(0, L));
  const after = document.createTextNode(text.slice(R));

  const sp = document.createElement("span");
  sp.className = "blank";
  sp.dataset.answer = word; // dataset stores answer [web:615]
  sp.textContent = "____";

  const parent = textNode.parentNode;
  parent.insertBefore(before, textNode);
  parent.insertBefore(sp, textNode);
  parent.insertBefore(after, textNode);
  parent.removeChild(textNode);
}

if (t3) t3.addEventListener("pointerup", toggleWordAtTap);

document.getElementById("t3Clear")?.addEventListener("click", () => {
  clearBlanks3();
  setStatus("s3", "Cleared blanks.");
});

document.getElementById("t3Add")?.addEventListener("click", () => {
  const card = editorToCard3();
  if (card.error) return setStatus("s3", card.error, false);

  const cards = loadCards(K3);
  cards.push(card);
  saveCards(cards, K3);
  if (t3) t3.textContent = "";
  setStatus("s3", "Added.");
  renderInto(K3, "r3");
});

/* -------------------------
   OPTION 4: Blank at end + answer
-------------------------- */
const t4 = document.getElementById("t4");
const t4Answer = document.getElementById("t4Answer");

document.getElementById("t4Blank")?.addEventListener("click", () => {
  if (!t4) return;
  const v = t4.value || "";
  t4.value = v + (v && !v.endsWith(" ") ? " " : "") + "____";
  t4.focus();
  setStatus("s4", "Appended blank. Type the answer below.");
});

document.getElementById("t4Add")?.addEventListener("click", () => {
  if (!t4 || !t4Answer) return;
  const card = makeCardFromQA(t4.value, [t4Answer.value]);
  if (card.error) return setStatus("s4", card.error, false);

  const cards = loadCards(K4);
  cards.push(card);
  saveCards(cards, K4);
  t4.value = "";
  t4Answer.value = "";
  setStatus("s4", "Added.");
  renderInto(K4, "r4");
});

/* -------------------------
   Service worker update UX
-------------------------- */
function showUpdateBanner(reg) {
  const banner = document.getElementById("updateBanner");
  const btn = document.getElementById("btnUpdateNow");
  if (!banner || !btn) return;

  banner.hidden = false;

  btn.onclick = () => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  }, { once: true });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      // Ask browser to check for an updated SW script [web:669]
      try { await reg.update(); } catch { /* ignore */ }

      // If an update is already waiting, show banner immediately
      if (reg.waiting) showUpdateBanner(reg);

      // Detect when a new SW is being installed [web:668]
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      });
    } catch {
      // ignore
    }
  });
}

/* Initial renders */
renderOriginal();
renderInto(K1, "r1");
renderInto(K2, "r2");
renderInto(K3, "r3");
renderInto(K4, "r4");
