/**
 * DFWDrive UI View Controller
 * Manages 3D Drive mode, futuristic cyber speedometer, vehicle CRUD,
 * profile customization, and responsive drawers.
 */

import { StorageService } from './storage.js';
import { StatsEngine } from './stats.js';
import { LEADERBOARD_USERS } from './data.js';
import { Vehicle3DRenderer } from './vehicle3d.js';

export class UIController {
  constructor(mapController, trackerEngine) {
    this.map = mapController;
    this.tracker = trackerEngine;
    this.vehicle3d = new Vehicle3DRenderer('vehicle3dContainer');

    this.activeTab = 'drives';
    this.activeVehicleFilter = 'all';
    this.activeSortFilter = 'recent';
    this.activeStatsMonth = 'all';
    this.activeLbTab = 'distance';

    this.selectedTrip = null;
    this.playbackInterval = null;
    this.playbackProgress = 0;
    this.isPlaying = false;
    this.selectedAvatarEmoji = '🏎️';
  }

  init() {
    this.cacheDOMElements();
    this.bindEvents();
    this.vehicle3d.init();
    this.loadProfile();
    this.populateHeaderVehicles();
    this.renderDrivesList();
    this.renderGarage();
    this.renderLeaderboards();
    this.updateQuickMiles();
  }

  cacheDOMElements() {
    this.tabs = {
      drives: document.getElementById('tabContentDrives'),
      stats: document.getElementById('tabContentStats'),
      garage: document.getElementById('tabContentGarage'),
      leaderboard: document.getElementById('tabContentLeaderboard')
    };

    this.tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
    this.mainPanel = document.getElementById('mainPanel');
    this.tripDrawer = document.getElementById('tripDetailDrawer');
    this.driveCockpit = document.getElementById('drive3dCockpit');
    this.addVehicleModal = document.getElementById('addVehicleModal');
    this.userProfileModal = document.getElementById('userProfileModal');
    this.toastEl = document.getElementById('toastNotice');
  }

  bindEvents() {
    // Navigation Tabs
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Toggle Main Panel
    const btnTogglePanel = document.getElementById('btnToggleSidePanel');
    if (btnTogglePanel) {
      btnTogglePanel.addEventListener('click', () => {
        this.mainPanel.classList.toggle('is-collapsed');
      });
    }

    // Map Controls: Recenter GPS (Floating + Header)
    const handleRecenter = () => {
      this.showToast('Recherche de votre position GPS...');
      this.map.recenterToUser(
        (coords) => {
          this.showToast('Position GPS actualisée !');
        },
        (msg) => {
          this.showToast(msg);
        }
      );
    };

    const btnRecenter = document.getElementById('btnRecenterMap');
    if (btnRecenter) btnRecenter.addEventListener('click', handleRecenter);
    const headerBtnRecenter = document.getElementById('headerBtnRecenter');
    if (headerBtnRecenter) headerBtnRecenter.addEventListener('click', handleRecenter);

    // Map Controls: Toggle Theme Dark/Light (Floating + Header)
    const handleThemeToggle = () => {
      const isDark = this.map.toggleTheme();
      const iconText = isDark ? '🌙' : '☀️';
      const label = isDark ? 'Mode Nuit 3D activé' : 'Mode Jour 3D activé';
      
      const floatIcon = document.getElementById('floatThemeIcon');
      if (floatIcon) floatIcon.textContent = iconText;
      const headerIcon = document.getElementById('headerThemeIcon');
      if (headerIcon) headerIcon.textContent = iconText;

      this.showToast(label);
    };

    const btnThemeToggle = document.getElementById('btnToggleTileStyle');
    if (btnThemeToggle) btnThemeToggle.addEventListener('click', handleThemeToggle);
    const headerBtnTheme = document.getElementById('headerBtnTheme');
    if (headerBtnTheme) headerBtnTheme.addEventListener('click', handleThemeToggle);

    // Header active vehicle select
    const headerVehSelect = document.getElementById('headerVehicleSelect');
    if (headerVehSelect) {
      headerVehSelect.addEventListener('change', (e) => {
        StorageService.setActiveVehicle(e.target.value);
        this.populateHeaderVehicles();
        this.renderGarage();
        this.update3DVehicleModel();
        this.showToast('Véhicule actif sélectionné');
      });
    }

    // Start / Stop Real Drive
    const btnStartReal = document.getElementById('btnStartRealDrive');
    if (btnStartReal) {
      btnStartReal.addEventListener('click', () => {
        if (!this.tracker.isTracking) {
          this.startDriveSession();
        } else {
          this.stopDriveSession();
        }
      });
    }

    // Exit Cockpit button
    const btnExitCockpit = document.getElementById('btnEndDriveCockpit');
    if (btnExitCockpit) {
      btnExitCockpit.addEventListener('click', () => {
        this.stopDriveSession();
      });
    }

    // Profile Modal
    const btnOpenProfile = document.getElementById('btnOpenProfile');
    const btnCloseProfile = document.getElementById('btnCloseProfileModal');
    const profileForm = document.getElementById('userProfileForm');

    if (btnOpenProfile) {
      btnOpenProfile.addEventListener('click', () => {
        this.openProfileModal();
      });
    }

    if (btnCloseProfile) {
      btnCloseProfile.addEventListener('click', () => {
        this.userProfileModal.classList.remove('is-open');
      });
    }

    // Avatar emoji picker options
    const avatarOpts = document.querySelectorAll('.avatar-opt');
    avatarOpts.forEach(opt => {
      opt.addEventListener('click', () => {
        avatarOpts.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedAvatarEmoji = opt.dataset.emoji;
        const preview = document.getElementById('profileAvatarPreview');
        if (preview) preview.textContent = this.selectedAvatarEmoji;
      });
    });

    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const profile = {
          name: document.getElementById('profileName').value.trim() || 'Driver',
          tag: document.getElementById('profileTag').value.trim() || '@driver',
          avatar: this.selectedAvatarEmoji,
          units: document.getElementById('profileUnits').value,
          bio: document.getElementById('profileBio').value.trim()
        };
        StorageService.saveProfile(profile);
        this.loadProfile();
        this.userProfileModal.classList.remove('is-open');
        this.renderStats();
        this.showToast('Profil mis à jour');
      });
    }

    // Drives Filters
    const vehFilter = document.getElementById('filterVehicleType');
    if (vehFilter) {
      vehFilter.addEventListener('change', (e) => {
        this.activeVehicleFilter = e.target.value;
        this.renderDrivesList();
      });
    }

    const sortChips = document.querySelectorAll('.sort-chip');
    sortChips.forEach(chip => {
      chip.addEventListener('click', () => {
        sortChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeSortFilter = chip.dataset.sort;
        this.renderDrivesList();
      });
    });

    // Time filter chips in Stats
    const timeChips = document.querySelectorAll('.t-chip');
    timeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        timeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeStatsMonth = chip.dataset.month;
        this.renderStats();
      });
    });

    // Leaderboard category tabs
    const lbTabs = document.querySelectorAll('.lb-tab');
    lbTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        lbTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeLbTab = tab.dataset.tab;
        this.renderLeaderboards();
      });
    });

    // Close Trip Detail Drawer
    const btnCloseTrip = document.getElementById('btnCloseTrip');
    if (btnCloseTrip) {
      btnCloseTrip.addEventListener('click', () => this.closeTripDetail());
    }

    // Replay controls
    const btnPlayPause = document.getElementById('btnPlayPause');
    const scrubberSlider = document.getElementById('scrubberSlider');
    if (btnPlayPause && scrubberSlider) {
      btnPlayPause.addEventListener('click', () => this.togglePlayback());
      scrubberSlider.addEventListener('input', (e) => {
        this.setScrubber(parseFloat(e.target.value));
      });
    }

    // Share & Export GPX
    const btnShareTrip = document.getElementById('btnShareTrip');
    if (btnShareTrip) {
      btnShareTrip.addEventListener('click', () => this.handleShareTrip());
    }

    const btnExportGpx = document.getElementById('btnExportGpx');
    if (btnExportGpx) {
      btnExportGpx.addEventListener('click', () => this.handleExportGpx());
    }

    // Delete Trip
    const btnDeleteTrip = document.getElementById('btnDeleteTrip');
    if (btnDeleteTrip) {
      btnDeleteTrip.addEventListener('click', () => this.handleDeleteTrip());
    }

    // Add Vehicle modal
    const btnOpenAddVeh = document.getElementById('btnOpenAddVehicle');
    const btnCloseAddVeh = document.getElementById('btnCloseAddVehicle');
    const addVehicleForm = document.getElementById('addVehicleForm');

    if (btnOpenAddVeh) {
      btnOpenAddVeh.addEventListener('click', () => {
        this.addVehicleModal.classList.add('is-open');
      });
    }

    if (btnCloseAddVeh) {
      btnCloseAddVeh.addEventListener('click', () => {
        this.addVehicleModal.classList.remove('is-open');
      });
    }

    if (addVehicleForm) {
      addVehicleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('newVehType').value;
        const make = document.getElementById('newVehMake').value.trim();
        const model = document.getElementById('newVehModel').value.trim();
        const year = parseInt(document.getElementById('newVehYear').value) || 2024;
        const odo = parseFloat(document.getElementById('newVehOdo').value) || 0;

        const emojis = { car: '🏎️', bike: '🚴', motorcycle: '🏍️', ebike: '⚡', other: '🛴' };

        StorageService.addVehicle({
          type,
          make,
          model,
          year,
          color: '#ff3b30',
          emoji: emojis[type] || '🏎️',
          odometer: odo,
          isPrimary: false
        });

        this.addVehicleModal.classList.remove('is-open');
        addVehicleForm.reset();
        this.populateHeaderVehicles();
        this.renderGarage();
        this.showToast(`Véhicule ${make} ${model} ajouté au garage !`);
      });
    }

    // Trip Detail vehicle selector change
    const tripVehicleSelect = document.getElementById('tripVehicleSelect');
    if (tripVehicleSelect) {
      tripVehicleSelect.addEventListener('change', (e) => {
        if (!this.selectedTrip) return;
        const newVehId = e.target.value;
        const vehicles = StorageService.getVehicles();
        const targetVeh = vehicles.find(v => v.id === newVehId);
        if (targetVeh) {
          this.selectedTrip.vehicleId = targetVeh.id;
          this.selectedTrip.vehicleName = targetVeh.model;
          this.selectedTrip.vehicleType = targetVeh.type;
          StorageService.updateDrive(this.selectedTrip.id, {
            vehicleId: targetVeh.id,
            vehicleName: targetVeh.model,
            vehicleType: targetVeh.type
          });
          this.renderDrivesList();
          this.updateTripDetailHeader(this.selectedTrip);
          this.map.renderSingleDrive(this.selectedTrip);
        }
      });
    }
  }

  loadProfile() {
    const profile = StorageService.getProfile();
    const avatarEl = document.getElementById('headerProfileAvatar');
    if (avatarEl) avatarEl.textContent = profile.avatar || '🏎️';

    const unitEls = [document.getElementById('statsDistUnit'), document.getElementById('liveSpeedUnit')];
    unitEls.forEach(el => {
      if (el) el.textContent = (profile.units || 'mph').toUpperCase();
    });

    const speedUnitEl = document.getElementById('statsSpeedUnit');
    if (speedUnitEl) speedUnitEl.textContent = profile.units || 'mph';
  }

  openProfileModal() {
    const profile = StorageService.getProfile();
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('profileTag').value = profile.tag || '';
    document.getElementById('profileUnits').value = profile.units || 'mph';
    document.getElementById('profileBio').value = profile.bio || '';

    this.selectedAvatarEmoji = profile.avatar || '🏎️';
    const preview = document.getElementById('profileAvatarPreview');
    if (preview) preview.textContent = this.selectedAvatarEmoji;

    document.querySelectorAll('.avatar-opt').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.emoji === this.selectedAvatarEmoji);
    });

    this.userProfileModal.classList.add('is-open');
  }

  startDriveSession() {
    const activeVeh = StorageService.getActiveVehicle();
    if (!activeVeh) {
      this.showToast('Veuillez ajouter un véhicule dans le garage');
      this.switchTab('garage');
      return;
    }

    const started = this.tracker.startRealTracking(activeVeh);
    if (started) {
      this.toggleCockpit(true);
      this.map.setDriveMode(true);
      this.update3DVehicleModel();
      this.updateGpsStatus(true, 'Enregistrement 3D');
      document.getElementById('btnStartDriveLabel').textContent = 'Arrêter';
      this.showToast('Mode Conduite 3D activé');
    } else {
      this.showToast('Erreur GPS : vérifiez vos autorisations de localisation');
    }
  }

  stopDriveSession() {
    if (this.tracker.isTracking) {
      const completed = this.tracker.stopTracking();
      if (completed && completed.path.length > 2 && completed.distance > 0.01) {
        StorageService.addDrive(completed);
        this.renderDrivesList();
        this.updateQuickMiles();
        this.renderStats();
        this.showToast(`Trajet de ${completed.distance} mi sauvegardé !`);
        this.openTripDetail(completed);
      } else {
        this.showToast('Session terminée (aucun déplacement enregistré)');
      }
    }

    this.toggleCockpit(false);
    this.map.setDriveMode(false);
    this.vehicle3d.setSpeed(0);
    this.updateGpsStatus(false, 'Auto-Détection Prête');
    document.getElementById('btnStartDriveLabel').textContent = 'Démarrer le trajet';
  }

  toggleCockpit(show) {
    if (show) {
      this.driveCockpit.classList.add('is-active');
      this.mainPanel.classList.add('is-collapsed');
      if (this.tripDrawer) this.tripDrawer.classList.remove('is-open');
      document.body.classList.remove('drawer-open');
      document.body.classList.add('in-drive-mode');
    } else {
      this.driveCockpit.classList.remove('is-active');
      this.mainPanel.classList.remove('is-collapsed');
      document.body.classList.remove('in-drive-mode');
    }
  }

  update3DVehicleModel() {
    const activeVeh = StorageService.getActiveVehicle();
    if (activeVeh && this.vehicle3d) {
      this.vehicle3d.buildVehicle(activeVeh.type || 'car', 0xff3b30);
      const tag = document.getElementById('cockpitVehicleTag');
      if (tag) tag.textContent = `${activeVeh.emoji} ${activeVeh.make} ${activeVeh.model}`;
    }
  }

  updateFuturisticSpeedometer(speedMph) {
    const profile = StorageService.getProfile();
    const isKmh = profile.units === 'kmh';
    const displaySpeed = isKmh ? Math.round(speedMph * 1.60934) : speedMph;
    const maxSpeed = isKmh ? 240 : 160;

    // Center speed text
    const speedEl = document.getElementById('liveSpeedValue');
    if (speedEl) speedEl.textContent = displaySpeed;

    // Needle-less Cyber Arc fill (stroke-dashoffset from 527.7 to 0)
    const arcEl = document.getElementById('cyberGaugeActiveArc');
    if (arcEl) {
      const fraction = Math.min(1, Math.max(0, displaySpeed / maxSpeed));
      const strokeOffset = 527.7 - (fraction * 527.7);
      arcEl.style.strokeDashoffset = strokeOffset;
    }

    // Dynamic Pace Badge
    const paceEl = document.getElementById('livePaceMode');
    if (paceEl) {
      if (displaySpeed === 0) {
        paceEl.textContent = 'STANDBY';
        paceEl.style.color = '#8e95a5';
      } else if (displaySpeed < (isKmh ? 50 : 30)) {
        paceEl.textContent = 'CRUISE';
        paceEl.style.color = '#10b981';
      } else if (displaySpeed < (isKmh ? 100 : 65)) {
        paceEl.textContent = 'FLOW';
        paceEl.style.color = '#00f0ff';
      } else {
        paceEl.textContent = 'POWER';
        paceEl.style.color = '#ff8800';
      }
    }

    // Update 3D vehicle wheels
    if (this.vehicle3d) {
      this.vehicle3d.setSpeed(speedMph);
    }
  }

  updateLiveHUDMetrics(data) {
    this.updateFuturisticSpeedometer(data.speed || 0);

    const distEl = document.getElementById('liveDistanceValue');
    const timeEl = document.getElementById('liveTimerValue');
    const topEl = document.getElementById('liveTopSpeedVal');

    const profile = StorageService.getProfile();
    const isKmh = profile.units === 'kmh';

    if (distEl && data.distance !== undefined) {
      const distVal = isKmh ? (data.distance * 1.60934).toFixed(1) + ' km' : data.distance.toFixed(1) + ' mi';
      distEl.textContent = distVal;
    }

    if (topEl && data.topSpeed !== undefined) {
      const topVal = isKmh ? Math.round(data.topSpeed * 1.60934) + ' km/h' : data.topSpeed + ' mph';
      topEl.textContent = topVal;
    }

    if (timeEl && data.elapsedSec !== undefined) {
      const hrs = Math.floor(data.elapsedSec / 3600);
      const mins = Math.floor((data.elapsedSec % 3600) / 60);
      const secs = data.elapsedSec % 60;
      timeEl.textContent = hrs > 0
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    Object.values(this.tabs).forEach(section => {
      if (section) section.style.display = 'none';
    });

    if (this.tabs[tabName]) {
      this.tabs[tabName].style.display = 'block';
    }

    if (tabName === 'drives') {
      const drives = StorageService.getDrives();
      this.map.renderHeatmap(drives);
    } else if (tabName === 'stats') {
      this.renderStats();
    } else if (tabName === 'garage') {
      this.renderGarage();
    } else if (tabName === 'leaderboard') {
      this.renderLeaderboards();
    }
  }

  populateHeaderVehicles() {
    const vehicles = StorageService.getVehicles();
    const activeVeh = StorageService.getActiveVehicle();

    const select = document.getElementById('headerVehicleSelect');
    const icon = document.getElementById('headerVehIcon');

    if (select) {
      if (vehicles.length === 0) {
        select.innerHTML = '<option value="">Aucun véhicule</option>';
      } else {
        select.innerHTML = vehicles.map(v => `
          <option value="${v.id}" ${activeVeh && v.id === activeVeh.id ? 'selected' : ''}>
            ${v.emoji} ${v.year} ${v.make} ${v.model}
          </option>
        `).join('');
      }
    }

    if (icon) {
      icon.textContent = activeVeh ? activeVeh.emoji : '🚗';
    }
  }

  updateQuickMiles() {
    const drives = StorageService.getDrives();
    const total = drives.reduce((acc, d) => acc + (d.distance || 0), 0);
    const pill = document.getElementById('quickTotalMiles');
    const profile = StorageService.getProfile();
    const isKmh = profile.units === 'kmh';

    if (pill) {
      const val = isKmh ? Math.round(total * 1.60934) + ' km' : Math.round(total) + ' mi';
      pill.textContent = val;
    }
  }

  renderDrivesList() {
    const container = document.getElementById('drivesTimelineList');
    if (!container) return;

    let drives = StorageService.getDrives();

    // Category filter
    if (this.activeVehicleFilter !== 'all') {
      drives = drives.filter(d => d.vehicleType === this.activeVehicleFilter);
    }

    // Sort
    if (this.activeSortFilter === 'recent') {
      drives.sort((a, b) => b.timestamp - a.timestamp);
    } else if (this.activeSortFilter === 'oldest') {
      drives.sort((a, b) => a.timestamp - b.timestamp);
    } else if (this.activeSortFilter === 'fastest') {
      drives.sort((a, b) => (b.topSpeed || 0) - (a.topSpeed || 0));
    } else if (this.activeSortFilter === 'longest') {
      drives.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    }

    // Clean Empty State
    if (drives.length === 0) {
      container.innerHTML = `
        <div class="drives-empty-state">
          <div class="empty-state-icon">🗺️</div>
          <div class="empty-state-title">Aucun trajet enregistré</div>
          <div class="empty-state-desc">
            DFWDrive commence à enregistrer dès que vous bougez. Lancez votre premier trajet pour tracer votre carte !
          </div>
          <button class="btn-empty-start" id="btnEmptyStartDrive">Démarrer un trajet</button>
        </div>
      `;

      const btnStart = document.getElementById('btnEmptyStartDrive');
      if (btnStart) {
        btnStart.addEventListener('click', () => this.startDriveSession());
      }
      return;
    }

    container.innerHTML = drives.map(drive => {
      const isBike = drive.vehicleType === 'bike' || drive.vehicleType === 'ebike';
      const badgeType = drive.vehicleType.toUpperCase();
      const isActive = this.selectedTrip && this.selectedTrip.id === drive.id;

      return `
        <div class="drive-card-item ${isActive ? 'is-active' : ''}" data-drive-id="${drive.id}">
          <div class="card-left-group">
            <div class="route-sparkline-box">
              ${this.generateRouteSparkline(drive)}
            </div>
            <div class="card-meta-group">
              <div class="card-date-line">
                ${drive.date.split(',')[0]}
                <span class="veh-type-badge ${drive.vehicleType}">${badgeType}</span>
              </div>
              <div class="card-route-sub">${drive.startLocation || 'Départ'} → ${drive.endLocation || 'Arrivée'}</div>
              <div class="card-stats-sub">${drive.distance} mi · ${Math.floor(drive.durationMinutes / 60)}h ${drive.durationMinutes % 60}m</div>
            </div>
          </div>
          <div class="card-right-group">
            <div class="card-speed-num ${isBike ? 'bike-speed' : ''}">${drive.topSpeed}</div>
            <div class="card-speed-label">MPH MAX</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.drive-card-item').forEach(card => {
      card.addEventListener('click', () => {
        const driveId = card.dataset.driveId;
        const targetDrive = drives.find(d => d.id === driveId);
        if (targetDrive) {
          this.openTripDetail(targetDrive);
        }
      });
    });
  }

  generateRouteSparkline(drive) {
    if (!drive.path || drive.path.length < 2) {
      return `<svg viewBox="0 0 100 60"><path d="M 10 30 Q 50 10 90 30" stroke="#0084ff" stroke-width="4" fill="none"/></svg>`;
    }

    const pts = drive.path;
    const lats = pts.map(p => p[0]);
    const lngs = pts.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;

    const svgPoints = pts.map(p => {
      const x = 10 + ((p[1] - minLng) / lngSpan) * 80;
      const y = 50 - ((p[0] - minLat) / latSpan) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const strokeColor = drive.vehicleType === 'bike' ? '#10b981' : '#0084ff';

    return `
      <svg viewBox="0 0 100 60" preserveAspectRatio="none">
        <polyline points="${svgPoints}" fill="none" stroke="${strokeColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  openTripDetail(drive) {
    this.selectedTrip = drive;
    this.playbackProgress = 0;
    this.stopPlayback();

    this.map.renderSingleDrive(drive);
    this.renderDrivesList();
    this.updateTripDetailHeader(drive);

    const vehSelect = document.getElementById('tripVehicleSelect');
    if (vehSelect) {
      const vehicles = StorageService.getVehicles();
      vehSelect.innerHTML = vehicles.map(v => `
        <option value="${v.id}" ${v.id === drive.vehicleId ? 'selected' : ''}>
          ${v.emoji} ${v.make} ${v.model}
        </option>
      `).join('');
    }

    const roleSelect = document.getElementById('tripRoleSelect');
    if (roleSelect) {
      roleSelect.value = drive.role || (drive.vehicleType === 'bike' ? 'Cyclist' : 'Driver');
    }

    document.getElementById('detailDist').textContent = `${drive.distance} mi`;
    const hrs = Math.floor(drive.durationMinutes / 60);
    const mins = drive.durationMinutes % 60;
    document.getElementById('detailDuration').textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    document.getElementById('detailTopSpeed').textContent = `${drive.topSpeed} mph`;
    document.getElementById('replayLiveSpeed').textContent = `${drive.topSpeed} mph`;

    const dist = drive.speedDistribution || { under30: 0, range30to50: 0, range50to70: 0, range70to100: 0, over100: 0 };
    document.getElementById('distU30').style.width = `${dist.under30}%`;
    document.getElementById('dist30_50').style.width = `${dist.range30to50}%`;
    document.getElementById('dist50_70').style.width = `${dist.range50to70}%`;
    document.getElementById('dist70_100').style.width = `${dist.range70to100}%`;
    document.getElementById('distO100').style.width = `${dist.over100}%`;

    document.getElementById('valU30').textContent = `${dist.under30}%`;
    document.getElementById('val30_50').textContent = `${dist.range30to50}%`;
    document.getElementById('val50_70').textContent = `${dist.range50to70}%`;
    document.getElementById('val70_100').textContent = `${dist.range70to100}%`;
    document.getElementById('valO100').textContent = `${dist.over100}%`;

    const scrubber = document.getElementById('scrubberSlider');
    if (scrubber) scrubber.value = 0;

    this.tripDrawer.classList.add('is-open');
    document.body.classList.add('drawer-open');
  }

  updateTripDetailHeader(drive) {
    const icon = drive.vehicleType === 'bike' ? '🚴' : drive.vehicleType === 'motorcycle' ? '🏍️' : '🏎️';
    document.getElementById('tripVehicleEmoji').textContent = icon;
    document.getElementById('tripDateTitle').textContent = drive.date;
    document.getElementById('tripSubtitle').textContent = `${drive.distance} mi • ${drive.durationMinutes}m • ${drive.startLocation || 'DFW'}`;
  }

  closeTripDetail() {
    this.stopPlayback();
    this.tripDrawer.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    this.selectedTrip = null;
    this.renderDrivesList();

    const drives = StorageService.getDrives();
    this.map.renderHeatmap(drives);
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (!this.selectedTrip) return;
    this.isPlaying = true;
    const playBtn = document.getElementById('btnPlayPause');
    if (playBtn) playBtn.innerHTML = '⏸';

    const scrubber = document.getElementById('scrubberSlider');

    this.playbackInterval = setInterval(() => {
      this.playbackProgress += 0.02;
      if (this.playbackProgress >= 1) {
        this.playbackProgress = 0;
      }
      if (scrubber) scrubber.value = this.playbackProgress;
      this.setScrubber(this.playbackProgress);
    }, 120);
  }

  stopPlayback() {
    this.isPlaying = false;
    const playBtn = document.getElementById('btnPlayPause');
    if (playBtn) playBtn.innerHTML = '▶';

    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  setScrubber(progress) {
    this.playbackProgress = progress;
    if (this.selectedTrip) {
      const livePt = this.map.setPlaybackProgress(this.selectedTrip, progress);
      if (livePt) {
        document.getElementById('replayLiveSpeed').textContent = `${livePt.speed} mph`;
      }
    }
  }

  handleShareTrip() {
    if (!this.selectedTrip) return;
    const shareText = `🚗 DFWDrive : Trajet de ${this.selectedTrip.distance} mi avec ${this.selectedTrip.vehicleName} (Vmax : ${this.selectedTrip.topSpeed} mph) !`;
    if (navigator.share) {
      navigator.share({
        title: 'DFWDrive Trip',
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      this.showToast('Résumé copié dans le presse-papier !');
    }
  }

  handleExportGpx() {
    if (!this.selectedTrip || !this.selectedTrip.path) return;
    const gpxPoints = this.selectedTrip.path.map(pt =>
      `<trkpt lat="${pt[0]}" lon="${pt[1]}"><speed>${((pt[2] || 0) * 0.44704).toFixed(2)}</speed></trkpt>`
    ).join('\n');

    const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="DFWDrive">
  <trk>
    <name>${this.selectedTrip.title || 'Trajet DFWDrive'}</name>
    <trkseg>
      ${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dfwdrive_${this.selectedTrip.id}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Fichier GPX téléchargé !');
  }

  handleDeleteTrip() {
    if (!this.selectedTrip) return;
    if (confirm('Voulez-vous supprimer ce trajet de votre historique ?')) {
      StorageService.deleteDrive(this.selectedTrip.id);
      this.closeTripDetail();
      this.renderDrivesList();
      this.updateQuickMiles();
      this.renderStats();
      this.showToast('Trajet supprimé');
    }
  }

  renderStats() {
    const drives = StorageService.getDrives();
    const stats = StatsEngine.compute(drives, this.activeStatsMonth);

    const totalDistEl = document.getElementById('statsTotalDistance');
    if (totalDistEl) totalDistEl.textContent = stats.totalDistance.toLocaleString();

    const avgDistEl = document.getElementById('statsAvgDistance');
    if (avgDistEl) avgDistEl.textContent = `${stats.avgDistance} mi`;

    const topSpeedEl = document.getElementById('statsTopSpeed');
    if (topSpeedEl) topSpeedEl.textContent = stats.topSpeed;

    const milestonesContainer = document.getElementById('statsMilestonesList');
    if (milestonesContainer) {
      milestonesContainer.innerHTML = stats.milestones.map(m => `
        <div class="milestone-item ${m.colorClass} ${m.isCompleted ? 'is-completed' : ''}">
          <div class="milestone-bar-fill" style="width: ${m.progressPercent}%;"></div>
          <div class="milestone-left">
            <div class="milestone-icon">${m.icon}</div>
          </div>
          <div class="milestone-text">
            <span>${m.multiplierText}</span>
            <span class="target-name">${m.label}</span>
          </div>
        </div>
      `).join('');
    }

    const longestContainer = document.getElementById('statsLongestCard');
    if (longestContainer) {
      if (stats.longestDrive) {
        const ld = stats.longestDrive;
        longestContainer.innerHTML = `
          <div class="block-title">Trajet le plus long</div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 50px; height: 32px;">
                ${this.generateRouteSparkline(ld)}
              </div>
              <div>
                <div style="font-size: 15px; font-weight: 800; color: #fff;">${ld.date.split(',')[0]}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${ld.distance} mi · ${Math.floor(ld.durationMinutes / 60)}h ${ld.durationMinutes % 60}m</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 20px; font-weight: 800; color: #ff9800;">${ld.topSpeed}</div>
              <div style="font-size: 9px; font-weight: 700; color: var(--text-muted);">MPH MAX</div>
            </div>
          </div>
        `;
      } else {
        longestContainer.innerHTML = `
          <div class="block-title">Trajet le plus long</div>
          <div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">Aucun trajet enregistré pour le moment.</div>
        `;
      }
    }
  }

  renderGarage() {
    const container = document.getElementById('garageVehicleList');
    if (!container) return;

    const vehicles = StorageService.getVehicles();
    const activeVeh = StorageService.getActiveVehicle();

    if (vehicles.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🚗</div>
          <div style="font-weight: 700; color: #fff;">Votre garage est vide</div>
          <div style="font-size: 13px; margin-top: 4px;">Ajoutez votre premier véhicule pour commencer le suivi.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = vehicles.map(v => {
      const isActive = activeVeh && v.id === activeVeh.id;
      return `
        <div class="garage-card ${isActive ? 'is-active' : ''}" data-veh-id="${v.id}">
          <div class="garage-card-header">
            <div class="veh-info-group">
              <span class="veh-big-emoji">${v.emoji}</span>
              <div>
                <div class="veh-title-text">${v.year} ${v.make} ${v.model}</div>
                <div class="veh-sub-text">${v.type.toUpperCase()} · Odomètre : ${v.odometer.toLocaleString()} mi</div>
              </div>
            </div>

            <div class="garage-header-actions">
              <span class="veh-active-status ${isActive ? 'active' : 'inactive'}" data-select-id="${v.id}">
                ${isActive ? 'Actif' : 'Sélectionner'}
              </span>
              <button class="btn-delete-veh" data-delete-id="${v.id}" title="Supprimer ce véhicule">✕</button>
            </div>
          </div>

          <div class="garage-stats-row">
            <div class="g-stat">
              <span class="g-stat-val">${v.totalDrives || 0}</span>
              <span class="g-stat-lbl">TRAJETS</span>
            </div>
            <div class="g-stat">
              <span class="g-stat-val">${(v.totalDistance || 0).toLocaleString()} mi</span>
              <span class="g-stat-lbl">DISTANCE</span>
            </div>
            <div class="g-stat">
              <span class="g-stat-val">${v.type === 'bike' ? 'Zero-Emission' : 'Route'}</span>
              <span class="g-stat-lbl">CONFIG</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach select & delete vehicle handlers
    container.querySelectorAll('.garage-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // If clicking delete button
        if (e.target.closest('.btn-delete-veh')) {
          e.stopPropagation();
          const delId = e.target.closest('.btn-delete-veh').dataset.deleteId;
          if (confirm('Voulez-vous supprimer ce véhicule du garage ?')) {
            StorageService.deleteVehicle(delId);
            this.populateHeaderVehicles();
            this.renderGarage();
            this.update3DVehicleModel();
            this.showToast('Véhicule retiré du garage');
          }
          return;
        }

        // Activate vehicle
        const id = card.dataset.vehId;
        StorageService.setActiveVehicle(id);
        this.populateHeaderVehicles();
        this.renderGarage();
        this.update3DVehicleModel();
        this.showToast('Véhicule actif changé !');
      });
    });
  }

  renderLeaderboards() {
    const listContainer = document.getElementById('leaderboardList');
    const podiumContainer = document.getElementById('leaderboardPodium');
    if (!listContainer || !podiumContainer) return;

    let users = [...LEADERBOARD_USERS];

    if (this.activeLbTab === 'distance') {
      users.sort((a, b) => b.totalDistance - a.totalDistance);
    } else if (this.activeLbTab === 'safety') {
      users.sort((a, b) => b.safeScore - a.safeScore);
    } else if (this.activeLbTab === 'streak') {
      users.sort((a, b) => b.activeDays - a.activeDays);
    }

    const top3 = [users[1], users[0], users[2]];
    const podiumRanks = [2, 1, 3];
    const colClasses = ['second', 'first', 'third'];

    podiumContainer.innerHTML = top3.map((u, i) => {
      if (!u) return '';
      const metricVal = this.activeLbTab === 'distance'
        ? `${u.totalDistance.toLocaleString()} mi`
        : this.activeLbTab === 'safety' ? `${u.safeScore} Pts` : `${u.activeDays} Jours`;

      return `
        <div class="podium-col ${colClasses[i]}">
          <div class="podium-avatar-ring">
            <div class="podium-avatar-circle">${u.avatar}</div>
            <div class="podium-rank-tag">${podiumRanks[i]}</div>
          </div>
          <div class="podium-driver-name">${u.name}</div>
          <div class="podium-driver-score">${metricVal}</div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = users.slice(3).map((u, index) => {
      const metricVal = this.activeLbTab === 'distance'
        ? `${u.totalDistance.toLocaleString()} mi`
        : this.activeLbTab === 'safety' ? `${u.safeScore} Pts` : `${u.activeDays} Jours`;

      return `
        <div class="lb-row ${u.isCurrent ? 'is-me' : ''}">
          <div class="lb-row-left">
            <div class="lb-row-rank">${index + 4}</div>
            <div style="font-size: 20px;">${u.avatar}</div>
            <div class="lb-row-driver">
              <div class="lb-driver-name">${u.name}</div>
              <div class="lb-driver-veh">${u.vehicle}</div>
            </div>
          </div>
          <div class="lb-row-score">${metricVal}</div>
        </div>
      `;
    }).join('');
  }

  updateGpsStatus(isActive, text) {
    const textEl = document.getElementById('gpsStatusText');
    const badgeEl = document.getElementById('gpsStatusBadge');
    if (textEl) textEl.textContent = text;
    if (badgeEl) {
      if (isActive) {
        badgeEl.style.borderColor = 'rgba(0, 132, 255, 0.4)';
        badgeEl.style.background = 'rgba(0, 132, 255, 0.15)';
        badgeEl.style.color = '#93c5fd';
      } else {
        badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        badgeEl.style.background = 'rgba(16, 185, 129, 0.12)';
        badgeEl.style.color = '#a7f3d0';
      }
    }
  }

  showToast(message) {
    if (!this.toastEl) return;
    this.toastEl.querySelector('.toast-msg').textContent = message;
    this.toastEl.classList.add('show');
    setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2800);
  }
}
