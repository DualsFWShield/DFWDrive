/**
 * DFWDrive Simplified 3D Vehicle Renderer
 * Uses Three.js to render a sleek, stylized low-poly vehicle on the 3D road
 * with spinning wheels, turn banking, and neon ground-glow.
 */

export class Vehicle3DRenderer {
  constructor(canvasContainerId = 'vehicle3dContainer') {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.vehicleGroup = null;
    this.wheels = [];
    this.currentSpeed = 0;
    this.currentType = 'car';
    this.currentTurnAngle = 0;
    this.animationFrameId = null;
    this.isInitialized = false;
  }

  init() {
    if (!this.container || this.isInitialized || typeof THREE === 'undefined') return;

    const width = this.container.clientWidth || 320;
    const height = this.container.clientHeight || 240;

    // Scene
    this.scene = new THREE.Scene();

    // Camera (Isometric perspective looking slightly down and behind the vehicle)
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 3.8, 6.2);
    this.camera.lookAt(0, 0.6, 0);

    // Renderer with transparent background
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x0084ff, 2.5);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);

    const warmLight = new THREE.DirectionalLight(0xff8800, 1.2);
    warmLight.position.set(-5, 6, -5);
    this.scene.add(warmLight);

    // Create default car model
    this.buildVehicle('car');

    this.isInitialized = true;
    this.animate();

    window.addEventListener('resize', () => this.handleResize());
  }

  buildVehicle(type = 'car', colorHex = 0xff3b30) {
    if (!this.scene) return;
    this.currentType = type;

    if (this.vehicleGroup) {
      this.scene.remove(this.vehicleGroup);
    }

    this.vehicleGroup = new THREE.Group();
    this.wheels = [];

    // Ground shadow attached directly to vehicle group for synchronous scaling
    const shadowGeo = new THREE.PlaneGeometry(3.2, 4.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    this.vehicleGroup.add(shadowMesh);

    if (type === 'bike') {
      this.buildBicycleModel(colorHex);
    } else if (type === 'motorcycle') {
      this.buildMotorcycleModel(colorHex);
    } else {
      this.buildCarModel(colorHex);
    }

    // Adapt scale to map road size immediately
    this.updateScaleForZoom(this.currentZoom || 17.5);

    this.scene.add(this.vehicleGroup);
  }

  updateScaleForZoom(zoom = 17.5) {
    if (!this.vehicleGroup) return;
    this.currentZoom = zoom;

    // Road width roughly doubles per 1 level of MapLibre zoom.
    // At drive zoom 17.5, roads are 25-35px wide. Base scale of ~0.38 fits a highway lane accurately.
    const zoomDelta = zoom - 17.5;
    const factor = Math.pow(1.85, zoomDelta);
    const base = this.currentType === 'bike' ? 0.32 : this.currentType === 'motorcycle' ? 0.35 : 0.38;
    const targetScale = THREE.MathUtils.clamp(base * factor, 0.12, 1.25);
    this.vehicleGroup.scale.set(targetScale, targetScale, targetScale);
  }

  buildCarModel(colorHex) {
    // Body Materials
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
    cabinMesh.position.set(0, 0.82, -0.2);
    this.vehicleGroup.add(cabinMesh);

    // Front Hood Slope
    const hoodGeo = new THREE.BoxGeometry(1.4, 0.25, 1.1);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(0, 0.55, 1.15);
    hoodMesh.rotation.x = 0.12;
    this.vehicleGroup.add(hoodMesh);

    // Rear Spoiler
    const spoilerGeo = new THREE.BoxGeometry(1.5, 0.08, 0.35);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, bodyMat);
    spoilerMesh.position.set(0, 0.95, -1.6);
    this.vehicleGroup.add(spoilerMesh);

    // Headlights (Cyan LEDs)
    const hlGeo = new THREE.BoxGeometry(0.3, 0.08, 0.1);
    const hlLeft = new THREE.Mesh(hlGeo, glowLedMat);
    hlLeft.position.set(0.55, 0.48, 1.71);
    const hlRight = new THREE.Mesh(hlGeo, glowLedMat);
    hlRight.position.set(-0.55, 0.48, 1.71);
    this.vehicleGroup.add(hlLeft, hlRight);

    // Taillights (Red LED strip)
    const tlGeo = new THREE.BoxGeometry(1.4, 0.08, 0.1);
    const tlMesh = new THREE.Mesh(tlGeo, rearLedMat);
    tlMesh.position.set(0, 0.52, -1.71);
    this.vehicleGroup.add(tlMesh);

    // Wheels
    const wheelPositions = [
      [-0.85, 0.32, 1.05], // front-left
      [0.85, 0.32, 1.05],  // front-right
      [-0.85, 0.32, -1.05], // rear-left
      [0.85, 0.32, -1.05]   // rear-right
    ];

    wheelPositions.forEach(pos => {
      const wheel = this.createWheel(0.32, 0.22);
      wheel.position.set(pos[0], pos[1], pos[2]);
      this.vehicleGroup.add(wheel);
      this.wheels.push(wheel);
    });
  }

  buildBicycleModel(colorHex) {
    const frameMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.7, roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });

    // Main Tube Frame
    const tubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8);
    const topTube = new THREE.Mesh(tubeGeo, frameMat);
    topTube.rotation.z = Math.PI / 2;
    topTube.position.set(0, 0.9, 0);
    this.vehicleGroup.add(topTube);

    const downTube = new THREE.Mesh(tubeGeo, frameMat);
    downTube.rotation.x = -0.4;
    downTube.position.set(0, 0.6, 0.2);
    this.vehicleGroup.add(downTube);

    // Handlebars
    const barGeo = new THREE.BoxGeometry(0.8, 0.05, 0.08);
    const barMesh = new THREE.Mesh(barGeo, metalMat);
    barMesh.position.set(0, 1.15, 0.8);
    this.vehicleGroup.add(barMesh);

    // Bicycle Wheels
    const frontWheel = this.createWheel(0.55, 0.08);
    frontWheel.position.set(0, 0.55, 0.95);
    const rearWheel = this.createWheel(0.55, 0.08);
    rearWheel.position.set(0, 0.55, -0.95);

    this.vehicleGroup.add(frontWheel, rearWheel);
    this.wheels.push(frontWheel, rearWheel);
  }

  buildMotorcycleModel(colorHex) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, metalness: 0.8, roughness: 0.4 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    // Body tank & fairing
    const tankGeo = new THREE.BoxGeometry(0.6, 0.5, 1.4);
    const tankMesh = new THREE.Mesh(tankGeo, bodyMat);
    tankMesh.position.set(0, 0.8, 0.1);
    this.vehicleGroup.add(tankMesh);

    // Front headlight
    const lightGeo = new THREE.BoxGeometry(0.25, 0.2, 0.1);
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(0, 0.85, 0.85);
    this.vehicleGroup.add(lightMesh);

    // Seat / Tail
    const seatGeo = new THREE.BoxGeometry(0.4, 0.2, 0.8);
    const seatMesh = new THREE.Mesh(seatGeo, darkMat);
    seatMesh.position.set(0, 0.75, -0.6);
    this.vehicleGroup.add(seatMesh);

    // Wheels
    const frontWheel = this.createWheel(0.48, 0.18);
    frontWheel.position.set(0, 0.48, 1.1);
    const rearWheel = this.createWheel(0.48, 0.22);
    rearWheel.position.set(0, 0.48, -1.0);

    this.vehicleGroup.add(frontWheel, rearWheel);
    this.wheels.push(frontWheel, rearWheel);
  }

  createWheel(radius, width) {
    const group = new THREE.Group();

    // Tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1c23, roughness: 0.8 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    group.add(tire);

    // Glowing rim
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
    // Smooth lean / banking into turn (-0.15 to +0.15 radians)
    const targetLean = THREE.MathUtils.clamp(turnDeltaDegrees * 0.02, -0.22, 0.22);
    this.currentTurnAngle += (targetLean - this.currentTurnAngle) * 0.1;
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (!this.renderer || !this.scene || !this.camera) return;

    // Spin wheels according to speed
    if (this.currentSpeed > 0 && this.wheels.length > 0) {
      const rotationSpeed = (this.currentSpeed / 45) * 0.35;
      this.wheels.forEach(w => {
        w.rotation.x += rotationSpeed;
      });
    }

    // Vehicle slight micro vibration when moving
    if (this.vehicleGroup) {
      if (this.currentSpeed > 0) {
        this.vehicleGroup.position.y = Math.sin(Date.now() * 0.02) * 0.015;
        this.vehicleGroup.rotation.z = -this.currentTurnAngle; // lean into turns
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
