/**
 * DFWDrive 3D Vehicle Renderer
 * Uses Three.js & GLTFLoader to render authentic low-poly 3D vehicles
 * from the user's 3D models packs on the 3D road in real-time.
 * Features:
 * - Dynamic 3D model switching (Porsche 911, GT-R, McLaren P1, M8, Urus, Mustang, etc.)
 * - Ground neon underglow and forward LED headlight projection
 * - Speed-based wheel spinning and road vibration
 * - Turn banking & dynamic road-lane scaling based on zoom
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VEHICLE_3D_CATALOG } from './data.js';

export class Vehicle3DRenderer {
  constructor(canvasContainerId = 'vehicle3dContainer') {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.vehicleGroup = null;
    this.wheels = [];
    this.currentSpeed = 0;
    this.currentModelId = 'porsche';
    this.currentType = 'car';
    this.currentTurnAngle = 0;
    this.animationFrameId = null;
    this.isInitialized = false;
    this.gltfLoader = null;
    this.loadedPacks = {};
    this.loadingPromises = {};
    this.currentZoom = 17.5;
    this.baseNormScale = 1.0;
  }

  init() {
    if (!this.container || this.isInitialized) return;

    const width = this.container.clientWidth || 320;
    const height = this.container.clientHeight || 240;

    // Three.js Scene
    this.scene = new THREE.Scene();

    // Camera aligned with MapLibre 60-degree road pitch looking at ground contact point (0, 0, 0)
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.set(0, 3.2, 5.5);
    this.camera.lookAt(0, 0.0, 0);

    // WebGL Renderer with transparency & high pixel ratio
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Ambient & Directional Lighting tailored for metallic cars
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.6);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);

    const warmLight = new THREE.DirectionalLight(0xff9900, 1.4);
    warmLight.position.set(-5, 6, -5);
    this.scene.add(warmLight);

    const overheadLight = new THREE.DirectionalLight(0xffffff, 1.8);
    overheadLight.position.set(0, 12, 0);
    this.scene.add(overheadLight);

    // Initial vehicle model
    this.buildVehicle(this.currentModelId || 'porsche');

    this.isInitialized = true;
    this.animate();

    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Load and cache GLTF/GLB pack files
   */
  async loadPack(packKey, url) {
    if (this.loadedPacks[packKey]) {
      return this.loadedPacks[packKey];
    }
    if (this.loadingPromises[packKey]) {
      return this.loadingPromises[packKey];
    }

    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader();
    }

    this.loadingPromises[packKey] = new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.loadedPacks[packKey] = gltf;
          resolve(gltf);
        },
        undefined,
        (err) => {
          console.warn(`[Vehicle3D] Error loading ${packKey} from ${url}:`, err);
          reject(err);
        }
      );
    });

    return this.loadingPromises[packKey];
  }

  /**
   * Build or switch vehicle model by ID
   */
  async buildVehicle(modelId = 'porsche', colorHex = 0xff3b30) {
    if (!this.scene) return;

    const info = VEHICLE_3D_CATALOG.find(c => c.id === modelId) ||
                 VEHICLE_3D_CATALOG.find(c => c.type === modelId) ||
                 VEHICLE_3D_CATALOG[0];

    this.currentModelId = info.id;
    this.currentType = info.type;

    // Reset previous group
    if (this.vehicleGroup) {
      this.scene.remove(this.vehicleGroup);
    }
    this.vehicleGroup = new THREE.Group();
    this.wheels = [];

    // Procedural bike or motorcycle
    if (info.pack === 'procedural' || info.type === 'bike' || info.type === 'motorcycle') {
      if (info.type === 'bike') {
        this.baseNormScale = 0.65;
        this.buildBicycleModel(colorHex);
      } else {
        this.baseNormScale = 0.75;
        this.buildMotorcycleModel(colorHex);
      }
      this.updateScaleForZoom(this.currentZoom || 17.5);
      this.scene.add(this.vehicleGroup);
      return;
    }

    // Immediately render sleek procedural placeholder while 3D file loads
    this.baseNormScale = 1.0;
    this.buildCarModel(colorHex);
    this.updateScaleForZoom(this.currentZoom || 17.5);
    this.scene.add(this.vehicleGroup);

    // Asynchronously load real 3D model from user GLB pack
    try {
      if (info.pack === 'pack2') {
        await this.loadAndMountPack2Model(info);
      } else if (info.pack === 'pack1') {
        await this.loadAndMountPack1Model(info);
      }
    } catch (e) {
      console.warn('[Vehicle3D] Fallback to procedural model for', info.name, e);
    }
  }

  /**
   * Mount model from Pack 2 (Ultimate Low-Poly Car Pack 2)
   */
  async loadAndMountPack2Model(info) {
    const gltf = await this.loadPack('pack2', '3D%20models/ultimate_low-poly_car_pack_2.glb');
    if (!gltf || this.currentModelId !== info.id) return;

    // Locate the vehicle node by name
    const carNode = gltf.scene.getObjectByName(info.nodeName);
    if (!carNode) {
      console.warn('[Vehicle3D] Node not found in pack2:', info.nodeName);
      return;
    }

    const wrapper = new THREE.Group();
    const carClone = carNode.clone(true);
    wrapper.add(carClone);

    // Calculate bounding box and re-center perfectly on ground
    carClone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(carClone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    carClone.position.x -= center.x;
    carClone.position.y -= box.min.y; // Sit exactly on ground Y = 0
    carClone.position.z -= center.z;

    wrapper.updateMatrixWorld(true);

    // Normalize length to ~3.6 road units
    const maxDim = Math.max(size.x, size.z);
    this.baseNormScale = maxDim > 0 ? (3.6 / maxDim) : 0.0075;

    // Wheels & Tires identification
    const foundWheels = [];
    carClone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const n = (child.name || '').toLowerCase();
        if (n.includes('tire') || n.includes('wheel') || n.includes('rim')) {
          foundWheels.push(child);
        }
      }
    });

    // Add cyber ground underglow & lighting
    this.addVehicleGlowEffects(wrapper);

    // Swap vehicle group
    if (this.vehicleGroup) {
      this.scene.remove(this.vehicleGroup);
    }
    this.vehicleGroup = wrapper;
    this.wheels = foundWheels;
    this.updateScaleForZoom(this.currentZoom || 17.5);
    this.scene.add(this.vehicleGroup);
  }

  /**
   * Mount model from Pack 1 (Free Low-Poly Vehicles Pack)
   */
  async loadAndMountPack1Model(info) {
    const gltf = await this.loadPack('pack1', '3D%20models/free_low_poly_vehicles_pack.glb');
    if (!gltf || this.currentModelId !== info.id) return;

    const bodyNode = gltf.scene.getObjectByName(info.nodeName);
    if (!bodyNode) {
      console.warn('[Vehicle3D] Node not found in pack1:', info.nodeName);
      return;
    }

    const wrapper = new THREE.Group();
    const bodyClone = bodyNode.clone(true);
    wrapper.add(bodyClone);

    // Find wheels in Pack 1 (nodes named "${nodeName}_wheel*" or "${nodeName} wheel*")
    const prefix = bodyNode.name.toLowerCase();
    const foundWheels = [];
    gltf.scene.traverse((node) => {
      const n = (node.name || '').toLowerCase();
      if (node !== bodyNode && (n.startsWith(prefix + '_wheel') || n.startsWith(prefix + ' wheel') || n.startsWith(prefix + '_tire')) && node.parent?.name === 'RootNode') {
        const wheelClone = node.clone(true);
        wrapper.add(wheelClone);
        foundWheels.push(wheelClone);
      }
    });

    wrapper.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wrapper);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Re-center around (0, 0, 0) and ground Y = 0
    wrapper.children.forEach(c => {
      c.position.x -= center.x;
      c.position.y -= box.min.y;
      c.position.z -= center.z;
    });
    wrapper.updateMatrixWorld(true);

    // Normalize length to ~3.6 units
    const maxDim = Math.max(size.x, size.z);
    this.baseNormScale = maxDim > 0 ? (3.6 / maxDim) : 0.0063;

    wrapper.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.addVehicleGlowEffects(wrapper);

    if (this.vehicleGroup) {
      this.scene.remove(this.vehicleGroup);
    }
    this.vehicleGroup = wrapper;
    this.wheels = foundWheels;
    this.updateScaleForZoom(this.currentZoom || 17.5);
    this.scene.add(this.vehicleGroup);
  }

  /**
   * Add high-tech neon ground underglow, road contact disc, and headlights
   */
  addVehicleGlowEffects(wrapper) {
    // Road contact shadow / cyber glow disc
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
    grad.addColorStop(0.5, 'rgba(0, 140, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const discTex = new THREE.CanvasTexture(canvas);
    const discGeo = new THREE.PlaneGeometry(2.4, 4.4);
    const discMat = new THREE.MeshBasicMaterial({
      map: discTex,
      transparent: true,
      depthWrite: false
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.position.y = 0.02;
    wrapper.add(discMesh);

    // Cyan Ground Neon Underglow
    const underglow = new THREE.PointLight(0x00f0ff, 3.2, 5.0);
    underglow.position.set(0, 0.25, 0);
    wrapper.add(underglow);

    // Forward LED Headlight illumination
    const headlight = new THREE.PointLight(0xaae8ff, 2.8, 7.5);
    headlight.position.set(0, 0.5, -2.1);
    wrapper.add(headlight);

    // Taillight red glow
    const taillight = new THREE.PointLight(0xff0044, 2.2, 4.2);
    taillight.position.set(0, 0.55, 2.1);
    wrapper.add(taillight);
  }

  updateScaleForZoom(zoom = 17.5) {
    if (!this.vehicleGroup) return;
    this.currentZoom = zoom;

    // Web Mercator map scales by factor of 2.0 per zoom level
    const zoomDelta = (zoom || 17.5) - 17.5;
    const factor = Math.pow(2.0, zoomDelta);
    const clampedFactor = THREE.MathUtils.clamp(factor, 0.35, 2.5);
    const scale = (this.baseNormScale || 1.0) * clampedFactor;

    this.vehicleGroup.scale.set(scale, scale, scale);
  }

  buildCarModel(colorHex) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.85,
      roughness: 0.2
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    const glowLedMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const rearLedMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    // Chassis base
    const baseGeo = new THREE.BoxGeometry(1.6, 0.45, 3.4);
    const baseMesh = new THREE.Mesh(baseGeo, bodyMat);
    baseMesh.position.y = 0.45;
    this.vehicleGroup.add(baseMesh);

    // Cabin / Cockpit
    const cabinGeo = new THREE.BoxGeometry(1.3, 0.48, 1.8);
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, 0.82, 0.2);
    this.vehicleGroup.add(cabinMesh);

    // Front Hood Slope (Facing forward towards -Z)
    const hoodGeo = new THREE.BoxGeometry(1.4, 0.25, 1.1);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(0, 0.55, -1.15);
    hoodMesh.rotation.x = -0.12;
    this.vehicleGroup.add(hoodMesh);

    // Rear Spoiler (At rear +Z)
    const spoilerGeo = new THREE.BoxGeometry(1.5, 0.08, 0.35);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, bodyMat);
    spoilerMesh.position.set(0, 0.95, 1.6);
    this.vehicleGroup.add(spoilerMesh);

    // Headlights (Cyan LEDs facing forward along road -Z)
    const hlGeo = new THREE.BoxGeometry(0.3, 0.08, 0.1);
    const hlLeft = new THREE.Mesh(hlGeo, glowLedMat);
    hlLeft.position.set(0.55, 0.48, -1.71);
    const hlRight = new THREE.Mesh(hlGeo, glowLedMat);
    hlRight.position.set(-0.55, 0.48, -1.71);
    this.vehicleGroup.add(hlLeft, hlRight);

    // Taillights (Red LED strip facing viewer +Z)
    const tlGeo = new THREE.BoxGeometry(1.4, 0.08, 0.1);
    const tlMesh = new THREE.Mesh(tlGeo, rearLedMat);
    tlMesh.position.set(0, 0.52, 1.71);
    this.vehicleGroup.add(tlMesh);

    // Wheels
    const wheelPositions = [
      [-0.85, 0.32, -1.05],
      [0.85, 0.32, -1.05],
      [-0.85, 0.32, 1.05],
      [0.85, 0.32, 1.05]
    ];

    wheelPositions.forEach(pos => {
      const wheel = this.createWheel(0.32, 0.22);
      wheel.position.set(pos[0], pos[1], pos[2]);
      this.vehicleGroup.add(wheel);
      this.wheels.push(wheel);
    });

    this.addVehicleGlowEffects(this.vehicleGroup);
  }

  buildBicycleModel(colorHex) {
    const frameMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.7, roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });

    const tubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8);
    const topTube = new THREE.Mesh(tubeGeo, frameMat);
    topTube.rotation.z = Math.PI / 2;
    topTube.position.set(0, 0.9, 0);
    this.vehicleGroup.add(topTube);

    const downTube = new THREE.Mesh(tubeGeo, frameMat);
    downTube.rotation.x = 0.4;
    downTube.position.set(0, 0.6, -0.2);
    this.vehicleGroup.add(downTube);

    const barGeo = new THREE.BoxGeometry(0.8, 0.05, 0.08);
    const barMesh = new THREE.Mesh(barGeo, metalMat);
    barMesh.position.set(0, 1.15, -0.8);
    this.vehicleGroup.add(barMesh);

    const frontWheel = this.createWheel(0.55, 0.08);
    frontWheel.position.set(0, 0.55, -0.95);
    const rearWheel = this.createWheel(0.55, 0.08);
    rearWheel.position.set(0, 0.55, 0.95);

    this.vehicleGroup.add(frontWheel, rearWheel);
    this.wheels.push(frontWheel, rearWheel);
    this.addVehicleGlowEffects(this.vehicleGroup);
  }

  buildMotorcycleModel(colorHex) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, metalness: 0.8, roughness: 0.4 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    const tankGeo = new THREE.BoxGeometry(0.6, 0.5, 1.4);
    const tankMesh = new THREE.Mesh(tankGeo, bodyMat);
    tankMesh.position.set(0, 0.8, -0.1);
    this.vehicleGroup.add(tankMesh);

    const lightGeo = new THREE.BoxGeometry(0.25, 0.2, 0.1);
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(0, 0.85, -0.85);
    this.vehicleGroup.add(lightMesh);

    const seatGeo = new THREE.BoxGeometry(0.4, 0.2, 0.8);
    const seatMesh = new THREE.Mesh(seatGeo, darkMat);
    seatMesh.position.set(0, 0.75, 0.6);
    this.vehicleGroup.add(seatMesh);

    const frontWheel = this.createWheel(0.48, 0.18);
    frontWheel.position.set(0, 0.48, -1.1);
    const rearWheel = this.createWheel(0.48, 0.22);
    rearWheel.position.set(0, 0.48, 1.0);

    this.vehicleGroup.add(frontWheel, rearWheel);
    this.wheels.push(frontWheel, rearWheel);
    this.addVehicleGlowEffects(this.vehicleGroup);
  }

  createWheel(radius, width) {
    const group = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1c23, roughness: 0.8 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    group.add(tire);

    const rimGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 1.05, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x0084ff, metalness: 0.9, roughness: 0.2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    group.add(rim);

    return group;
  }

  setSpeed(speedMph) {
    this.currentSpeed = Math.max(0, speedMph);
  }

  setSteering(turnDeltaDegrees) {
    const targetLean = THREE.MathUtils.clamp(turnDeltaDegrees * 0.02, -0.22, 0.22);
    this.currentTurnAngle += (targetLean - this.currentTurnAngle) * 0.1;
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (!this.renderer || !this.scene || !this.camera) return;

    // Spin wheels forward according to speed
    if (this.currentSpeed > 0 && this.wheels.length > 0) {
      const rotationSpeed = (this.currentSpeed / 45) * 0.35;
      this.wheels.forEach(w => {
        w.rotation.x -= rotationSpeed;
      });
    }

    // Vehicle slight micro vibration when moving
    if (this.vehicleGroup) {
      if (this.currentSpeed > 0) {
        this.vehicleGroup.position.y = Math.sin(Date.now() * 0.025) * 0.015;
        this.vehicleGroup.rotation.z = -this.currentTurnAngle; // Lean into turns
      } else {
        this.vehicleGroup.position.y = 0;
        this.vehicleGroup.rotation.z = 0;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}
