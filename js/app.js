const state = {
  stops: [],
  stopIndex: Number(localStorage.getItem("clontarf-stop-index") || 0),
  sequenceIndex: 0,
  videoIndex: 0,
  watchId: null,
  audio: null,
  installPrompt: null,
  devMode: new URLSearchParams(location.search).get("dev") === "1",
  gpsBypassed: false
};

const $ = (id) => document.getElementById(id);

const els = {
  destinationName: $("destinationName"),
  distanceValue: $("distanceValue"),
  gpsStatus: $("gpsStatus"),
  stopNumber: $("stopNumber"),
  stopTitle: $("stopTitle"),
  stopSubtitle: $("stopSubtitle"),
  progressBar: $("progressBar"),
  videoStage: $("videoStage"),
  arStage: $("arStage"),
  instructionStage: $("instructionStage"),
  completionStage: $("completionStage"),
  startVideoButton: $("startVideoButton"),
  arTitle: $("arTitle"),
  arInstruction: $("arInstruction"),
  arViewer: $("arViewer"),
  arCompleteButton: $("arCompleteButton"),
  instructionTitle: $("instructionTitle"),
  instructionText: $("instructionText"),
  instructionContinueButton: $("instructionContinueButton"),
  completionTitle: $("completionTitle"),
  completionText: $("completionText"),
  nextStopButton: $("nextStopButton"),
  enableGpsButton: $("enableGpsButton"),
  arrivedButton: $("arrivedButton"),
  videoModal: $("videoModal"),
  storyVideo: $("storyVideo"),
  videoCounter: $("videoCounter"),
  closeVideoButton: $("closeVideoButton"),
  toast: $("toast"),
  installButton: $("installButton"),
  devPanel: $("devPanel"),
  devPrevious: $("devPrevious"),
  devNext: $("devNext"),
  devReset: $("devReset")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await loadStops();

  state.stopIndex = clamp(state.stopIndex, 0, Math.max(0, state.stops.length - 1));
  renderStop();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }

  if (state.devMode) {
    initialiseDeveloperTools();
  }
}

async function loadStops() {
  try {
    const response = await fetch("config/stops.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.stops = await response.json();
  } catch (error) {
    console.error(error);
    showToast("Could not load config/stops.json.");
    state.stops = [];
  }
}

function bindEvents() {
  els.startVideoButton?.addEventListener("click", startCinematic);
  els.closeVideoButton?.addEventListener("click", closeVideo);
  els.storyVideo?.addEventListener("ended", playNextVideo);
  els.storyVideo?.addEventListener("error", handleVideoError);
  els.arCompleteButton?.addEventListener("click", advanceSequence);
  els.instructionContinueButton?.addEventListener("click", advanceSequence);
  els.nextStopButton?.addEventListener("click", nextStop);
  els.enableGpsButton?.addEventListener("click", enableGps);
  els.arrivedButton?.addEventListener("click", startCinematic);
  els.installButton?.addEventListener("click", installApp);
  els.devPrevious?.addEventListener("click", previousStop);
  els.devNext?.addEventListener("click", nextStop);
  els.devReset?.addEventListener("click", resetTour);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    if (els.installButton) els.installButton.hidden = false;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.videoModal && !els.videoModal.hidden) {
      closeVideo();
    }

    if (!state.devMode || ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) {
      return;
    }

    if (event.key === "ArrowLeft") previousStop();
    if (event.key === "ArrowRight") nextStop();
    if (event.key.toLowerCase() === "a") jumpToFirstAr();
    if (event.key.toLowerCase() === "v") startCinematic();
  });
}

function currentStop() {
  return state.stops[state.stopIndex];
}

function renderStop() {
  const stop = currentStop();
  if (!stop) return;

  state.sequenceIndex = 0;
  state.videoIndex = 0;

  els.destinationName.textContent = stop.title;
  els.stopNumber.textContent = `STOP ${stop.id} OF ${state.stops.length}`;
  els.stopTitle.textContent = stop.title;
  els.stopSubtitle.textContent = stop.subtitle;
  els.progressBar.style.width = `${((state.stopIndex + 1) / state.stops.length) * 100}%`;

  showStage("video");
  localStorage.setItem("clontarf-stop-index", String(state.stopIndex));
  updateDeveloperTools();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function startCinematic() {
  const stop = currentStop();

  if (!stop?.videos?.length) {
    startSequence();
    return;
  }

  state.videoIndex = 0;
  els.videoModal.hidden = false;
  document.body.style.overflow = "hidden";

  if (stop.audio) {
    state.audio = new Audio(stop.audio);
    state.audio.preload = "auto";
    state.audio.play().catch(() => {});
  }

  await loadAndPlayVideo();
}

async function loadAndPlayVideo() {
  const stop = currentStop();
  const source = stop.videos[state.videoIndex];

  els.videoCounter.textContent = `Film ${state.videoIndex + 1} of ${stop.videos.length}`;
  els.storyVideo.src = source;
  els.storyVideo.load();

  try {
    await els.storyVideo.play();

    if (els.storyVideo.requestFullscreen && !document.fullscreenElement) {
      els.storyVideo.requestFullscreen().catch(() => {});
    }
  } catch (error) {
    console.warn("Autoplay/fullscreen unavailable:", error);
    showToast("Tap play to begin the film.");
  }
}

function playNextVideo() {
  const stop = currentStop();
  state.videoIndex += 1;

  if (state.videoIndex < stop.videos.length) {
    loadAndPlayVideo();
    return;
  }

  closeVideo(false);
  startSequence();
}

function handleVideoError() {
  const stop = currentStop();
  const missing = stop?.videos?.[state.videoIndex] || "video file";
  showToast(`Missing asset: ${missing}`);

  state.videoIndex += 1;

  if (state.videoIndex < stop.videos.length) {
    loadAndPlayVideo();
  } else {
    closeVideo(false);
    startSequence();
  }
}

function closeVideo(userClosed = true) {
  els.storyVideo.pause();
  els.storyVideo.removeAttribute("src");
  els.storyVideo.load();
  els.videoModal.hidden = true;
  document.body.style.overflow = "";

  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
    state.audio = null;
  }

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  if (userClosed) {
    showToast("Film closed. Tap Begin this stop to restart.");
  }
}

function startSequence() {
  state.sequenceIndex = 0;
  renderSequenceItem();
}

function renderSequenceItem() {
  const stop = currentStop();
  const item = stop.sequence?.[state.sequenceIndex];

  if (!item) {
    showStage("completion");
    els.completionTitle.textContent =
      state.stopIndex === state.stops.length - 1 ? "Tour complete" : "The story continues";
    els.completionText.textContent =
      state.stopIndex === state.stops.length - 1
        ? "You have completed the Battle of Clontarf experience."
        : "Continue to the next location when you are ready.";
    els.nextStopButton.textContent =
      state.stopIndex === state.stops.length - 1
        ? "Return to first stop"
        : "Continue to next stop";
    updateDeveloperTools();
    return;
  }

  if (item.type === "ar") {
    showStage("ar");
    els.arTitle.textContent = item.title;
    els.arInstruction.textContent = item.instruction;
    els.arViewer.src = item.model;

    if (item.iosModel) {
      els.arViewer.setAttribute("ios-src", item.iosModel);
    } else {
      els.arViewer.removeAttribute("ios-src");
    }

    updateDeveloperTools();
    return;
  }

  if (item.type === "instruction") {
    showStage("instruction");
    els.instructionTitle.textContent = item.title;
    els.instructionText.textContent = item.text;
    updateDeveloperTools();
    return;
  }

  advanceSequence();
}

function advanceSequence() {
  state.sequenceIndex += 1;
  renderSequenceItem();
}

function showStage(name) {
  els.videoStage.hidden = name !== "video";
  els.arStage.hidden = name !== "ar";
  els.instructionStage.hidden = name !== "instruction";
  els.completionStage.hidden = name !== "completion";
}

function nextStop() {
  if (!state.stops.length) return;
  state.stopIndex = state.stopIndex >= state.stops.length - 1 ? 0 : state.stopIndex + 1;
  renderStop();
}

function previousStop() {
  if (!state.stops.length) return;
  state.stopIndex = state.stopIndex <= 0 ? state.stops.length - 1 : state.stopIndex - 1;
  renderStop();
}

function resetTour() {
  localStorage.removeItem("clontarf-stop-index");
  state.stopIndex = 0;
  state.sequenceIndex = 0;
  state.gpsBypassed = false;
  renderStop();
  showToast("Tour reset.");
}

function enableGps() {
  if (state.devMode && state.gpsBypassed) {
    els.distanceValue.textContent = "0";
    els.gpsStatus.textContent = "Developer GPS bypass active.";
    return;
  }

  if (!navigator.geolocation) {
    els.gpsStatus.textContent = "This browser does not support GPS.";
    return;
  }

  els.gpsStatus.textContent = "Requesting your location…";

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
  }

  state.watchId = navigator.geolocation.watchPosition(
    updateDistance,
    (error) => {
      const messages = {
        1: "Location permission was denied.",
        2: "Your location is unavailable.",
        3: "The GPS request timed out."
      };
      els.gpsStatus.textContent = messages[error.code] || "GPS could not be started.";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
  );
}

function updateDistance(position) {
  if (state.gpsBypassed) return;

  const stop = currentStop();
  const target = stop.coordinates;
  const metres = haversineMetres(
    position.coords.latitude,
    position.coords.longitude,
    target.latitude,
    target.longitude
  );

  els.distanceValue.textContent = Math.round(metres);
  els.gpsStatus.textContent =
    metres <= 35
      ? "You are close enough to begin this stop."
      : "Walk toward the destination. Keep the phone clear of buildings and trees where possible.";
}

function haversineMetres(lat1, lon1, lat2, lon2) {
  const radius = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function installApp() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  els.installButton.hidden = true;
}

function initialiseDeveloperTools() {
  if (!els.devPanel) return;

  els.devPanel.hidden = false;
  els.devPanel.innerHTML = `
    <p class="eyebrow">Developer mode</p>
    <h2 style="margin-top:.25rem">Tour test controls</h2>

    <label for="devStopSelect" style="display:block;margin:.8rem 0 .35rem;font-family:Arial,sans-serif">
      Jump to stop
    </label>
    <select id="devStopSelect" style="width:100%;min-height:48px;padding:.7rem;border-radius:10px">
      ${state.stops.map((stop, index) =>
        `<option value="${index}">Stop ${stop.id}: ${escapeHtml(stop.title)}</option>`
      ).join("")}
    </select>

    <div id="devArButtons" class="button-row wrap" style="margin-top:.85rem"></div>

    <div class="button-row wrap">
      <button id="devSkipFilms" class="secondary-button" type="button">Skip films → first AR</button>
      <button id="devGpsBypass" class="secondary-button" type="button">Enable GPS bypass</button>
    </div>

    <div class="button-row wrap">
      <button id="devPreviousNew" class="ghost-button" type="button">Previous stop</button>
      <button id="devNextNew" class="ghost-button" type="button">Next stop</button>
      <button id="devCompletion" class="ghost-button" type="button">Stop complete</button>
      <button id="devResetNew" class="ghost-button" type="button">Reset tour</button>
    </div>

    <p id="devAssetPath" class="status-text" style="word-break:break-all"></p>
    <p class="status-text">
      Keyboard: ← previous stop, → next stop, A first AR, V films.
      Remove <code>?dev=1</code> for the normal visitor view.
    </p>
  `;

  $("devStopSelect").addEventListener("change", (event) => {
    state.stopIndex = Number(event.target.value);
    renderStop();
  });

  $("devSkipFilms").addEventListener("click", jumpToFirstAr);
  $("devGpsBypass").addEventListener("click", toggleGpsBypass);
  $("devPreviousNew").addEventListener("click", previousStop);
  $("devNextNew").addEventListener("click", nextStop);
  $("devCompletion").addEventListener("click", () => {
    state.sequenceIndex = currentStop()?.sequence?.length || 0;
    renderSequenceItem();
  });
  $("devResetNew").addEventListener("click", resetTour);

  updateDeveloperTools();
}

function updateDeveloperTools() {
  if (!state.devMode || !els.devPanel || els.devPanel.hidden) return;

  const select = $("devStopSelect");
  const buttons = $("devArButtons");
  const assetPath = $("devAssetPath");
  const bypassButton = $("devGpsBypass");
  const stop = currentStop();

  if (select) select.value = String(state.stopIndex);
  if (bypassButton) {
    bypassButton.textContent = state.gpsBypassed ? "Disable GPS bypass" : "Enable GPS bypass";
  }

  if (!buttons || !stop) return;

  const arItems = (stop.sequence || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "ar");

  buttons.innerHTML = arItems.length
    ? arItems.map(({ item, index }, arNumber) =>
        `<button class="primary-button dev-ar-jump" data-sequence-index="${index}" type="button">
          Test AR ${arNumber + 1}: ${escapeHtml(item.title)}
        </button>`
      ).join("")
    : `<p class="status-text">No AR scenes are configured for this stop.</p>`;

  buttons.querySelectorAll(".dev-ar-jump").forEach((button) => {
    button.addEventListener("click", () => {
      state.sequenceIndex = Number(button.dataset.sequenceIndex);
      renderSequenceItem();
      document.querySelector("#arStage")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const currentItem = stop.sequence?.[state.sequenceIndex];
  assetPath.textContent =
    currentItem?.type === "ar"
      ? `Current model: ${currentItem.model}`
      : `Current stop: ${stop.title}`;
}

function jumpToFirstAr() {
  const stop = currentStop();
  const firstArIndex = stop?.sequence?.findIndex((item) => item.type === "ar");

  if (firstArIndex === undefined || firstArIndex < 0) {
    showToast("This stop has no AR scene configured.");
    return;
  }

  if (els.videoModal && !els.videoModal.hidden) closeVideo(false);
  state.sequenceIndex = firstArIndex;
  renderSequenceItem();
  document.querySelector("#arStage")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleGpsBypass() {
  state.gpsBypassed = !state.gpsBypassed;

  if (state.gpsBypassed) {
    if (state.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
    els.distanceValue.textContent = "0";
    els.gpsStatus.textContent = "Developer GPS bypass active.";
    showToast("GPS bypass enabled.");
  } else {
    els.distanceValue.textContent = "—";
    els.gpsStatus.textContent = "GPS bypass disabled.";
    showToast("GPS bypass disabled.");
  }

  updateDeveloperTools();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    els.toast.hidden = true;
  }, 4200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* Fionn Heritage expanded developer suite */
function initialiseDeveloperTools() {
  if (!els.devPanel) return;

  Object.assign(state, {
    gpsBypassed: false,
    simulatedHeading: Number(localStorage.getItem('clontarf-dev-heading') || 0),
    assetResults: new Map(),
    loadedModels: new Set(),
    modelLoadMs: null,
    modelLoadStartedAt: 0,
    devLogEntries: [],
    devOriginalStops: JSON.parse(JSON.stringify(state.stops)),
    devFps: 0,
    devFrames: 0,
    devFpsStart: performance.now()
  });

  injectExpandedDevStyles();
  els.devPanel.hidden = false;
  els.devPanel.classList.add('fionn-dev-suite');
  els.devPanel.innerHTML = `
    <div class="dev-head"><div><p class="eyebrow">Developer mode</p><h2>Fionn test console</h2></div><button id="devCollapse" class="dev-btn">Collapse</button></div>
    <div id="devBody">
      <div class="dev-tabs">
        <button class="dev-tab active" data-tab="journey">Journey</button>
        <button class="dev-tab" data-tab="assets">Assets</button>
        <button class="dev-tab" data-tab="simulation">Simulation</button>
        <button class="dev-tab" data-tab="editor">Editor</button>
        <button class="dev-tab" data-tab="console">Console</button>
      </div>

      <section class="dev-panel active" data-panel="journey">
        <label class="dev-label" for="devStopSelect">Jump to stop</label>
        <select id="devStopSelect" class="dev-input">${state.stops.map((s,i)=>`<option value="${i}">Stop ${s.id}: ${escapeHtml(s.title)}</option>`).join('')}</select>
        <div id="devArButtons" class="dev-grid"></div>
        <div class="dev-grid">
          <button id="devSkipFilms" class="dev-primary">Skip films → first AR</button>
          <button id="devReloadModel" class="dev-btn">Reload current GLB</button>
          <button id="devPreviousNew" class="dev-btn">Previous stop</button>
          <button id="devNextNew" class="dev-btn">Next stop</button>
          <button id="devCompletion" class="dev-btn">Stop complete</button>
          <button id="devResetNew" class="dev-danger">Reset tour</button>
        </div>
        <div id="devPerformance" class="dev-metrics"></div>
      </section>

      <section class="dev-panel" data-panel="assets">
        <div class="dev-grid"><button id="devScanAssets" class="dev-primary">Scan current stop</button><button id="devScanAllAssets" class="dev-btn">Scan all stops</button></div>
        <div id="devAssetInspector"></div>
      </section>

      <section class="dev-panel" data-panel="simulation">
        <div class="dev-grid"><button id="devTeleport" class="dev-primary">Teleport to current stop</button><button id="devRealGps" class="dev-btn">Use real GPS</button></div>
        <label class="dev-label">Simulated heading: <strong id="devHeadingValue">${state.simulatedHeading}°</strong></label>
        <input id="devHeading" class="dev-range" type="range" min="0" max="359" value="${state.simulatedHeading}">
        <div class="dev-compass"><span>N</span><div id="devCompassNeedle" class="dev-needle"></div></div>
        <p class="dev-note">The heading simulator exercises directional tour logic. It cannot rotate the physical camera or a native AR session.</p>
      </section>

      <section class="dev-panel" data-panel="editor">
        <p class="dev-note">Edits remain in this browser until you download a replacement <code>stops.json</code>.</p>
        <label class="dev-label">Title</label><input id="editTitle" class="dev-input">
        <label class="dev-label">Subtitle</label><textarea id="editSubtitle" class="dev-input" rows="2"></textarea>
        <div class="dev-two">
          <div><label class="dev-label">Latitude</label><input id="editLatitude" class="dev-input" type="number" step="0.000001"></div>
          <div><label class="dev-label">Longitude</label><input id="editLongitude" class="dev-input" type="number" step="0.000001"></div>
          <div><label class="dev-label">Activation radius (m)</label><input id="editRadius" class="dev-input" type="number" min="5" max="250"></div>
          <div><label class="dev-label">Preferred heading (°)</label><input id="editPreferredHeading" class="dev-input" type="number" min="0" max="359"></div>
        </div>
        <div class="dev-grid"><button id="devApplyEdit" class="dev-primary">Apply changes</button><button id="devRestoreStop" class="dev-btn">Restore stop</button><button id="devExportJson" class="dev-btn">Download stops.json</button><button id="devCopyJson" class="dev-btn">Copy JSON</button></div>
      </section>

      <section class="dev-panel" data-panel="console">
        <div class="dev-grid"><button id="devCopyLog" class="dev-btn">Copy log</button><button id="devClearLog" class="dev-danger">Clear log</button></div>
        <pre id="devConsole" class="dev-console"></pre>
      </section>
    </div>`;

  bindExpandedDevControls();
  bindModelDiagnostics();
  populateDevEditor();
  devLog('Expanded developer suite opened');
  updateDeveloperTools();
  scanCurrentAssets();
  requestAnimationFrame(devFpsFrame);
}

function bindExpandedDevControls() {
  document.querySelectorAll('.dev-tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.dev-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.dev-panel').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`[data-panel="${btn.dataset.tab}"]`)?.classList.add('active');
  }));

  $('devCollapse')?.addEventListener('click', () => {
    const body = $('devBody'); body.hidden = !body.hidden; $('devCollapse').textContent = body.hidden ? 'Expand' : 'Collapse';
  });
  $('devStopSelect')?.addEventListener('change', e => { state.stopIndex = Number(e.target.value); renderStop(); populateDevEditor(); scanCurrentAssets(); });
  $('devSkipFilms')?.addEventListener('click', jumpToFirstAr);
  $('devReloadModel')?.addEventListener('click', reloadCurrentModel);
  $('devPreviousNew')?.addEventListener('click', () => { previousStop(); populateDevEditor(); scanCurrentAssets(); });
  $('devNextNew')?.addEventListener('click', () => { nextStop(); populateDevEditor(); scanCurrentAssets(); });
  $('devCompletion')?.addEventListener('click', () => { state.sequenceIndex = currentStop()?.sequence?.length || 0; renderSequenceItem(); });
  $('devResetNew')?.addEventListener('click', resetTour);
  $('devScanAssets')?.addEventListener('click', () => scanCurrentAssets(true));
  $('devScanAllAssets')?.addEventListener('click', scanAllAssets);
  $('devTeleport')?.addEventListener('click', enableDevTeleport);
  $('devRealGps')?.addEventListener('click', disableDevTeleport);
  $('devHeading')?.addEventListener('input', e => {
    state.simulatedHeading = Number(e.target.value);
    localStorage.setItem('clontarf-dev-heading', String(state.simulatedHeading));
    $('devHeadingValue').textContent = `${state.simulatedHeading}°`;
    $('devCompassNeedle').style.transform = `translateX(-50%) rotate(${state.simulatedHeading}deg)`;
    if (state.gpsBypassed) showDevArrival();
  });
  $('devApplyEdit')?.addEventListener('click', applyDevEditor);
  $('devRestoreStop')?.addEventListener('click', restoreDevStop);
  $('devExportJson')?.addEventListener('click', exportDevJson);
  $('devCopyJson')?.addEventListener('click', copyDevJson);
  $('devCopyLog')?.addEventListener('click', copyDevLog);
  $('devClearLog')?.addEventListener('click', () => { state.devLogEntries = []; updateDevConsole(); });
}

function bindModelDiagnostics() {
  els.arViewer?.addEventListener('load', () => {
    state.modelLoadMs = Math.round(performance.now() - state.modelLoadStartedAt);
    state.loadedModels.add(els.arViewer.src);
    devLog(`Model loaded in ${state.modelLoadMs} ms`);
    updateDeveloperTools();
  });
  els.arViewer?.addEventListener('error', () => devLog(`Model load failed: ${els.arViewer?.src || 'unknown'}`, 'error'));
}

function updateDeveloperTools() {
  if (!state.devMode || !els.devPanel || els.devPanel.hidden) return;
  if ($('devStopSelect')) $('devStopSelect').value = String(state.stopIndex);
  const stop = currentStop();
  const arButtons = $('devArButtons');
  if (arButtons && stop) {
    const items = (stop.sequence || []).map((item,index)=>({item,index})).filter(x=>x.item.type==='ar');
    arButtons.innerHTML = items.length ? items.map((x,i)=>`<button class="dev-primary dev-ar-jump" data-i="${x.index}">Test AR ${i+1}: ${escapeHtml(x.item.title)}</button>`).join('') : '<p class="dev-note">No AR scenes configured.</p>';
    arButtons.querySelectorAll('.dev-ar-jump').forEach(btn => btn.addEventListener('click', () => { state.sequenceIndex = Number(btn.dataset.i); renderSequenceItem(); document.querySelector('#arStage')?.scrollIntoView({behavior:'smooth'}); }));
  }
  const item = stop?.sequence?.[state.sequenceIndex];
  const memory = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'Unavailable';
  if ($('devPerformance')) $('devPerformance').innerHTML = `
    <div><strong>FPS</strong><span>${state.devFps || '—'}</span></div><div><strong>Model load</strong><span>${state.modelLoadMs == null ? '—' : state.modelLoadMs+' ms'}</span></div><div><strong>Models loaded</strong><span>${state.loadedModels?.size || 0}</span></div><div><strong>Network</strong><span>${navigator.connection?.effectiveType || 'unknown'}</span></div><div><strong>JS memory</strong><span>${memory}</span></div><div><strong>GPS</strong><span>${state.gpsBypassed ? 'Teleport' : 'Real'}</span></div><p class="dev-wide"><strong>Current:</strong> ${escapeHtml(item?.type==='ar' ? item.model : 'No AR model open')}</p><p class="dev-note dev-wide">Browsers do not reliably expose GPU or texture memory, so this panel reports only real browser metrics.</p>`;
  if ($('devCompassNeedle')) $('devCompassNeedle').style.transform = `translateX(-50%) rotate(${state.simulatedHeading}deg)`;
  updateAssetInspector(); updateDevConsole();
}

function jumpToFirstAr() {
  const index = currentStop()?.sequence?.findIndex(x => x.type === 'ar');
  if (index == null || index < 0) return showToast('No AR scene is configured for this stop.');
  if (els.videoModal && !els.videoModal.hidden) closeVideo(false);
  state.sequenceIndex = index; renderSequenceItem();
}

function reloadCurrentModel() {
  const item = currentStop()?.sequence?.[state.sequenceIndex];
  if (!item || item.type !== 'ar') return showToast('Open an AR scene first.');
  state.modelLoadStartedAt = performance.now(); state.modelLoadMs = null;
  const joiner = item.model.includes('?') ? '&' : '?';
  els.arViewer.src = `${item.model}${joiner}reload=${Date.now()}`;
  devLog(`Force reloading model: ${item.model}`); showToast('Reloading current GLB without cache.');
}

function collectAssets(stop) {
  const out = [];
  (stop?.videos || []).forEach(path => out.push({type:'Video',path}));
  if (stop?.audio) out.push({type:'Audio',path:stop.audio});
  (stop?.sequence || []).forEach(x => { if (x.type==='ar' && x.model) out.push({type:'GLB',path:x.model}); if (x.type==='ar' && x.iosModel) out.push({type:'USDZ',path:x.iosModel}); });
  return out;
}
async function inspectAsset(asset, force=false) {
  if (!force && state.assetResults.has(asset.path)) return;
  state.assetResults.set(asset.path,{...asset,status:'checking'}); updateAssetInspector();
  try {
    let r = await fetch(asset.path,{method:'HEAD',cache:'no-store'});
    if (!r.ok && r.status !== 404) r = await fetch(asset.path,{headers:{Range:'bytes=0-0'},cache:'no-store'});
    const ok = r.ok || r.status===206;
    state.assetResults.set(asset.path,{...asset,status:ok?'ok':'missing',http:r.status,typeHeader:r.headers.get('content-type')||'unknown',size:Number(r.headers.get('content-length')||0)});
    devLog(`${ok?'Asset OK':'Asset missing'}: ${asset.path}${r.status?' ('+r.status+')':''}`, ok?'info':'error');
  } catch(e) { state.assetResults.set(asset.path,{...asset,status:'error',error:e.message}); devLog(`Asset error: ${asset.path} — ${e.message}`,'error'); }
  updateAssetInspector();
}
async function scanCurrentAssets(force=false) { await Promise.all(collectAssets(currentStop()).map(a=>inspectAsset(a,force))); }
async function scanAllAssets() { const all=[...new Map(state.stops.flatMap(collectAssets).map(a=>[a.path,a])).values()]; await Promise.all(all.map(a=>inspectAsset(a,true))); updateAssetInspector(true); }
function updateAssetInspector(showAll=false) {
  const box=$('devAssetInspector'); if(!box) return;
  const rows=showAll ? [...state.assetResults.values()] : collectAssets(currentStop()).map(a=>state.assetResults.get(a.path)||{...a,status:'not checked'});
  box.innerHTML=rows.map(a=>{const icon={ok:'✅',missing:'❌',error:'⚠️',checking:'⏳','not checked':'•'}[a.status]||'•'; const detail=a.status==='ok'?`${a.typeHeader}${a.size?' · '+formatDevBytes(a.size):''}`:a.status==='missing'?`HTTP ${a.http}`:(a.error||a.status); return `<div class="dev-asset"><span>${icon}</span><div><strong>${escapeHtml(a.type)}</strong><code>${escapeHtml(a.path)}</code><small>${escapeHtml(detail)}</small></div></div>`;}).join('')||'<p class="dev-note">No assets configured.</p>';
}

function enableDevTeleport() { state.gpsBypassed=true; if(state.watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(state.watchId);state.watchId=null;} showDevArrival(); devLog(`Teleported to stop ${currentStop().id}`); updateDeveloperTools(); }
function disableDevTeleport() { state.gpsBypassed=false; els.distanceValue.textContent='—'; els.gpsStatus.textContent='Teleport disabled. Enable GPS to use the real location.'; devLog('Real GPS mode restored'); updateDeveloperTools(); }
function showDevArrival() { els.distanceValue.textContent='0'; els.gpsStatus.textContent=`Developer teleport: Stop ${currentStop().id}, heading ${state.simulatedHeading}°.`; }

function populateDevEditor() { const s=currentStop(); if(!s||!$('editTitle')) return; $('editTitle').value=s.title||''; $('editSubtitle').value=s.subtitle||''; $('editLatitude').value=s.coordinates?.latitude??''; $('editLongitude').value=s.coordinates?.longitude??''; $('editRadius').value=s.activationRadius??35; $('editPreferredHeading').value=s.preferredHeading??0; }
function applyDevEditor() { const s=currentStop(); const lat=Number($('editLatitude').value), lon=Number($('editLongitude').value); if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180) return showToast('Enter valid coordinates.'); s.title=$('editTitle').value.trim()||s.title; s.subtitle=$('editSubtitle').value.trim(); s.coordinates={latitude:lat,longitude:lon}; s.activationRadius=clamp(Math.round(Number($('editRadius').value)||35),5,250); s.preferredHeading=((Math.round(Number($('editPreferredHeading').value)||0)%360)+360)%360; renderStop(); populateDevEditor(); showToast('Changes applied locally. Download stops.json to keep them.'); devLog(`Edited stop ${s.id}`); }
function restoreDevStop() { state.stops[state.stopIndex]=JSON.parse(JSON.stringify(state.devOriginalStops[state.stopIndex])); renderStop(); populateDevEditor(); showToast('Stop restored from the loaded GitHub version.'); }
function exportDevJson() { const blob=new Blob([JSON.stringify(state.stops,null,2)+'\n'],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download='stops.json';a.click();URL.revokeObjectURL(url);devLog('Downloaded stops.json'); }
async function copyDevJson() { try{await navigator.clipboard.writeText(JSON.stringify(state.stops,null,2));showToast('JSON copied.');}catch{showToast('Clipboard access blocked.');} }

function devLog(message,level='info') { if(!state.devMode||!state.devLogEntries) return; state.devLogEntries.push({time:new Date().toLocaleTimeString('en-IE',{hour12:false}),message,level}); if(state.devLogEntries.length>250) state.devLogEntries.shift(); updateDevConsole(); }
function updateDevConsole() { const box=$('devConsole'); if(box){box.textContent=(state.devLogEntries||[]).map(x=>`${x.time} [${x.level.toUpperCase()}] ${x.message}`).join('\n');box.scrollTop=box.scrollHeight;} }
async function copyDevLog() { try{await navigator.clipboard.writeText((state.devLogEntries||[]).map(x=>`${x.time} [${x.level.toUpperCase()}] ${x.message}`).join('\n'));showToast('Developer log copied.');}catch{showToast('Clipboard access blocked.');} }
function devFpsFrame(now) { if(!state.devMode) return; state.devFrames++; const elapsed=now-state.devFpsStart; if(elapsed>=1000){state.devFps=Math.round(state.devFrames*1000/elapsed);state.devFrames=0;state.devFpsStart=now;updateDeveloperTools();} requestAnimationFrame(devFpsFrame); }
function formatDevBytes(bytes){if(!bytes)return'unknown size';const u=['B','KB','MB','GB'];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1);return`${(bytes/1024**i).toFixed(i?1:0)} ${u[i]}`;}
function injectExpandedDevStyles(){const s=document.createElement('style');s.textContent=`.fionn-dev-suite{max-width:1100px;margin:2rem auto;padding:1rem;background:#101820;color:#f7f7f7;border-radius:16px;box-shadow:0 12px 40px #0005;font-family:Arial,sans-serif}.fionn-dev-suite h2{margin:.2rem 0;color:#fff}.dev-head{display:flex;align-items:center;justify-content:space-between;gap:1rem}.dev-tabs{display:flex;gap:.4rem;overflow-x:auto;margin:1rem 0}.dev-tab,.dev-btn,.dev-primary,.dev-danger{border:0;border-radius:10px;padding:.75rem .9rem;font-weight:700;cursor:pointer}.dev-tab{background:#2b3944;color:#fff;white-space:nowrap}.dev-tab.active{background:#fff;color:#101820}.dev-primary{background:#f1c75b;color:#17120a}.dev-btn{background:#dce4e9;color:#101820}.dev-danger{background:#923737;color:#fff}.dev-panel{display:none}.dev-panel.active{display:block}.dev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.6rem;margin:.8rem 0}.dev-two{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.dev-label{display:block;margin:.75rem 0 .3rem;font-weight:700}.dev-input{box-sizing:border-box;width:100%;min-height:44px;padding:.65rem;border-radius:9px;border:1px solid #64727d;font:inherit}.dev-range{width:100%}.dev-note{color:#c8d0d5;line-height:1.45}.dev-note code{color:#ffe69a}.dev-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.55rem}.dev-metrics>div{background:#1c2831;padding:.7rem;border-radius:10px}.dev-metrics strong,.dev-metrics span{display:block}.dev-metrics span{color:#f1c75b;margin-top:.25rem}.dev-wide{grid-column:1/-1;word-break:break-all}.dev-asset{display:grid;grid-template-columns:30px 1fr;gap:.5rem;padding:.7rem 0;border-bottom:1px solid #34434e}.dev-asset code,.dev-asset small{display:block;margin-top:.25rem;word-break:break-all}.dev-asset small{color:#bbc5cb}.dev-console{min-height:260px;max-height:440px;overflow:auto;background:#05080a;color:#b9f5c4;padding:.8rem;border-radius:10px;white-space:pre-wrap}.dev-compass{position:relative;width:130px;height:130px;margin:1rem auto;border:3px solid #e8edf0;border-radius:50%;display:grid;place-items:start center;padding-top:8px;box-sizing:border-box}.dev-needle{position:absolute;left:50%;top:18px;width:4px;height:48px;background:#f1c75b;transform-origin:50% 47px;border-radius:3px}.dev-needle:before{content:'';position:absolute;left:-6px;top:-4px;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid #f1c75b}@media(max-width:650px){.fionn-dev-suite{margin:1rem .5rem}.dev-two{grid-template-columns:1fr}}`;document.head.appendChild(s);}
