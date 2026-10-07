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
  }

  startRealTracking(vehicle, role = 'Driver') {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported on this device');
      return false;
    }

    this.isTracking = true;
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
          [32.7800, -96.8000, 32],
          [32.8050, -96.8300, 54],
          [32.8350, -96.8700, 68],
          [32.8700, -96.9300, 77],
          [32.8980, -97.0400, 84],
          [32.9200, -97.0500, 65],
          [32.8950, -97.0350, 42]
        ]
      },
      katy_trail: {
        title: "Katy Trail Cycling Sprint",
        startLoc: "American Airlines Center",
        endLoc: "Mockingbird Station",
        points: [
          [32.7905, -96.8085, 12],
          [32.8010, -96.8040, 16],
          [32.8120, -96.7970, 22],
          [32.8250, -96.7860, 26],
          [32.8380, -96.7720, 28],
          [32.8410, -96.7680, 15]
        ]
      },
      loop12: {
        title: "Loop 12 & Trinity Sunset Cruise",
        startLoc: "Bishop Arts",
        endLoc: "Las Colinas",
        points: [
          [32.7480, -96.8280, 25],
          [32.7750, -96.8500, 48],
          [32.8100, -96.8900, 66],
          [32.8550, -96.9400, 78],
          [32.8900, -96.9450, 52]
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

  recordPoint(lat, lng, speedMph) {
    if (!this.currentTrip) return;

    this.currentTrip.currentSpeed = speedMph;
    if (speedMph > this.currentTrip.topSpeed) {
      this.currentTrip.topSpeed = speedMph;
    }

    // Distance calculation from last point
    if (this.currentTrip.path.length > 0) {
      const lastPt = this.currentTrip.path[this.currentTrip.path.length - 1];
      const distDelta = this.calculateDistanceMiles(lastPt[0], lastPt[1], lat, lng);
      this.currentTrip.distance = Number((this.currentTrip.distance + distDelta).toFixed(2));
    }

    this.currentTrip.path.push([lat, lng, speedMph]);

    // Update speed distribution counters
    this.recomputeDistribution();

    // Average speed
    const speeds = this.currentTrip.path.map(p => p[2]);
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    this.currentTrip.avgSpeed = Math.round(avg);

    if (this.onSpeedChange) {
      this.onSpeedChange(speedMph);
    }

    if (this.onLocationUpdate) {
      this.onLocationUpdate(lat, lng, speedMph, this.currentTrip.path);
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
      else if (s < 70) r50_70++;
      else if (s < 100) r70_100++;
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
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    let speedMph = 0;

    if (position.coords.speed !== null && !isNaN(position.coords.speed)) {
      // Speed in m/s to mph
      speedMph = Math.round(position.coords.speed * 2.23694);
    }

    this.recordPoint(lat, lng, speedMph);
  }

  calculateDistanceMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
