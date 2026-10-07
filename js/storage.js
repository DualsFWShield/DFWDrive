import { INITIAL_VEHICLES, INITIAL_DRIVES, DEFAULT_USER_PROFILE } from './data.js';

const STORAGE_KEYS = {
  VEHICLES: 'dfwdrive_vehicles_v4',
  DRIVES: 'dfwdrive_drives_v4',
  ACTIVE_VEHICLE: 'dfwdrive_active_vehicle_v4',
  USER_PROFILE: 'dfwdrive_profile_v4',
  MAP_STYLE: 'dfwdrive_mapstyle_v4'
};

export class StorageService {
  static getProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(DEFAULT_USER_PROFILE));
        return DEFAULT_USER_PROFILE;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  }

  static saveProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  }

  static getVehicles() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VEHICLES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
        return INITIAL_VEHICLES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_VEHICLES;
    }
  }

  static saveVehicles(vehicles) {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
  }

  static getActiveVehicle() {
    const vehicles = this.getVehicles();
    if (vehicles.length === 0) return null;
    const storedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_VEHICLE);
    if (storedId) {
      const found = vehicles.find(v => v.id === storedId);
      if (found) return found;
    }
    const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
    return primary;
  }

  static setActiveVehicle(vehicleId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_VEHICLE, vehicleId);
    const vehicles = this.getVehicles().map(v => ({
      ...v,
      isPrimary: v.id === vehicleId
    }));
    this.saveVehicles(vehicles);
    return vehicles.find(v => v.id === vehicleId);
  }

  static addVehicle(newVehicle) {
    const vehicles = this.getVehicles();
    const isFirst = vehicles.length === 0;
    const vehicleWithId = {
      ...newVehicle,
      id: `veh_${Date.now()}`,
      isPrimary: isFirst || !!newVehicle.isPrimary,
      totalDrives: 0,
      totalDistance: 0
    };
    vehicles.push(vehicleWithId);
    this.saveVehicles(vehicles);
    if (vehicleWithId.isPrimary) {
      this.setActiveVehicle(vehicleWithId.id);
    }
    return vehicleWithId;
  }

  static deleteVehicle(vehicleId) {
    let vehicles = this.getVehicles().filter(v => v.id !== vehicleId);
    if (vehicles.length > 0) {
      // Ensure there's an active primary vehicle
      if (!vehicles.some(v => v.isPrimary)) {
        vehicles[0].isPrimary = true;
      }
      this.saveVehicles(vehicles);
      const active = vehicles.find(v => v.isPrimary) || vehicles[0];
      this.setActiveVehicle(active.id);
    } else {
      this.saveVehicles([]);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_VEHICLE);
    }
    return vehicles;
  }

  static getDrives() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DRIVES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.DRIVES, JSON.stringify(INITIAL_DRIVES));
        return INITIAL_DRIVES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_DRIVES;
    }
  }

  static saveDrives(drives) {
    localStorage.setItem(STORAGE_KEYS.DRIVES, JSON.stringify(drives));
  }

  static addDrive(newDrive) {
    const drives = this.getDrives();
    drives.unshift(newDrive);
    this.saveDrives(drives);

    // Update vehicle distance
    const vehicles = this.getVehicles();
    const vehicle = vehicles.find(v => v.id === newDrive.vehicleId);
    if (vehicle) {
      vehicle.totalDrives = (vehicle.totalDrives || 0) + 1;
      vehicle.totalDistance = Number(((vehicle.totalDistance || 0) + newDrive.distance).toFixed(1));
      vehicle.odometer = Number(((vehicle.odometer || 0) + newDrive.distance).toFixed(1));
      this.saveVehicles(vehicles);
    }
    return newDrive;
  }

  static deleteDrive(driveId) {
    const drives = this.getDrives().filter(d => d.id !== driveId);
    this.saveDrives(drives);
    return drives;
  }

  static updateDrive(driveId, updates) {
    const drives = this.getDrives();
    const index = drives.findIndex(d => d.id === driveId);
    if (index !== -1) {
      drives[index] = { ...drives[index], ...updates };
      this.saveDrives(drives);
      return drives[index];
    }
    return null;
  }
}
