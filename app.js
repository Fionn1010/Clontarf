
const TOUR_CACHE_VERSION = "clontarf-v1";

async function getStops() {
  const response = await fetch("stops.json");
  if (!response.ok) throw new Error("Could not load tour stops.");
  return response.json();
}

function stopCard(stop) {
  return `
    <article class="stop-card">
      <img src="${stop.image}" alt="${stop.title}" loading="lazy">
      <div class="stop-card-content">
        <span class="stop-number">${stop.id}</span>
        <h3>${stop.title}</h3>
        <p>${stop.short}</p>
        <a class="button secondary" href="stop.html?id=${stop.id}">Open stop</a>
      </div>
    </article>`;
}

async function renderStopGrid() {
  const grid = document.querySelector("#stop-grid");
  if (!grid) return;
  try {
    const stops = await getStops();
    grid.innerHTML = stops.map(stopCard).join("");
  } catch (error) {
    grid.innerHTML = `<p>${error.message}</p>`;
  }
}

function updateNetworkStatus() {
  const status = document.querySelector("#network-status");
  if (!status) return;
  status.textContent = navigator.onLine ? "Online" : "Offline mode";
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

renderStopGrid();
updateNetworkStatus();
