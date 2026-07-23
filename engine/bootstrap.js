(function () {
  "use strict";
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(script);
    });
  }

  async function boot() {
    try {
      await loadScript("engine/fionn-platform.js");
      await window.FionnPlatform.init({ config: "config/platform.json" });
    } catch (error) {
      console.error("Fionn platform boot failed.", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
