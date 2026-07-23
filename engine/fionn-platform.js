(function (global) {
  "use strict";

  const VERSION = "1.0.0";

  function normaliseBase(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function joinUrl() {
    return Array.from(arguments)
      .filter(Boolean)
      .map((part, index) => {
        const text = String(part);
        if (index === 0) return text.replace(/\/+$/, "");
        return text.replace(/^\/+|\/+$/g, "");
      })
      .join("/");
  }

  class AssetResolver {
    constructor(config) {
      this.config = config;
      this.r2Base = normaliseBase(config.r2Base);
      this.siteId = config.siteId;
      this.localFallback = config.localFallback !== false;
    }

    resolve(type, value) {
      if (!value) return "";
      const raw = String(value);
      if (/^(https?:|blob:|data:)/i.test(raw)) return raw;

      const folderMap = Object.assign({
        video: "videos",
        videos: "videos",
        model: "models",
        models: "models",
        sound: "sounds",
        audio: "sounds",
        image: "images",
        images: "images",
        language: "lang",
        config: "config"
      }, this.config.assetFolders || {});

      const folder = folderMap[type] || type || "";
      return joinUrl(this.r2Base, this.siteId, folder, raw);
    }

    local(type, value) {
      const folderMap = Object.assign({
        video: "videos",
        model: "models",
        sound: "sounds",
        audio: "sounds",
        image: "images",
        language: "lang"
      }, this.config.assetFolders || {});
      return joinUrl(folderMap[type] || type || "", value);
    }

    applyFallback(element, type, value) {
      if (!element || !this.localFallback || !value) return;
      element.addEventListener("error", () => {
        const fallback = this.local(type, value);
        if (element.dataset.fionnFallbackUsed === "1" || !fallback) return;
        element.dataset.fionnFallbackUsed = "1";
        if ("src" in element) element.src = fallback;
      }, { once: true });
    }
  }

  class CameraToolbar {
    constructor(config) {
      this.config = config;
      this.toolbar = null;
      this.returnScrollY = 0;
      this.modelViewer = null;
      this.mediaStream = null;
    }

    install() {
      if (document.getElementById("fionnCameraToolbar")) return;
      const viewerId = this.config.modelViewerId || "modelViewer";
      this.modelViewer = document.getElementById(viewerId);

      const bar = document.createElement("div");
      bar.id = "fionnCameraToolbar";
      bar.className = "fionn-camera-toolbar";
      bar.setAttribute("aria-label", "AR camera controls");
      bar.innerHTML = `
        <button type="button" data-action="photo" aria-label="Take or save a photo">
          <span aria-hidden="true">📷</span><small>Photo</small>
        </button>
        <button type="button" data-action="selfie" aria-label="Open selfie mode">
          <span aria-hidden="true">🤳</span><small>Selfie</small>
        </button>
        <button type="button" data-action="exit" aria-label="Exit AR">
          <span aria-hidden="true">✕</span><small>Exit</small>
        </button>`;
      document.body.appendChild(bar);
      this.toolbar = bar;

      bar.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        if (action === "exit") this.exit();
        if (action === "photo") this.photo();
        if (action === "selfie") this.selfie();
      });

      this.bindViewer();
      this.bindLifecycle();
    }

    bindViewer() {
      if (!this.modelViewer) return;
      const show = () => this.show();
      this.modelViewer.addEventListener("ar-status", (event) => {
        const status = event.detail && event.detail.status;
        if (status === "session-started") show();
        if (status === "not-presenting" || status === "failed") this.hide();
      });
    }

    bindLifecycle() {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) this.restorePage();
      });
      window.addEventListener("pageshow", () => this.restorePage());
    }

    show() {
      this.returnScrollY = window.scrollY || 0;
      this.toolbar?.classList.add("is-visible");
      document.documentElement.classList.add("fionn-ar-active");
      document.body.classList.add("fionn-ar-active");
    }

    hide() {
      this.toolbar?.classList.remove("is-visible");
      document.documentElement.classList.remove("fionn-ar-active");
      document.body.classList.remove("fionn-ar-active");
      this.restorePage();
    }

    restorePage() {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      requestAnimationFrame(() => window.scrollTo(0, this.returnScrollY));
    }

    exit() {
      try {
        if (this.modelViewer && typeof this.modelViewer.dismissPoster === "function") {
          this.modelViewer.dismissPoster();
        }
      } catch (_) {}
      this.hide();
      window.dispatchEvent(new CustomEvent("fionn:exit-ar"));
    }

    photo() {
      window.dispatchEvent(new CustomEvent("fionn:photo-requested"));
      const message = "Use the phone’s camera button in native AR. The Fionn composite camera will be added in the next camera phase.";
      this.toast(message);
    }

    selfie() {
      window.dispatchEvent(new CustomEvent("fionn:selfie-requested"));
      this.toast("Selfie composite mode is prepared, but native AR cannot switch cameras from the web page.");
    }

    toast(message) {
      let toast = document.getElementById("fionnCameraToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "fionnCameraToast";
        toast.className = "fionn-camera-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("is-visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3800);
    }
  }

  class ProgressiveLoader {
    constructor(resolver) {
      this.resolver = resolver;
      this.loaded = new Set();
    }

    prefetch(type, value) {
      const url = this.resolver.resolve(type, value);
      if (!url || this.loaded.has(url)) return Promise.resolve();
      this.loaded.add(url);

      if (type === "video" || type === "sound" || type === "audio") {
        return fetch(url, { method: "GET", cache: "force-cache", mode: "cors" })
          .then(() => undefined)
          .catch(() => undefined);
      }

      return new Promise((resolve) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = url;
        link.as = type === "model" ? "fetch" : "image";
        link.crossOrigin = "anonymous";
        link.onload = link.onerror = resolve;
        document.head.appendChild(link);
      });
    }

    prefetchStop(stop) {
      if (!stop) return;
      const jobs = [];
      const assets = [
        ["video", stop.video || stop.storyVideo],
        ["model", stop.model || stop.arModel],
        ["sound", stop.sound || stop.audio || stop.narration],
        ["image", stop.image || stop.poster]
      ];
      assets.forEach(([type, value]) => {
        if (value) jobs.push(this.prefetch(type, value));
      });
      return Promise.allSettled(jobs);
    }
  }

  class FionnPlatform {
    constructor(config) {
      this.config = config;
      this.assets = new AssetResolver(config);
      this.camera = new CameraToolbar(config.camera || {});
      this.preloader = new ProgressiveLoader(this.assets);
    }

    async start() {
      this.expose();
      this.camera.install();
      this.rewriteKnownAssets();
      this.registerServiceWorker();
      window.dispatchEvent(new CustomEvent("fionn:ready", {
        detail: { version: VERSION, siteId: this.config.siteId }
      }));
      return this;
    }

    expose() {
      global.Fionn = global.Fionn || {};
      global.Fionn.version = VERSION;
      global.Fionn.platform = this;
      global.Fionn.asset = (type, value) => this.assets.resolve(type, value);
      global.Fionn.prefetchStop = (stop) => this.preloader.prefetchStop(stop);
    }

    rewriteKnownAssets() {
      const mappings = [
        ["video[data-fionn-file]", "video"],
        ["audio[data-fionn-file]", "sound"],
        ["img[data-fionn-file]", "image"],
        ["model-viewer[data-fionn-file]", "model"]
      ];

      mappings.forEach(([selector, type]) => {
        document.querySelectorAll(selector).forEach((element) => {
          const file = element.dataset.fionnFile;
          if (!file) return;
          element.src = this.assets.resolve(type, file);
          this.assets.applyFallback(element, type, file);
        });
      });
    }

    registerServiceWorker() {
      if (!("serviceWorker" in navigator) || this.config.serviceWorker === false) return;
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Fionn service worker registration failed.", error);
      });
    }
  }

  async function loadConfig(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    return response.json();
  }

  async function init(options) {
    const configPath = (options && options.config) || "config/platform.json";
    const loaded = await loadConfig(configPath);
    const config = Object.assign({}, loaded, options || {});
    delete config.config;
    const platform = new FionnPlatform(config);
    return platform.start();
  }

  global.FionnPlatform = {
    VERSION,
    init,
    AssetResolver,
    ProgressiveLoader
  };
})(window);
