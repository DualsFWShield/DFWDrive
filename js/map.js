/**
 * DFWDrive 3D Map Controller (MapLibre GL JS Engine)
 * Features 3D building extrusion, 60° dynamic drive camera pitch,
 * multi-color speed gradients, and dark/light mode switching.
 */

import { StorageService } from './storage.js';

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
    this.stylesCache = { dark: null, bright: null };
  }

  init() {
    if (this.map || typeof maplibregl === 'undefined') return;

    // Pre-fetch both style JSONs in background for instantaneous zero-latency theme switching
    fetch('https://tiles.openfreemap.org/styles/dark').then(r => r.json()).then(j => { this.stylesCache.dark = j; }).catch(() => {});
    fetch('https://tiles.openfreemap.org/styles/bright').then(r => r.json()).then(j => { this.stylesCache.bright = j; }).catch(() => {});

    // Check stored location or start centered, then immediately spawn on user GPS
    const defaultCenter = [2.3522, 48.8566];

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
      this.initCompass();
      if (this.activeDrives.length > 0) {
        this.renderHeatmap(this.activeDrives);
      }
    });

    // Synchronize 3D vehicle screen position continuously to keep it locked to road coordinates
    this.map.on('move', () => this.syncVehicleScreenPosition());
    this.map.on('render', () => this.syncVehicleScreenPosition());

    // Notify listeners when map zooms so 3D vehicle can dynamically match road scale
    this.map.on('zoom', () => {
      this.syncVehicleScreenPosition();
      if (typeof this.onZoomChange === 'function') {
        this.onZoomChange(this.map.getZoom());
      }
    });

    return this.map;
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
        this.deviceCompassHeading = Math.round(heading);
        // If vehicle is stationary, align puck orientation with device compass
        if (this.currentVehicleCoord && (!this.lastSpeed || this.lastSpeed < 3)) {
          this.currentHeading = this.deviceCompassHeading;
          this.updateUserMarker(this.currentVehicleCoord[0], this.currentVehicleCoord[1], undefined, this.deviceCompassHeading);
        }
      }
    };

    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  }

  spawnOnUserLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        this.userLocation = { lat: latitude, lng: longitude };
        this.currentVehicleCoord = [longitude, latitude];
        if (heading !== null && !isNaN(heading) && heading >= 0) {
          this.currentHeading = heading;
        }
        if (this.map) {
          this.map.flyTo({
            center: [longitude, latitude],
            zoom: 15.5,
            pitch: 0,
            bearing: 0,
            duration: 1400,
            essential: true
          });
        }
        this.updateUserMarker(longitude, latitude, undefined, this.currentHeading);
        this.syncVehicleScreenPosition();
      },
      (err) => {
        console.warn('Auto GPS spawn fallback:', err);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  }

  setup3DBuildings() {
    if (!this.map) return;

    // Configure realistic directional lighting with high zenith angle
    // so ALL 4 sides of every building receive lighting and remain clearly distinguishable!
    try {
      this.map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: this.isDark ? 0.95 : 1.1,
        position: [1.2, 210, 30]
      });
    } catch (e) {
      console.warn('Map light setup:', e);
    }

    // Safely remove existing layer if present to allow clean re-addition
    if (this.map.getLayer('3d-buildings')) {
      try { this.map.removeLayer('3d-buildings'); } catch (_) {}
    }

    // Find symbol label layer to insert 3D buildings beneath street labels
    const layers = this.map.getStyle()?.layers || [];
    let labelLayerId = null;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
        labelLayerId = layers[i].id;
        break;
      }
    }

    // Ensure openmaptiles vector source is present
    if (!this.map.getSource('openmaptiles')) {
      return;
    }

    try {
      this.map.addLayer(
        {
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'render_height'], ['get', 'height'], 15],
              0, this.isDark ? '#263245' : '#dbe3ed',
              25, this.isDark ? '#36465f' : '#becddf',
              60, this.isDark ? '#4b6082' : '#a2b6d1',
              130, this.isDark ? '#627ea8' : '#859ec2'
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12, 0,
              13.5, ['coalesce', ['get', 'render_height'], ['get', 'height'], 15]
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12, 0,
              13.5, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
            ],
            // Opaque and slightly transparent: strong architectural presence without being see-through
            'fill-extrusion-opacity': 0.93
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

    if (this.currentMarker) {
      this.currentMarker.getElement().style.display = isActive ? 'none' : 'flex';
    }

    if (isActive) {
      // Pin zoom around map center so scrolling mouse wheel does not shift vehicle off-road
      this.map.scrollZoom.enable({ around: 'center' });
      this.map.touchZoomRotate.enable({ around: 'center' });
      this.map.easeTo({
        pitch: 60,
        zoom: 17.5,
        duration: 1000
      });
      if (!this.map.getLayer('3d-buildings')) {
        this.setup3DBuildings();
      }
      this.syncVehicleScreenPosition();
    } else {
      this.map.scrollZoom.enable();
      this.map.touchZoomRotate.enable();
      this.map.easeTo({
        pitch: 0,
        bearing: 0,
        zoom: 13,
        duration: 1000
      });
    }
  }

  getVehiclePuckSvg(vehicle) {
    const type = vehicle ? vehicle.type : 'car';
    const model3d = vehicle ? (vehicle.model3d || '') : '';

    if (type === 'bike') {
      return `
        <svg width="22" height="30" viewBox="0 0 20 32" fill="none">
          <ellipse cx="10" cy="5" rx="1.8" ry="4" fill="#00f0ff"/>
          <path d="M4 10 L16 10" stroke="#00f0ff" stroke-width="2" stroke-linecap="round"/>
          <line x1="10" y1="10" x2="10" y2="24" stroke="#ffffff" stroke-width="2"/>
          <ellipse cx="10" cy="18" rx="2" ry="3" fill="#0084ff"/>
          <ellipse cx="10" cy="27" rx="1.8" ry="4" fill="#00f0ff"/>
        </svg>
      `;
    }

    if (type === 'motorcycle') {
      return `
        <svg width="22" height="30" viewBox="0 0 22 34" fill="none">
          <ellipse cx="11" cy="5" rx="2.5" ry="4" fill="#1e293b" stroke="#00f0ff" stroke-width="1.2"/>
          <path d="M3 11 L19 11" stroke="#00f0ff" stroke-width="2" stroke-linecap="round"/>
          <path d="M7 12 C 7 12 6 20 8 24 L 14 24 C 16 20 15 12 15 12 Z" fill="#0f172a" stroke="#00f0ff" stroke-width="1"/>
          <ellipse cx="11" cy="18" rx="3" ry="3.5" fill="#ffffff" opacity="0.95"/>
          <ellipse cx="11" cy="28" rx="2.5" ry="4" fill="#1e293b" stroke="#00f0ff" stroke-width="1.2"/>
          <line x1="7" y1="27" x2="15" y2="27" stroke="#ff2a55" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      `;
    }

    if (type === 'suv' || model3d === 'urus' || model3d === 'suv' || model3d === 'pickup' || model3d === 'monstertruck') {
      return `
        <svg width="24" height="32" viewBox="0 0 26 36" fill="none">
          <path d="M5 32 C 4 28 4 22 4 16 C 4 10 6 5 10 2.5 C 11.5 1.5 14.5 1.5 16 2.5 C 20 5 22 10 22 16 C 22 22 22 28 21 32 C 20 34 18 35 13 35 C 8 35 6 34 5 32 Z" fill="#0f172a" stroke="#00f0ff" stroke-width="1.3"/>
          <path d="M6.5 12 C 9 10 17 10 19.5 12 L 18.5 19 C 15 18 11 18 7.5 19 Z" fill="#00f0ff" opacity="0.85"/>
          <rect x="8.5" y="20" width="9" height="5" rx="1" fill="#1e293b" stroke="#00f0ff" stroke-width="0.7" opacity="0.7"/>
          <line x1="7" y1="13" x2="7" y2="28" stroke="#00f0ff" stroke-width="1.2" opacity="0.6"/>
          <line x1="19" y1="13" x2="19" y2="28" stroke="#00f0ff" stroke-width="1.2" opacity="0.6"/>
          <path d="M7.5 26 C 10 25.5 16 25.5 18.5 26 L 18 29 C 15 28.5 11 28.5 8 29 Z" fill="#00f0ff" opacity="0.6"/>
          <ellipse cx="6.5" cy="4" rx="1.6" ry="2" fill="#ffffff"/>
          <ellipse cx="19.5" cy="4" rx="1.6" ry="2" fill="#ffffff"/>
          <line x1="6" y1="33.5" x2="20" y2="33.5" stroke="#ff2a55" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      `;
    }

    // Default Aerodynamic Sports Car Vector Silhouette
    return `
      <svg width="24" height="32" viewBox="0 0 24 36" fill="none">
        <path d="M6 31 C 5 27 5 22 5 18 C 5 12 7 6 10 2.5 C 11 1.2 13 1.2 14 2.5 C 17 6 19 12 19 18 C 19 22 19 27 18 31 C 17 33.5 15.5 34.5 12 34.5 C 8.5 34.5 7 33.5 6 31 Z" fill="#0f172a" stroke="#00f0ff" stroke-width="1.2"/>
        <path d="M9 10 L12 6.5 L15 10" stroke="#00f0ff" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.8"/>
        <path d="M7.5 14 C 9 12 15 12 16.5 14 L 15.5 20 C 13.5 19 10.5 19 8.5 20 Z" fill="#00f0ff" opacity="0.85"/>
        <rect x="8.5" y="20.5" width="7" height="4.5" rx="1.2" fill="#1e293b" stroke="#00f0ff" stroke-width="0.6" opacity="0.7"/>
        <path d="M8.5 25.5 C 10.5 25 13.5 25 15.5 25.5 L 15 28 C 13.5 27.5 10.5 27.5 9 28 Z" fill="#00f0ff" opacity="0.6"/>
        <rect x="6" y="31" width="12" height="2" rx="0.8" fill="#00f0ff" opacity="0.95"/>
        <ellipse cx="7.2" cy="4" rx="1.4" ry="2" fill="#ffffff"/>
        <ellipse cx="16.8" cy="4" rx="1.4" ry="2" fill="#ffffff"/>
        <line x1="7" y1="33" x2="17" y2="33" stroke="#ff2a55" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  updateUserMarker(lng, lat, vehicle = null, heading = null) {
    if (!this.map) return;
    if (heading !== null && heading !== undefined && !isNaN(heading)) {
      this.currentHeading = heading;
    }

    const currentDeg = this.currentHeading || 0;
    const activeVeh = vehicle || StorageService.getActiveVehicle();
    const svgMarkup = this.getVehiclePuckSvg(activeVeh);

    if (!this.currentMarker) {
      const el = document.createElement('div');
      el.className = 'live-user-puck';
      el.id = 'liveUserPuck';
      el.innerHTML = `
        <div class="puck-radar-ring"></div>
        <div class="puck-radar-pulse"></div>
        <div class="puck-heading-layer" id="puckHeadingLayer" style="transform: rotate(${currentDeg}deg);">
          <div class="puck-beam-glow"></div>
          <div class="puck-laser-chevron">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L17 14L10 11L3 14L10 2Z" fill="#00f0ff" />
              <path d="M10 5L14 12L10 10.2L6 12L10 5Z" fill="#ffffff" />
            </svg>
          </div>
        </div>
        <div class="puck-core-chassis" id="puckCoreChassis" style="transform: rotate(${currentDeg}deg);">
          <div class="puck-vehicle-svg" id="puckVehicleSvg">
            ${svgMarkup}
          </div>
        </div>
      `;
      this.currentMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this.currentMarker.setLngLat([lng, lat]);
      const markerEl = this.currentMarker.getElement();

      const headingLayer = markerEl.querySelector('#puckHeadingLayer');
      if (headingLayer) {
        headingLayer.style.transform = `rotate(${currentDeg}deg)`;
      }

      const coreChassis = markerEl.querySelector('#puckCoreChassis');
      if (coreChassis) {
        coreChassis.style.transform = `rotate(${currentDeg}deg)`;
      }

      const svgContainer = markerEl.querySelector('#puckVehicleSvg');
      if (svgContainer && (!this.lastVehId || this.lastVehId !== (activeVeh ? activeVeh.id : null))) {
        this.lastVehId = activeVeh ? activeVeh.id : null;
        svgContainer.innerHTML = svgMarkup;
      }
    }

    if (this.currentMarker) {
      this.currentMarker.getElement().style.display = this.isDriveMode ? 'none' : 'flex';
    }
  }

  setVehicleMarker(vehicle) {
    if (this.currentMarker) {
      const markerEl = this.currentMarker.getElement();
      const svgContainer = markerEl.querySelector('#puckVehicleSvg');
      if (svgContainer) {
        svgContainer.innerHTML = this.getVehiclePuckSvg(vehicle);
      }
    }
  }

  syncVehicleScreenPosition() {
    if (!this.map) return;
    const coord = this.currentVehicleCoord || this.map.getCenter();
    const pt = this.map.project(coord);
    const container = document.getElementById('vehicle3dContainer');
    if (container) {
      container.style.left = `${Math.round(pt.x)}px`;
      container.style.top = `${Math.round(pt.y)}px`;
    }
  }

  updateLiveLocation(lat, lng, heading = 0, speed = 0, path = []) {
    if (!this.map) return;
    this.currentVehicleCoord = [lng, lat];
    this.lastSpeed = speed;
    if (heading !== undefined && heading !== null && !isNaN(heading)) {
      this.currentHeading = heading;
    }

    this.syncVehicleScreenPosition();
    this.updateUserMarker(lng, lat, undefined, this.currentHeading);

    if (this.isDriveMode) {
      const easeOpts = {
        center: [lng, lat],
        pitch: 60,
        zoom: 17.5,
        duration: 800
      };
      // Rotate camera bearing if moving (> 2.5 km/h) or active bearing recorded
      if (speed > 2.5 && heading !== undefined) {
        this.lastActiveBearing = heading;
        easeOpts.bearing = heading;
      } else if (this.lastActiveBearing !== undefined) {
        easeOpts.bearing = this.lastActiveBearing;
      }
      this.map.easeTo(easeOpts);
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
    // Request iOS orientation permission if user initiated click
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(res => {
        if (res === 'granted') this.initCompass();
      }).catch(() => {});
    }

    // If vehicle location is already tracked, immediately center smoothly without jarring camera flips
    if (this.currentVehicleCoord && this.map) {
      const [lng, lat] = this.currentVehicleCoord;
      const targetZoom = this.isDriveMode ? 17.5 : Math.max(this.map.getZoom(), 15.5);
      const targetPitch = this.isDriveMode ? 60 : this.map.getPitch();
      const targetBearing = this.isDriveMode ? (this.currentHeading || this.lastActiveBearing || this.map.getBearing()) : this.map.getBearing();

      this.map.flyTo({
        center: [lng, lat],
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        duration: 800,
        essential: true
      });
      if (onSuccess) onSuccess({ latitude: lat, longitude: lng });
    }

    if (!navigator.geolocation) {
      if (onError && !this.currentVehicleCoord) onError("Géolocalisation non disponible sur cet appareil");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        this.userLocation = { lat: latitude, lng: longitude };
        this.currentVehicleCoord = [longitude, latitude];
        if (heading !== null && !isNaN(heading) && heading >= 0) {
          this.currentHeading = Math.round(heading);
        }

        if (this.map) {
          const targetZoom = this.isDriveMode ? 17.5 : Math.max(this.map.getZoom(), 15.5);
          const targetPitch = this.isDriveMode ? 60 : this.map.getPitch();
          const targetBearing = this.isDriveMode ? (this.currentHeading || this.lastActiveBearing || this.map.getBearing()) : this.map.getBearing();

          this.map.flyTo({
            center: [longitude, latitude],
            zoom: targetZoom,
            pitch: targetPitch,
            bearing: targetBearing,
            duration: 900,
            essential: true
          });
        }
        this.updateUserMarker(longitude, latitude, undefined, this.currentHeading);
        this.syncVehicleScreenPosition();
        if (onSuccess) onSuccess(pos.coords);
      },
      (err) => {
        console.warn('Geolocation warning on recenter:', err);
        // Keep current camera center without jumps
        if (this.currentVehicleCoord && this.map) {
          this.map.flyTo({
            center: this.currentVehicleCoord,
            zoom: this.isDriveMode ? 17.5 : Math.max(this.map.getZoom(), 15),
            duration: 600
          });
        }
        if (onError && !this.currentVehicleCoord) {
          onError("Signal GPS introuvable — Vérifiez les permissions");
        } else if (onError) {
          onError("Signal GPS faible — Position conservée");
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  }

  async toggleTheme() {
    if (!this.map) return;
    this.isDark = !this.isDark;
    const themeKey = this.isDark ? 'dark' : 'bright';
    const styleUrl = `https://tiles.openfreemap.org/styles/${themeKey}`;

    const applyNewThemeLayers = () => {
      this.setup3DBuildings();
      this.setupRouteLayers();
      if (this.activeDrives && this.activeDrives.length > 0) {
        this.renderHeatmap(this.activeDrives);
      }
    };

    try {
      let styleData = this.stylesCache[themeKey];
      if (!styleData) {
        const res = await fetch(styleUrl);
        styleData = await res.json();
        this.stylesCache[themeKey] = styleData;
      }

      this.map.setStyle(styleData);
      this.map.once('styledata', applyNewThemeLayers);
      setTimeout(applyNewThemeLayers, 300);
      setTimeout(applyNewThemeLayers, 800);
    } catch (err) {
      console.warn('Style fetch fallback:', err);
      this.map.setStyle(styleUrl);
      this.map.once('styledata', applyNewThemeLayers);
      setTimeout(applyNewThemeLayers, 800);
    }

    return this.isDark;
  }
}
