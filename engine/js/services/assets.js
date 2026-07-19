export class AssetResolver {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }

  resolve(path) {
    if (!path) return "";
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return new URL(String(path).replace(/^\/+/, ""), this.baseUrl).href;
  }

  async inspect(path) {
    const url = this.resolve(path);
    try {
      let response = await fetch(url, { method: "HEAD", cache: "no-store", mode: "cors" });
      if (!response.ok && response.status !== 404) {
        response = await fetch(url, {
          headers: { Range: "bytes=0-0" }, cache: "no-store", mode: "cors"
        });
      }
      return {
        path, url, ok: response.ok || response.status === 206,
        status: response.status,
        contentType: response.headers.get("content-type") || "unknown",
        size: Number(response.headers.get("content-length") || 0)
      };
    } catch (error) {
      return { path, url, ok: false, status: 0, error: error.message };
    }
  }
}
