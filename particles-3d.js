const size = 8; 
const size2 = 4;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });
// renderer.setSize(size, size);
renderer.setSize( window.innerWidth, window.innerHeight );
camera.position.z = 12;

let audioContext;

document.body.appendChild(renderer.domElement);

const boxGeometry = new THREE.BoxGeometry(size, size, size);
const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
scene.add(edges);

function createGrid(size, color, rotation, position) {
  const grid = new THREE.GridHelper(size, size / 1, color, color);
  grid.rotation.x = rotation.x;
  grid.rotation.y = rotation.y;
  grid.rotation.z = rotation.z;
  grid.position.set(position.x, position.y, position.z);
  return grid;
}

const gridColor = 0x00ff00; // Green color, similar to 80's video games
const grids = [
  createGrid(size, gridColor, { x: 0, y: 0, z: 0 }, { x: 0, y: -size2, z: 0 }), // Ground
  createGrid(size, gridColor, { x: 0, y: 0, z: 0 }, { x: 0, y: size2, z: 0 }), // Ceiling
  createGrid(size, gridColor, { x: Math.PI / 2, y: 0, z: 0 }, { x: 0, y: 0, z: -size2 }), // Back wall
  createGrid(size, gridColor, { x: 0, y: 0, z: Math.PI / 2}, { x: -size2, y: 0, z: 0 }), // Left wall
  createGrid(size, gridColor, { x: 0, y: 0, z: Math.PI / 2}, { x: size2, y: 0, z: 0 }), // Right wall
];

grids.forEach((grid) => scene.add(grid));

const numTypes = 8;
const numForces = 4;
const numParticles = 40;
const colors = Array.from({ length: numTypes }, () => new THREE.Color(Math.random(), Math.random(), Math.random()));
const typeProperties = Array.from({ length: numTypes }, () => ({ f: Array.from({ length: numForces }, () => Math.random() * 0.3 - 0.15) }));

class Particle {
  constructor(x, y, z, type) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 4, 5),
      new THREE.MeshBasicMaterial({ color: colors[type] }) 
      // new THREE.MeshPhongMaterial({ color: colors[type] })
    );
    this.mesh.position.set(x, y, z);
    this.velocity = new THREE.Vector3(Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1, Math.random() * 0.2 - 0.1);
    this.type = type;
    // this.mesh.castShadow = true;
    // this.mesh.receiveShadow = true;
  }

  update(particles) {
    const wrap = (value, min, max) => (((value - min) % (max - min)) + (max - min)) % (max - min) + min;

    this.mesh.position.add(this.velocity);
    this.mesh.position.set(wrap(this.mesh.position.x, -size2, size2), 
                           wrap(this.mesh.position.y, -size2, size2),
                           wrap(this.mesh.position.z, -size2, size2));

    particles.forEach((particle) => {
      if (this !== particle) {
        const delta = new THREE.Vector3().subVectors(this.mesh.position, particle.mesh.position);
        delta.set(wrap(delta.x, -size2, size2), wrap(delta.y, -size2, size2), wrap(delta.z, -size2, size2));

        const distSq = delta.lengthSq() + 1e-6; // Add a small constant to avoid division by zero
        const forceVector = delta.normalize();
        const forces = typeProperties[this.type].f.map((f1, i) => (f1 * typeProperties[particle.type].f[i]) / distSq).reduce((a, b) => a + b, 0);
        forceVector.multiplyScalar(forces);

        this.velocity.add(forceVector);
        this.velocity.clampLength(0, 2.5*0.05);
      }
    });

  // Update audio based on position and velocity
  const freq = 30 * Math.abs(this.velocity.x * 100 + this.velocity.y * 100 + this.velocity.z * 100);
  if (isFinite(freq)) {
    this.oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
  }

  // Stereo panning based on x-coordinate
  const pan = this.mesh.position.x / size2;
  this.pannerNode.pan.setValueAtTime(pan, audioContext.currentTime);

  // Gain based on distance from camera
  const distance = this.mesh.position.distanceTo(camera.position);
  const maxDistance = camera.position.z;
  const gain = 1 - Math.min(distance / maxDistance, 1);
  this.gainNode.gain.setValueAtTime(gain, audioContext.currentTime);

  }
}

const particles = Array.from({ length: numParticles }, () => new Particle(
  (Math.random() - 0.5) * size,
  (Math.random() - 0.5) * size,
  (Math.random() - 0.5) * size,
  Math.floor(Math.random() * numTypes)
)).map(p => (scene.add(p.mesh), p));

function animate() {
  particles.forEach((particle) => particle.update(particles));

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function initSimulation() {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const restartButton = document.getElementById("restartButton");

  startButton.addEventListener("click", startSimulation);
  stopButton.addEventListener("click", stopSimulation);
  restartButton.addEventListener("click", restartSimulation);

  function startSimulation() {
    startButton.disabled = true;
    stopButton.disabled = false;
    restartButton.disabled = false;

    if (!audioContext) {
      // Create AudioContext only once
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const waveforms = ['sine', 'square', 'triangle', 'sawtooth'];

    particles.forEach((particle) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const pannerNode = audioContext.createStereoPanner();

      oscillator.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(audioContext.destination);

      oscillator.type = waveforms[particle.type % waveforms.length];
      oscillator.frequency.value = 30 * 440;
      gainNode.gain.setValueAtTime(1, audioContext.currentTime);

      oscillator.start();

      particle.oscillator = oscillator;
      particle.gainNode = gainNode;
      particle.pannerNode = pannerNode;
    });

    animate();
  }

  function stopSimulation() {
    startButton.disabled = false;
    stopButton.disabled = true;

    particles.forEach((particle) => {
      particle.oscillator.stop();
    });
  }

  function restartSimulation() {
    stopSimulation();
    particles.length = 0;
    scene.clear();

    // Create new particles with new properties
    particles.push(
      ...Array.from({ length: numParticles }, () =>
        new Particle(
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size,
          Math.floor(Math.random() * numTypes)
        )
      ).map((p) => (scene.add(p.mesh), p))
    );

    startSimulation();
  }
}

initSimulation();