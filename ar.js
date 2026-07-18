
let activeUtterance = null;

function speak(text) {
  if (!("speechSynthesis" in window)) return false;
  speechSynthesis.cancel();
  activeUtterance = new SpeechSynthesisUtterance(text);
  activeUtterance.rate = 0.92;
  activeUtterance.pitch = 0.95;
  activeUtterance.lang = "en-IE";
  speechSynthesis.speak(activeUtterance);
  return true;
}

(async function () {
  const container = document.querySelector("#ar-content");
  const id = Number(new URLSearchParams(location.search).get("id") || 1);
  try {
    const stops = await getStops();
    const stop = stops.find(item => item.id === id) || stops[0];
    document.title = `${stop.title} AR Scene`;

    container.innerHTML = `
      <section class="ar-scene" style="--scene-image:url('${stop.image}')">
        <div class="ar-ui">
          <div class="ar-top">
            <button class="icon-button" id="exit-ar" type="button">← Exit</button>
            <span class="icon-button">Stop ${stop.id} of ${stops.length}</span>
          </div>

          <article class="ar-card">
            <p class="eyebrow">AR scene preview</p>
            <h1>${stop.title}</h1>
            <p>${stop.narration}</p>
            <div class="ar-bottom">
              <button class="button primary" id="play-narration" type="button">Play narration</button>
              <button class="button secondary" id="stop-narration" type="button">Stop audio</button>
            </div>
            <p class="ar-note">For the finished production, replace this preview with a compressed GLB model named <code>scene-${stop.id}.glb</code>. The tour shell, text, narration control and offline cache are already prepared.</p>
          </article>

          <div class="ar-bottom">
            <span class="icon-button">${navigator.onLine ? "Online" : "Offline ready"}</span>
            ${stop.id < stops.length ? `<a class="icon-button" href="ar.html?id=${stop.id + 1}">Next scene →</a>` : `<a class="icon-button" href="tour.html">Finish tour</a>`}
          </div>
        </div>
      </section>`;

    document.querySelector("#exit-ar").addEventListener("click", () => {
      speechSynthesis?.cancel();
      location.href = `stop.html?id=${stop.id}`;
    });
    document.querySelector("#play-narration").addEventListener("click", () => {
      if (!speak(stop.narration)) alert("Narration is not supported by this browser.");
    });
    document.querySelector("#stop-narration").addEventListener("click", () => {
      speechSynthesis?.cancel();
    });

    // Start narration after a user gesture is still required on many mobile browsers.
  } catch (error) {
    container.innerHTML = `<div class="loading">${error.message}</div>`;
  }
})();
