import { haversineMetres } from "../utils.js";

export class GpsService {
  constructor({ onPosition, onError }) {
    this.watchId = null;
    this.onPosition = onPosition;
    this.onError = onError;
  }

  start(target) {
    if (!navigator.geolocation) {
      this.onError("This browser does not support GPS.");
      return;
    }
    this.stop();
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const metres = haversineMetres(
          position.coords.latitude,
          position.coords.longitude,
          target.latitude,
          target.longitude
        );
        this.onPosition(metres, position);
      },
      (error) => {
        const messages = {
          1: "Location permission was denied.",
          2: "Your location is unavailable.",
          3: "The GPS request timed out."
        };
        this.onError(messages[error.code] || "GPS could not be started.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  }

  stop() {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
