/**
 * DFWDrive 3D Map Controller (MapLibre GL JS Engine)
 * Features 3D building extrusion, 60° dynamic drive camera pitch,
 * multi-color speed gradients, and dark/light mode switching.
 */

export class MapController {
  constructor(containerId = 'leafletMap') {
    this.containerId = containerId;
    this.map = null;
    this.isDark = true;
    this.isDriveMode = false;
    this.currentMarker = null;
    this.currentRouteGeojson = null;
    this.routeSourceId = 'dfwdrive-active-route';
    this.heatmapSourceId = 'dfwdrive-heatmap';
    this.activeDrives = [];
    this.playbackMarker = null;
  }

  init() {
    if (this.map || typeof maplibregl === 'undefined') return;

    // Check stored location or start centered, then immediately spawn on user GPS
    const defaultCenter = [-96.8047, 32.7885];

    this.map = new maplibregl.Map({
      container: this.containerId,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: defaultCenter,
      zoom: 13,
      pitch: 0,
      bearing: 0,
      antialias: true,
      attributionControl: false
    });

    this.map.on('load', () => {
      this.setup3DBuildings();
      this.setupRouteLayers();
      this.spawnOnUserLocation();
      if (this.activeDrives.length > 0) {
        this.renderHeatmap(this.activeDrives);
      }
    });

    // Notify listeners when map zooms so 3D vehicle can dynamically match road scale
    this.map.on('zoom', () => {
      if (typeof this.onZoomChange === 'function') {
        this.onZoomChange(this.map.getZoom());
      }
    });

    return this.map;
  }

  spawnOnUserLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.userLocation = { lat: latitude, lng: longitude };
        if (this.map) {
          this.map.flyTo({
            center: [longitude, latitude],
            zoom: 15.5,
            pitch: 35,
            duration: 1800,
            essential: true
          });
        }
      },
      (err) => {
        console.warn('Auto GPS spawn fallback:', err);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  }

  setup3DBuildings() {
    if (!this.map) return;

    // Configure realistic directional lighting for crisp 3D building shading
    try {
      this.map.setLight({
        anchor: 'viewport',
        color: this.isDark ? '#b8c5db' : '#ffffff',
        intensity: this.isDark ? 0.6 : 0.75,
        position: [1.5, 210, 45]
      });
    } catch (e) {
      console.warn('Map light setup:', e);
    }

    // Check if 3D buildings layer already exists
    if (this.map.getLayer('3d-buildings')) return;

    // Find symbol label layer to insert 3D buildings beneath street labels
    const layers = this.map.getStyle()?.layers || [];
    let labelLayerId = null;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
        labelLayerId = layers[i].id;
        break;
      }
    }

    try {
      this.map.addLayer(
        {
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'render_height'], ['get', 'height'], 16],
              0, this.isDark ? '#222a3d' : '#e2e8f0',
              25, this.isDark ? '#2e3952' : '#cbd5e1',
              60, this.isDark ? '#3d4b6b' : '#94a3b8',
              130, this.isDark ? '#536691' : '#64748b'
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13, 0,
              14, ['coalesce', ['get', 'render_height'], ['get', 'height'], 16]
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13, 0,
              14, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
            ],
            'fill-extrusion-opacity': 1.0 // 100% OPAQUE as requested
          }
        },
        labelLayerId
      );
    } catch (e) {
      console.warn('3D building layer setup:', e);
    }
  }

  setupRouteLayers() {
    if (!this.map) return;

    // Active single drive route source & layers
    if (!this.map.getSource(this.routeSourceId)) {
      this.map.addSource(this.routeSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Route glow line
      this.map.addLayer({
        id: `${this.routeSourceId}-glow`,
        type: 'line',
        source: this.routeSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 10,
          'line-opacity': 0.35,
          'line-blur': 3
        }
      });

      // Route core line
      this.map.addLayer({
        id: `${this.routeSourceId}-line`,
        type: 'line',
        source: this.routeSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4.5,
          'line-opacity': 0.95
        }
      });
    }

    // Cumulative heatmap source & layers
    if (!this.map.getSource(this.heatmapSourceId)) {
      this.map.addSource(this.heatmapSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      this.map.addLayer({
        id: `${this.heatmapSourceId}-glow`,
        type: 'line',
        source: this.heatmapSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 8,
          'line-opacity': 0.3
        }
      });

      this.map.addLayer({
        id: `${this.heatmapSourceId}-line`,
        type: 'line',
        source: this.heatmapSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3.5,
          'line-opacity': 0.9
        }
      });
    }
  }

  getSpeedColor(speed, vehicleType = 'car') {
    if (vehicleType === 'bike') {
      if (speed < 12) return '#06b6d4';
      if (speed < 18) return '#10b981';
      if (speed < 24) return '#f59e0b';
      if (speed < 30) return '#ff6b00';
      return '#ef4444';
    }

    if (speed < 30) return '#06b6d4';
    if (speed < 50) return '#10b981';
    if (speed < 70) return '#f59e0b';
    if (speed < 90) return '#ff6b00';
    return '#ef4444';
  }

  renderHeatmap(drives) {
    this.activeDrives = drives || [];
    this.removePlaybackMarker();
    this.clearSingleRoute();

    if (!this.map || !this.map.isStyleLoaded()) return;

    if (!drives || drives.length === 0) {
      const source = this.map.getSource(this.heatmapSourceId);
      if (source) source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features = [];
    const coordinates = [];

    drives.forEach(drive => {
      if (!drive.path || drive.path.length < 2) return;
      const lineCoords = drive.path.map(pt => [pt[1], pt[0]]);
      coordinates.push(...lineCoords);

      features.push({
        type: 'Feature',
        properties: {
          color: drive.vehicleType === 'bike' ? '#10b981' : '#ff7700'
        },
        geometry: {
          type: 'LineString',
          coordinates: lineCoords
        }
      });
    });

    const source = this.map.getSource(this.heatmapSourceId);
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
      this.map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1000 });
    }
  }

  renderSingleDrive(drive) {
    this.removePlaybackMarker();
    if (!this.map || !drive || !drive.path || drive.path.length < 2) return;

    const path = drive.path;
    const features = [];
    const allCoords = [];

    // Speed-segmented features
    for (let i = 0; i < path.length - 1; i++) {
      const pt1 = path[i];
      const pt2 = path[i + 1];
      const speed = pt2[2] !== undefined ? pt2[2] : pt1[2] || 35;
      const color = this.getSpeedColor(speed, drive.vehicleType);

      features.push({
        type: 'Feature',
        properties: { color, speed },
        geometry: {
          type: 'LineString',
          coordinates: [
            [pt1[1], pt1[0]],
            [pt2[1], pt2[0]]
          ]
        }
      });
      allCoords.push([pt1[1], pt1[0]]);
    }
    allCoords.push([path[path.length - 1][1], path[path.length - 1][0]]);

    const source = this.map.getSource(this.routeSourceId);
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }

    // Playback Marker
    const startPt = path[0];
    const el = document.createElement('div');
    el.className = 'playback-vehicle-pin';
    el.innerHTML = `
      <div style="
        width: 30px; height: 30px; border-radius: 50%;
        background: #0084ff; border: 2.5px solid #ffffff;
        box-shadow: 0 0 16px #0084ff; display: flex;
        align-items: center; justify-content: center; font-size: 15px;
      ">${drive.vehicleType === 'bike' ? '🚴' : drive.vehicleType === 'motorcycle' ? '🏍️' : '🏎️'}</div>
    `;

    this.playbackMarker = new maplibregl.Marker({ element: el })
      .setLngLat([startPt[1], startPt[0]])
      .addTo(this.map);

    // Fit camera
    const bounds = allCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
    this.map.fitBounds(bounds, {
      padding: { top: 90, bottom: 90, left: 480, right: 90 },
      maxZoom: 15,
      pitch: 35,
      duration: 1000
    });
  }

  setPlaybackProgress(drive, percent) {
    if (!this.playbackMarker || !drive || !drive.path || drive.path.length < 2) return null;

    const path = drive.path;
    const totalSegments = path.length - 1;
    const targetIdx = percent * totalSegments;
    const lowerIdx = Math.floor(targetIdx);
    const upperIdx = Math.min(lowerIdx + 1, totalSegments);
    const fraction = targetIdx - lowerIdx;

    const p1 = path[lowerIdx];
    const p2 = path[upperIdx];

    const currentLat = p1[0] + (p2[0] - p1[0]) * fraction;
    const currentLng = p1[1] + (p2[1] - p1[1]) * fraction;
    const currentSpeed = Math.round((p1[2] || 0) + ((p2[2] || p1[2] || 0) - (p1[2] || 0)) * fraction);

    this.playbackMarker.setLngLat([currentLng, currentLat]);

    return {
      lat: currentLat,
      lng: currentLng,
      speed: currentSpeed
    };
  }

  clearSingleRoute() {
    const source = this.map?.getSource(this.routeSourceId);
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
  }

  removePlaybackMarker() {
    if (this.playbackMarker) {
      this.playbackMarker.remove();
      this.playbackMarker = null;
    }
  }

  /**
   * Enter 3D Drive Mode: 60° camera pitch, follows position and heading with 3D buildings around
   */
  setDriveMode(isActive) {
    this.isDriveMode = isActive;
    if (!this.map) return;

    if (isActive) {
      this.map.easeTo({
        pitch: 60,
        zoom: 17,
        duration: 1000
      });
    } else {
      this.map.easeTo({
        pitch: 0,
        bearing: 0,
        zoom: 13,
        duration: 1000
      });
    }
  }

  updateLiveLocation(lat, lng, heading = 0, speed = 0, path = []) {
    if (!this.map) return;

    if (this.isDriveMode) {
      this.map.easeTo({
        center: [lng, lat],
        bearing: heading,
        pitch: 60,
        zoom: 17.5,
        duration: 800
      });
    }

    // Update real-time polyline on map
    if (path.length > 1) {
      const lineCoords = path.map(pt => [pt[1], pt[0]]);
      const source = this.map.getSource(this.routeSourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { color: '#0084ff' },
            geometry: { type: 'LineString', coordinates: lineCoords }
          }]
        });
      }
    }
  }

  recenterToUser(onSuccess, onError) {
    if (!navigator.geolocation) {
      if (onError) onError("Géolocalisation non disponible sur cet appareil");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (this.map) {
          this.map.flyTo({
            center: [longitude, latitude],
            zoom: this.isDriveMode ? 17.5 : 16,
            pitch: this.isDriveMode ? 60 : 45,
            duration: 1400,
            essential: true
          });
        }
        if (onSuccess) onSuccess(pos.coords);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        // Fallback to Dallas downtown so user gets immediate visual response
        if (this.map) {
          this.map.flyTo({
            center: [-96.8047, 32.7885],
            zoom: 14,
            pitch: this.isDriveMode ? 60 : 35,
            duration: 1200,
            essential: true
          });
        }
        if (onError) onError("Signal GPS faible ou refusé — Recentrage sur la zone");
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  }

  toggleTheme() {
    if (!this.map) return;
    this.isDark = !this.isDark;
    const styleUrl = this.isDark 
      ? 'https://tiles.openfreemap.org/styles/dark' 
      : 'https://tiles.openfreemap.org/styles/bright';

    this.map.setStyle(styleUrl);
    this.map.once('style.load', () => {
      this.setup3DBuildings();
      this.setupRouteLayers();
      if (this.activeDrives && this.activeDrives.length > 0) {
        this.renderHeatmap(this.activeDrives);
      }
    });

    return this.isDark;
  }
}
