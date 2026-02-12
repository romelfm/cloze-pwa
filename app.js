/* -------------------------
   Service worker update UX
-------------------------- */
let reloadingOnSWChange = false;

function setUpdateUI(visible, msg = "") {
  const banner = document.getElementById("updateBanner");
  const btn = document.getElementById("btnUpdateNow");
  const text = document.getElementById("updateText"); // optional, if you have it
  if (!banner || !btn) return;

  banner.hidden = !visible;
  btn.disabled = false;
  btn.textContent = "Update";

  if (text && msg) text.textContent = msg;
}

async function getReg() {
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch {
    return null;
  }
}

async function maybeShowUpdate() {
  const reg = await getReg();
  if (reg && reg.waiting) {
    setUpdateUI(true, "Update available");
    return reg;
  }
  setUpdateUI(false);
  return reg;
}

async function runUpdateFlow() {
  const banner = document.getElementById("updateBanner");
  const btn = document.getElementById("btnUpdateNow");
  if (!banner || !btn) return;

  const reg = await getReg();
  if (!reg?.waiting) {
    // Nothing to activate → hide the useless banner
    setUpdateUI(false);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Updating…";

  // Tell the waiting SW to activate now
  reg.waiting.postMessage({ type: "SKIP_WAITING" });

  // Optional: ask browser to check for updates too
  try { await reg.update(); } catch {}
}

if ("serviceWorker" in navigator) {
  // Reload exactly once when the new SW takes control
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingOnSWChange) return;
    reloadingOnSWChange = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      // Always start hidden (prevents “visible on page load”)
      setUpdateUI(false);

      // If an update is already waiting, show it
      if (reg.waiting) setUpdateUI(true, "Update available");

      // When an update is found, wait until it's installed, then show banner (only for updates, not first install)
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Now there should be a waiting worker
            maybeShowUpdate();
          }
        });
      });

      // Wire the button once
      const btn = document.getElementById("btnUpdateNow");
      if (btn) btn.onclick = runUpdateFlow;

      // Final sanity check shortly after load (covers timing edge cases)
      setTimeout(maybeShowUpdate, 300);
    } catch {
      // ignore
    }
  });
}
