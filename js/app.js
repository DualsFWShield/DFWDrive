/**
 * DFWDrive Main Application Entrypoint
 */

import { MapController } from './map.js';
import { TrackerEngine } from './tracker.js';
import { UIController } from './ui.js';
import { StorageService } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Leaflet Map
  const mapCtrl = new MapController('leafletMap');
  mapCtrl.init();

  // Clean baseline: ensure no zero-distance test artifacts remain
  const cleanDrives = StorageService.getDrives().filter(d => (d.distance || 0) > 0.05);
  StorageService.saveDrives(cleanDrives);

  let uiCtrl;

  // Initialize GPS/Simulation Tracker Engine
  const trackerEngine = new TrackerEngine({
    onTick: (metrics) => {
      if (uiCtrl) {
        uiCtrl.updateLiveHUDMetrics(metrics);
      }
    },
    onTripStart: (trip) => {
      if (uiCtrl) {
        uiCtrl.showToast(`Trip tracking started!`);
      }
    },
    onTripEnd: (trip) => {
      if (uiCtrl) {
        uiCtrl.showToast(`Trip completed: ${trip.distance} mi`);
        uiCtrl.renderDrivesList();
        uiCtrl.updateQuickMiles();
      }
    },
    onSpeedChange: (speed) => {
      if (uiCtrl) {
        uiCtrl.updateFuturisticSpeedometer(speed);
      }
    },
    onLocationUpdate: (lat, lng, speed, path) => {
      let heading = 0;
      if (path && path.length >= 2) {
        const p1 = path[path.length - 2];
        const p2 = path[path.length - 1];
        const y = Math.sin((p2[1] - p1[1]) * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180);
        const x = Math.cos(p1[0] * Math.PI / 180) * Math.sin(p2[0] * Math.PI / 180) -
                  Math.sin(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.cos((p2[1] - p1[1]) * Math.PI / 180);
        heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      }
      mapCtrl.updateLiveLocation(lat, lng, heading, speed, path);
    }
  });

  // Initialize UI Controller
  uiCtrl = new UIController(mapCtrl, trackerEngine);
  uiCtrl.init();

  // Connect map zoom changes to 3D vehicle road scale
  mapCtrl.onZoomChange = (zoom) => {
    if (uiCtrl && uiCtrl.vehicle3d) {
      uiCtrl.vehicle3d.updateScaleForZoom(zoom);
    }
  };

  // Render initial heatmap of all saved drives
  const initialDrives = StorageService.getDrives();
  mapCtrl.renderHeatmap(initialDrives);

  // Register Progressive Web App (PWA) Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(
      (reg) => console.log('DFWDrive PWA Service Worker active:', reg.scope),
      (err) => console.warn('Service Worker registration skipped:', err)
    );
  }

  // Handle Force Cache Refresh & Update
  const btnRefreshCache = document.getElementById('btnForceRefreshCache');
  if (btnRefreshCache) {
    btnRefreshCache.addEventListener('click', async () => {
      if (uiCtrl) uiCtrl.showToast('Vidage du cache et actualisation...');
      btnRefreshCache.classList.add('is-spinning');

      try {
        // 1. Purge all Service Worker CacheStorage
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }

        // 2. Unregister all active Service Workers to force fresh fetch
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }

        // 3. Purge MapController style memory cache
        if (mapCtrl) {
          mapCtrl.stylesCache = { dark: null, bright: null };
        }

        // 4. Trigger hard reload with timestamp to bypass HTTP cache
        setTimeout(() => {
          const cleanUrl = window.location.origin + window.location.pathname + '?reload=' + Date.now();
          window.location.replace(cleanUrl);
        }, 400);
      } catch (err) {
        console.warn('Cache purge error:', err);
        window.location.reload();
      }
    });
  }
});
