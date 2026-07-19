import { escapeHtml } from "./utils.js";

export function mountDeveloperTools({ panel, app, resolver }) {
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `
    <p class="eyebrow">Developer mode</p>
    <h2>Tour test console</h2>
    <label for="devStopSelect">Jump to stop</label>
    <select id="devStopSelect" style="width:100%;min-height:48px;padding:.7rem;border-radius:10px"></select>
    <div id="devArButtons" class="button-row wrap" style="margin-top:.85rem"></div>
    <div class="button-row wrap">
      <button id="devFilms" class="secondary-button">Play films</button>
      <button id="devGps" class="secondary-button">Simulate arrival</button>
      <button id="devAssets" class="secondary-button">Check assets</button>
    </div>
    <div class="button-row wrap">
      <button id="devPrevious" class="ghost-button">Previous</button>
      <button id="devNext" class="ghost-button">Next</button>
      <button id="devReset" class="ghost-button">Reset</button>
    </div>
    <div id="devResults" class="status-text" style="word-break:break-word"></div>`;

  const select = panel.querySelector("#devStopSelect");
  select.innerHTML = app.stops.map((stop, index) =>
    `<option value="${index}">Stop ${stop.id}: ${escapeHtml(stop.title)}</option>`
  ).join("");

  const render = () => {
    select.value = String(app.stopIndex);
    const stop = app.currentStop();
    const box = panel.querySelector("#devArButtons");
    const arItems = (stop.sequence || []).map((item, index) => ({ item, index }))
      .filter(({ item }) => item.type === "ar");
    box.innerHTML = arItems.length ? arItems.map(({ item, index }, number) =>
      `<button class="primary-button" data-sequence="${index}">AR ${number + 1}: ${escapeHtml(item.title)}</button>`
    ).join("") : `<p class="status-text">No AR scenes configured.</p>`;
    box.querySelectorAll("[data-sequence]").forEach((button) => {
      button.addEventListener("click", () => app.openSequence(Number(button.dataset.sequence)));
    });
  };

  select.addEventListener("change", () => { app.goToStop(Number(select.value)); render(); });
  panel.querySelector("#devFilms").addEventListener("click", () => app.startCinematic());
  panel.querySelector("#devGps").addEventListener("click", () => app.simulateArrival());
  panel.querySelector("#devPrevious").addEventListener("click", () => { app.previousStop(); render(); });
  panel.querySelector("#devNext").addEventListener("click", () => { app.nextStop(); render(); });
  panel.querySelector("#devReset").addEventListener("click", () => { app.reset(); render(); });
  panel.querySelector("#devAssets").addEventListener("click", async () => {
    const results = panel.querySelector("#devResults");
    const stop = app.currentStop();
    const paths = [...(stop.videos || []), stop.audio,
      ...(stop.sequence || []).flatMap((item) => [item.model, item.iosModel])].filter(Boolean);
    results.textContent = "Checking assets…";
    const checks = await Promise.all(paths.map((path) => resolver.inspect(path)));
    results.innerHTML = checks.map((result) =>
      `<p>${result.ok ? "✅" : "❌"} <code>${escapeHtml(result.path)}</code> — ${result.status || result.error}</p>`
    ).join("") || "No assets configured for this stop.";
  });

  render();
  return { render };
}
