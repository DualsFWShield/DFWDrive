/**
 * DFWDrive Tracking Engine
 * Supports real-time GPS tracking with auto-detection of trip start/stop,
 * plus high-fidelity simulated drives (DFW Highway sprint, Katy Trail cycle, etc.).
 */

export class TrackerEngine {
  constructor({ onTick, onTripStart, onTripEnd, onSpeedChange, onLocationUpdate }) {
    this.onTick = onTick;
    this.onTripStart = onTripStart;
    this.onTripEnd = onTripEnd;
    this.onSpeedChange = onSpeedChange;
    this.onLocationUpdate = onLocationUpdate;

    this.isTracking = false;
    this.isSimulating = false;
    this.simulationTimer = null;
    this.watchId = null;

    // Active trip state
    this.currentTrip = null;
    this.startTime = null;
    this.timerInterval = null;
    this.lastLat = null;
    this.lastLng = null;
    this.lastHeading = 0;
    this.compassHeading = 0;

    this.initCompass();
  }

  initCompass() {
    if (typeof window === 'undefined') return;
    const handleOrientation = (e) => {
      let heading = null;
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        heading = e.webkitCompassHeading;
      } else if (e.alpha !== undefined && e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }
      if (heading !== null && !isNaN(heading)) {
        this.compassHeading = Math.round(heading);
        if (!this.lastHeading || (this.currentTrip && this.currentTrip.currentSpeed === 0)) {
          this.lastHeading = this.compassHeading;
        }
      }
    };

    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  }

  startRealTracking(vehicle, role = 'Driver') {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported on this device');
      return false;
    }

    this.isTracking = true;
    this.lastLat = null;
    this.lastLng = null;
    this.lastHeading = 0;
    this.initTripData(vehicle, role);

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handleGeoUpdate(pos),
      (err) => console.warn('Geolocation error:', err),
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );

    this.startDurationTimer();
    return true;
  }

  startSimulation(presetKey = 'dfw_highway', vehicle, role = 'Driver') {
    this.isTracking = true;
    this.isSimulating = true;
    this.initTripData(vehicle, role);

    const simulationRoutes = {
      dfw_highway: {
        title: "DFW Airport Express Run",
        startLoc: "Dallas Downtown",
        endLoc: "DFW Terminal D",
        points: [
          [32.7800, -96.8000, 50],
          [32.8050, -96.8300, 85],
          [32.8350, -96.8700, 110],
          [32.8700, -96.9300, 125],
          [32.8980, -97.0400, 135],
          [32.9200, -97.0500, 105],
          [32.8950, -97.0350, 70]
        ]
      },
      katy_trail: {
        title: "Katy Trail Cycling Sprint",
        startLoc: "American Airlines Center",
        endLoc: "Mockingbird Station",
        points: [
          [32.7905, -96.8085, 20],
          [32.8010, -96.8040, 26],
          [32.8120, -96.7970, 32],
          [32.8250, -96.7860, 36],
          [32.8380, -96.7720, 30],
          [32.8410, -96.7680, 22]
        ]
      },
      loop12: {
        title: "Loop 12 & Trinity Sunset Cruise",
        startLoc: "Bishop Arts",
        endLoc: "Las Colinas",
        points: [
          [32.7480, -96.8280, 45],
          [32.7750, -96.8500, 75],
          [32.8100, -96.8900, 105],
          [32.8550, -96.9400, 120],
          [32.8900, -96.9450, 80]
        ]
      }
    };

    const route = simulationRoutes[presetKey] || simulationRoutes.dfw_highway;
    this.currentTrip.title = route.title;
    this.currentTrip.startLocation = route.startLoc;
    this.currentTrip.endLocation = route.endLoc;

    let pointIdx = 0;
    const totalPoints = route.points.length;

    this.startDurationTimer();

    this.simulationTimer = setInterval(() => {
      if (pointIdx >= totalPoints) {
        this.stopTracking();
        return;
      }

      const pt = route.points[pointIdx];
      // Add realistic micro jitter to speed
      const jitterSpeed = Math.max(0, Math.round(pt[2] + (Math.random() * 4 - 2)));
      
      this.recordPoint(pt[0], pt[1], jitterSpeed);
      pointIdx++;
    }, 2200);

    return true;
  }

  initTripData(vehicle, role) {
    this.startTime = Date.now();
    this.currentTrip = {
      id: `drive_${Date.now()}`,
      title: "Live Drive",
      date: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date()),
      timestamp: this.startTime,
      vehicleId: vehicle.id,
      vehicleName: vehicle.model,
      vehicleType: vehicle.type,
      role: role || (vehicle.type === 'bike' ? 'Cyclist' : 'Driver'),
      distance: 0,
      durationMinutes: 0,
      topSpeed: 0,
      avgSpeed: 0,
      elevationGain: 40,
      safetyScore: 98,
      startLocation: "Current Location",
      endLocation: "Live Location",
      path: [],
      speedDistribution: {
        under30: 0,
        range30to50: 0,
        range50to70: 0,
        range70to100: 0,
        over100: 0
      }
    };

    if (this.onTripStart) this.onTripStart(this.currentTrip);
  }

  startDurationTimer() {
    this.timerInterval = setInterval(() => {
      if (!this.startTime || !this.currentTrip) return;
      const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
      this.currentTrip.durationMinutes = Math.max(1, Math.round(elapsedSec / 60));
      
      if (this.onTick) {
        this.onTick({
          elapsedSec,
          distance: this.currentTrip.distance,
          speed: this.currentTrip.currentSpeed || 0,
          topSpeed: this.currentTrip.topSpeed
        });
      }
    }, 1000);
  }

  recordPoint(lat, lng, speedKmh, heading = 0) {
    if (!this.currentTrip) return;

    this.currentTrip.currentSpeed = speedKmh;
    if (speedKmh > this.currentTrip.topSpeed) {
      this.currentTrip.topSpeed = speedKmh;
    }

    // Distance calculation from last point in Kilometers
    if (this.currentTrip.path.length > 0) {
      const lastPt = this.currentTrip.path[this.currentTrip.path.length - 1];
      const distDelta = this.calculateDistanceKm(lastPt[0], lastPt[1], lat, lng);
      // Anti-jitter: ignore micro movements (< 5 meters / 0.005 km) when stopped or near zero speed
      if (distDelta >= 0.005 && speedKmh > 2.5) {
        this.currentTrip.distance = Number((this.currentTrip.distance + distDelta).toFixed(2));
      }
    }

    this.currentTrip.path.push([lat, lng, speedKmh]);

    // Update speed distribution counters
    this.recomputeDistribution();

    // Average speed
    const speeds = this.currentTrip.path.map(p => p[2]);
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    this.currentTrip.avgSpeed = Math.round(avg);

    if (this.onSpeedChange) {
      this.onSpeedChange(speedKmh);
    }

    if (this.onLocationUpdate) {
      this.onLocationUpdate(lat, lng, speedKmh, this.currentTrip.path, heading || this.compassHeading || this.lastHeading);
    }
  }

  recomputeDistribution() {
    if (!this.currentTrip || this.currentTrip.path.length === 0) return;

    let under30 = 0, r30_50 = 0, r50_70 = 0, r70_100 = 0, r100 = 0;
    const total = this.currentTrip.path.length;

    this.currentTrip.path.forEach(pt => {
      const s = pt[2];
      if (s < 30) under30++;
      else if (s < 50) r30_50++;
      else if (s < 80) r50_70++;
      else if (s < 110) r70_100++;
      else r100++;
    });

    this.currentTrip.speedDistribution = {
      under30: Math.round((under30 / total) * 100),
      range30to50: Math.round((r30_50 / total) * 100),
      range50to70: Math.round((r50_70 / total) * 100),
      range70to100: Math.round((r70_100 / total) * 100),
      over100: Math.round((r100 / total) * 100)
    };
  }

  handleGeoUpdate(position) {
    if (!position || !position.coords) return;
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const devHeading = position.coords.heading;

    // Discard inaccurate GPS fix (> 35 meters uncertainty)
    if (accuracy && accuracy > 35) {
      return;
    }

    let speedKmh = 0;
    if (position.coords.speed !== null && !isNaN(position.coords.speed) && position.coords.speed > 0.4) {
      // GPS speed is in m/s -> convert to km/h (m/s * 3.6)
      speedKmh = Math.round(position.coords.speed * 3.6);
    }

    // Deadband check if we have a previous fix
    if (this.lastLat !== null && this.lastLng !== null) {
      const distMeters = this.calculateDistanceKm(this.lastLat, this.lastLng, lat, lng) * 1000;

      // When movement is under 6 meters and speed is near 0, user is STATIONARY
      // Prevent GPS jitter from causing zigzags, spinning bearing, or accumulating false distance!
      if (distMeters < 6 && speedKmh < 4) {
        if (this.currentTrip) {
          this.currentTrip.currentSpeed = 0;
        }
        const stationaryHeading = this.compassHeading || this.lastHeading || 0;
        if (this.onSpeedChange) this.onSpeedChange(0);
        if (this.onLocationUpdate) {
          this.onLocationUpdate(this.lastLat, this.lastLng, 0, this.currentTrip ? this.currentTrip.path : [], stationaryHeading);
        }
        return;
      }

      // User is moving: compute forward bearing or use device compass
      if (devHeading !== null && !isNaN(devHeading) && devHeading >= 0 && speedKmh > 3) {
        this.lastHeading = devHeading;
      } else if (distMeters >= 4) {
        const y = Math.sin((lng - this.lastLng) * Math.PI / 180) * Math.cos(lat * Math.PI / 180);
        const x = Math.cos(this.lastLat * Math.PI / 180) * Math.sin(lat * Math.PI / 180) -
                  Math.sin(this.lastLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.cos((lng - this.lastLng) * Math.PI / 180);
        this.lastHeading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      } else if (this.compassHeading) {
        this.lastHeading = this.compassHeading;
      }
    } else {
      if (devHeading !== null && !isNaN(devHeading) && devHeading >= 0) {
        this.lastHeading = devHeading;
      } else if (this.compassHeading) {
        this.lastHeading = this.compassHeading;
      }
    }

    // Smooth coordinates with low-pass filter (30% prev, 70% new)
    let smoothLat = lat;
    let smoothLng = lng;
    if (this.lastLat !== null && this.lastLng !== null) {
      smoothLat = Number((this.lastLat * 0.3 + lat * 0.7).toFixed(7));
      smoothLng = Number((this.lastLng * 0.3 + lng * 0.7).toFixed(7));
    }

    this.lastLat = smoothLat;
    this.lastLng = smoothLng;

    this.recordPoint(smoothLat, smoothLng, speedKmh, this.lastHeading);
  }

  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  calculateDistanceMiles(lat1, lon1, lat2, lon2) {
    return this.calculateDistanceKm(lat1, lon1, lat2, lon2) * 0.621371;
  }

  stopTracking() {
    this.isTracking = false;
    this.isSimulating = false;

    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    const completedTrip = this.currentTrip;
    this.currentTrip = null;

    if (this.onTripEnd && completedTrip) {
      this.onTripEnd(completedTrip);
    }

    return completedTrip;
  }
}
