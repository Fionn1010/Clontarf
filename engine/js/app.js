import { byId, clamp } from "./utils.js";
import { AssetResolver } from "./services/assets.js";
import { GpsService } from "./services/gps.js";
import { mountDeveloperTools } from "./dev-tools.js";

class HeritageTourApp {
  constructor(config) {
    this.config = config;
    this.resolver = new AssetResolver(config.assetBaseUrl);
    this.stops = [];
    this.stopIndex = Number(localStorage.getItem(config.storageKey) || 0);
    this.sequenceIndex = 0;
    this.videoIndex = 0;
    this.audio = null;
    this.installPrompt = null;
    this.devMode = new URLSearchParams(location.search).get("dev") === "1";
    this.els = Object.fromEntries([
      "destinationName","distanceValue","gpsStatus","stopNumber","stopTitle","stopSubtitle","progressBar",
      "videoStage","arStage","instructionStage","completionStage","startVideoButton","arTitle","arInstruction",
      "arViewer","arCompleteButton","instructionTitle","instructionText","instructionContinueButton",
      "completionTitle","completionText","nextStopButton","enableGpsButton","arrivedButton","videoModal",
      "storyVideo","videoCounter","closeVideoButton","toast","installButton","devPanel"
    ].map((id) => [id, byId(id)]));
    this.gps = new GpsService({
      onPosition: (metres) => this.updateDistance(metres),
      onError: (message) => { this.els.gpsStatus.textContent = message; }
    });
  }

  async init() {
    this.bindEvents();
    await this.loadStops();
    this.stopIndex = clamp(this.stopIndex, 0, Math.max(0, this.stops.length - 1));
    this.renderStop();
    if (this.devMode) this.devTools = mountDeveloperTools({ panel: this.els.devPanel, app: this, resolver: this.resolver });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(this.config.serviceWorkerUrl).catch(console.warn);
    }
  }

  async loadStops() {
    const response = await fetch(this.config.stopsUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load stops: HTTP ${response.status}`);
    this.stops = await response.json();
  }

  bindEvents() {
    this.els.startVideoButton?.addEventListener("click", () => this.startCinematic());
    this.els.closeVideoButton?.addEventListener("click", () => this.closeVideo());
    this.els.storyVideo?.addEventListener("ended", () => this.playNextVideo());
    this.els.storyVideo?.addEventListener("error", () => this.handleVideoError());
    this.els.arCompleteButton?.addEventListener("click", () => this.advanceSequence());
    this.els.instructionContinueButton?.addEventListener("click", () => this.advanceSequence());
    this.els.nextStopButton?.addEventListener("click", () => this.nextStop());
    this.els.enableGpsButton?.addEventListener("click", () => this.enableGps());
    this.els.arrivedButton?.addEventListener("click", () => this.startCinematic());
    this.els.installButton?.addEventListener("click", () => this.install());
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault(); this.installPrompt = event; this.els.installButton.hidden = false;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.els.videoModal.hidden) this.closeVideo();
      if (!this.devMode) return;
      if (event.key === "ArrowLeft") this.previousStop();
      if (event.key === "ArrowRight") this.nextStop();
    });
  }

  currentStop() { return this.stops[this.stopIndex]; }

  renderStop() {
    const stop = this.currentStop(); if (!stop) return;
    this.sequenceIndex = 0; this.videoIndex = 0;
    this.els.destinationName.textContent = stop.title;
    this.els.stopNumber.textContent = `STOP ${stop.id} OF ${this.stops.length}`;
    this.els.stopTitle.textContent = stop.title;
    this.els.stopSubtitle.textContent = stop.subtitle;
    this.els.progressBar.style.width = `${((this.stopIndex + 1) / this.stops.length) * 100}%`;
    this.showStage("video");
    localStorage.setItem(this.config.storageKey, String(this.stopIndex));
    this.devTools?.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async startCinematic() {
    const stop = this.currentStop();
    if (!stop?.videos?.length) return this.startSequence();
    this.videoIndex = 0; this.els.videoModal.hidden = false; document.body.style.overflow = "hidden";
    if (stop.audio) { this.audio = new Audio(this.resolver.resolve(stop.audio)); this.audio.play().catch(() => {}); }
    await this.loadAndPlayVideo();
  }

  async loadAndPlayVideo() {
    const stop = this.currentStop();
    this.els.videoCounter.textContent = `Film ${this.videoIndex + 1} of ${stop.videos.length}`;
    this.els.storyVideo.src = this.resolver.resolve(stop.videos[this.videoIndex]);
    this.els.storyVideo.load();
    try { await this.els.storyVideo.play(); } catch { this.toast("Tap play to begin the film."); }
  }

  playNextVideo() {
    this.videoIndex += 1;
    if (this.videoIndex < this.currentStop().videos.length) return this.loadAndPlayVideo();
    this.closeVideo(false); this.startSequence();
  }

  handleVideoError() {
    this.toast(`Could not load ${this.currentStop().videos[this.videoIndex]}`);
    this.playNextVideo();
  }

  closeVideo(userClosed = true) {
    this.els.storyVideo.pause(); this.els.storyVideo.removeAttribute("src"); this.els.storyVideo.load();
    this.els.videoModal.hidden = true; document.body.style.overflow = "";
    if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; this.audio = null; }
    if (userClosed) this.toast("Film closed. Tap Begin this stop to restart.");
  }

  startSequence() { this.sequenceIndex = 0; this.renderSequenceItem(); }
  openSequence(index) { this.sequenceIndex = index; this.renderSequenceItem(); }

  renderSequenceItem() {
    const item = this.currentStop()?.sequence?.[this.sequenceIndex];
    if (!item) {
      this.showStage("completion");
      const last = this.stopIndex === this.stops.length - 1;
      this.els.completionTitle.textContent = last ? "Tour complete" : "The story continues";
      this.els.completionText.textContent = last ? "You have completed the Battle of Clontarf experience." : "Continue to the next location when you are ready.";
      this.els.nextStopButton.textContent = last ? "Return to first stop" : "Continue to next stop";
      return;
    }
    if (item.type === "ar") {
      this.showStage("ar"); this.els.arTitle.textContent = item.title; this.els.arInstruction.textContent = item.instruction;
      this.els.arViewer.src = this.resolver.resolve(item.model);
      item.iosModel ? this.els.arViewer.setAttribute("ios-src", this.resolver.resolve(item.iosModel)) : this.els.arViewer.removeAttribute("ios-src");
      return;
    }
    if (item.type === "instruction") {
      this.showStage("instruction"); this.els.instructionTitle.textContent = item.title; this.els.instructionText.textContent = item.text; return;
    }
    this.advanceSequence();
  }

  advanceSequence() { this.sequenceIndex += 1; this.renderSequenceItem(); }
  showStage(name) { ["video","ar","instruction","completion"].forEach((stage) => { this.els[`${stage}Stage`].hidden = stage !== name; }); }
  goToStop(index) { this.stopIndex = clamp(index, 0, this.stops.length - 1); this.renderStop(); }
  nextStop() { this.stopIndex = this.stopIndex >= this.stops.length - 1 ? 0 : this.stopIndex + 1; this.renderStop(); }
  previousStop() { this.stopIndex = this.stopIndex <= 0 ? this.stops.length - 1 : this.stopIndex - 1; this.renderStop(); }
  reset() { localStorage.removeItem(this.config.storageKey); this.stopIndex = 0; this.renderStop(); this.toast("Tour reset."); }
  simulateArrival() { this.els.distanceValue.textContent = "0"; this.els.gpsStatus.textContent = "Developer arrival simulation active."; }

  enableGps() {
    this.els.gpsStatus.textContent = "Requesting your location…";
    this.gps.start(this.currentStop().coordinates);
  }

  updateDistance(metres) {
    const radius = this.currentStop().activationRadius || 35;
    this.els.distanceValue.textContent = Math.round(metres);
    this.els.gpsStatus.textContent = metres <= radius ? "You are close enough to begin this stop." : "Walk toward the destination.";
  }

  async install() {
    if (!this.installPrompt) return;
    this.installPrompt.prompt(); await this.installPrompt.userChoice;
    this.installPrompt = null; this.els.installButton.hidden = true;
  }

  toast(message) {
    this.els.toast.textContent = message; this.els.toast.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { this.els.toast.hidden = true; }, 4200);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const config = window.FIONN_TOUR;
  if (!config) throw new Error("tour.config.js did not define window.FIONN_TOUR");
  const app = new HeritageTourApp(config);
  window.fionnTour = app;
  try { await app.init(); } catch (error) { console.error(error); alert("The tour could not start. Check the browser console."); }
});
