
(async function () {
  const container = document.querySelector("#stop-content");
  const id = Number(new URLSearchParams(location.search).get("id") || 1);
  try {
    const stops = await getStops();
    const stop = stops.find(item => item.id === id) || stops[0];
    document.title = `${stop.title} · Battle of Clontarf`;
    const previous = stops.find(item => item.id === stop.id - 1);
    const next = stops.find(item => item.id === stop.id + 1);

    container.innerHTML = `
      <section class="stop-hero">
        <img src="${stop.image}" alt="${stop.title}">
        <div class="stop-heading">
          <p class="eyebrow">Stop ${stop.id} of ${stops.length}</p>
          <h1>${stop.title}</h1>
          <p class="lede">${stop.subtitle}</p>
        </div>
      </section>
      <section class="content stop-copy">
        <article class="prose">
          ${stop.body.map(paragraph => `<p>${paragraph}</p>`).join("")}
          <nav class="stop-nav">
            ${previous ? `<a class="button secondary" href="stop.html?id=${previous.id}">← Previous</a>` : ""}
            ${next ? `<a class="button secondary" href="stop.html?id=${next.id}">Next stop →</a>` : `<a class="button secondary" href="tour.html">Finish tour</a>`}
          </nav>
        </article>
        <aside class="action-panel">
          <p class="eyebrow">Narrated experience</p>
          <h3>Enter the scene</h3>
          <p class="narration-preview">“${stop.narration}”</p>
          <a class="button primary" href="ar.html?id=${stop.id}">Launch AR scene</a>
          <p class="ar-note">This starter uses the generated scene as an immersive AR-style preview and browser narration. Add a GLB model later in <code>assets/models</code>.</p>
        </aside>
      </section>`;
  } catch (error) {
    container.innerHTML = `<div class="loading">${error.message}</div>`;
  }
})();
