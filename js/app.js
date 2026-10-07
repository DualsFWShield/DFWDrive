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

  // Handle PWA Installation Prompt
  let deferredPrompt = null;
  const btnInstall = document.getElementById('btnInstallPwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'flex';
      btnInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted' && uiCtrl) {
          uiCtrl.showToast('DFWDrive installé sur votre appareil !');
        }
        deferredPrompt = null;
        btnInstall.style.display = 'none';
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.style.display = 'none';
    if (uiCtrl) uiCtrl.showToast('Application DFWDrive installée !');
  });
});
