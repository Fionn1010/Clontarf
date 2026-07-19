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
