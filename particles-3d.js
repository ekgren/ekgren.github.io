import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, scene, renderer;
let colors, typeProperties;
let particles;
let audioContext;
let conf;
let controls;
let animationId = null; // Define the animationId variable

conf = {
  size: 20,
  numTypes: 8,
  numForces: 4,
  numParticles: 40,
  trailLength: 10,
  // Below are derived values
  size2: 10,
  cameraDistance: 22,
};

class Particle {

    constructor(x, y, z, type) {

        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 4, 5),
            new THREE.MeshBasicMaterial({ color: colors[type] })
        );
        this.mesh.position.set(x, y, z);
        this.velocity = new THREE.Vector3(
            Math.random() * 0.2 - 0.1,
            Math.random() * 0.2 - 0.1,
            Math.random() * 0.2 - 0.1
        );
        this.type = type;

        // Create a buffer geometry for the trail
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(conf.trailLength * 3), 3));
        const trailMaterial = new THREE.LineBasicMaterial({ color: colors[type] });

        // Create the trail line
        this.trail = new THREE.Line(trailGeometry, trailMaterial);
        this.trailPositions = [this.mesh.position.clone()]; // Initialize with the initial position

        // Set the rest of the positions in the trail geometry to NaN
        const positions = this.trail.geometry.attributes.position;
        for (let i = 1; i < conf.trailLength; i++) {
          positions.setXYZ(i, NaN, NaN, NaN);
        }
        positions.needsUpdate = true;

        scene.add(this.trail);
    }

    update(particles) {

        /**
         * Wraps a value between a given minimum and maximum value.
         * Similar to Python's modulo operator behavior for negative numbers.
         * 
         * @param {number} value - The value to be wrapped.
         * @param {number} min - The lower bound of the range.
         * @param {number} max - The upper bound of the range.
         * @returns {number} The wrapped value.
         */
        const wrap = (value, min, max) => {
            const rangeSize = max - min;
            const valueRelativeToMin = value - min;
            const wrappedPosition = (valueRelativeToMin % rangeSize + rangeSize) % rangeSize;

            return wrappedPosition + min;
        };

        this.mesh.position.add(this.velocity);
        this.mesh.position.set(
            wrap(this.mesh.position.x, -conf.size2, conf.size2), 
            wrap(this.mesh.position.y, -conf.size2, conf.size2),
            wrap(this.mesh.position.z, -conf.size2, conf.size2)
        );

        particles.forEach((particle) => {
            if (this !== particle) {
                const delta = new THREE.Vector3().subVectors(this.mesh.position, particle.mesh.position);
                delta.set(wrap(delta.x, -conf.size2, conf.size2), wrap(delta.y, -conf.size2, conf.size2), wrap(delta.z, -conf.size2, conf.size2));

                const distSq = delta.lengthSq() + 1e-6; // Add a small constant to avoid division by zero
                const forceVector = delta.normalize();
                const forces = typeProperties[this.type].f.map((f1, i) => (f1 * typeProperties[particle.type].f[i]) / distSq).reduce((a, b) => a + b, 0);
                forceVector.multiplyScalar(forces);

                this.velocity.add(forceVector);
                this.velocity.clampLength(0, 0.5);
            }
        });

        /* 
        // Update audio based on position and velocity
        const freq = 30 * Math.abs(this.velocity.x * 100 + this.velocity.y * 100 + this.velocity.z * 100);
        if (isFinite(freq)) {
            this.oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        }

        // Stereo panning based on x-coordinate
        const pan = this.mesh.position.x / conf.size2;
        this.pannerNode.pan.setValueAtTime(pan, audioContext.currentTime);

        // Gain based on distance from camera
        const distance = this.mesh.position.distanceTo(camera.position);
        const maxDistance = camera.position.z;
        const gain = 1 - Math.min(distance / maxDistance, 1);
        this.gainNode.gain.setValueAtTime(gain, audioContext.currentTime);
         */

        // Update the trail
        const currentPosition = this.mesh.position.clone();
        if (this.trailPositions.length > 0) {
          // Calculate the distance between the current position and the last position in the trail
          const distanceToLastPosition = currentPosition.distanceTo(this.trailPositions[0]);

          // Define a threshold distance to detect wrap-around (e.g., half the size of the scene)
          const wrapAroundThreshold = conf.size / 2;

          // If the distance exceeds the threshold, insert a "gap" in the trail
          if (distanceToLastPosition > wrapAroundThreshold) {
            this.trailPositions.unshift(null); // Insert a null value to represent the gap
          }
        }
        this.trailPositions.unshift(currentPosition);
        if (this.trailPositions.length > conf.trailLength) {
          this.trailPositions.pop();
        }

        // Update the trail geometry
        const positions = this.trail.geometry.attributes.position;
        let vertexIndex = 0;
        for (const position of this.trailPositions) {
          if (position === null) {
            // Skip the null value (gap in the trail)
            positions.setXYZ(vertexIndex, NaN, NaN, NaN);
          } else {
            positions.setXYZ(vertexIndex, position.x, position.y, position.z);
          }
          vertexIndex++;
        }
        positions.needsUpdate = true;
      }

}

init();
animate();

function cleanup() {
    function disposeScene(scene) {
        scene.traverse((object) => {
            if (object.geometry) {object.geometry.dispose();}
            if (object.material) {
                if (object.material.length) {
                    for (const material of object.material) {
                        material.dispose();
                    }
                } else {
                    object.material.dispose();
                }
            }
            if (object.texture) {object.texture.dispose();}
        });
    }

    // Cancel the animation loop
    if (animationId) {cancelAnimationFrame(animationId);}

    // Dispose of the scene resources
    if (scene) {disposeScene(scene);}

    // Dispose of the renderer
    if (renderer) {renderer.dispose();}

    // Remove the old renderer's canvas from the DOM
    if (renderer && renderer.domElement) {renderer.domElement.remove();}

    // Reset global variables
    camera = null; scene = null; renderer = null; colors = null; typeProperties = null; particles = null; audioContext = null; animationId = null;

    conf.size2 = conf.size / 2;
    conf.cameraDistance = conf.size * 1.1;
    
    init();
    animate();
}

function init() {

    // Get the canvas container and wrapper elements
    const canvasContainer = document.getElementById('canvasContainer');
    const canvasWrapper = document.getElementById('canvasWrapper');

    // Calculate the maximum width and height for the canvas
    const maxWidth = canvasWrapper.clientWidth * 0.8;
    const maxHeight = canvasWrapper.clientHeight * 0.8;

    const aspectRatio = maxWidth / maxHeight;

    const canvasWidth = Math.min(window.innerWidth * 0.8, maxHeight * aspectRatio);
    const canvasHeight = canvasWidth / aspectRatio;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 75, aspectRatio, 0.1, 1000);
    camera.position.z = conf.cameraDistance;

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(canvasWidth, canvasHeight); // Set the renderer's size
    renderer.setClearColor(new THREE.Color('rgb(24, 24, 24)'));
    canvasContainer.appendChild(renderer.domElement);

    onWindowResize();

    window.addEventListener( 'resize', onWindowResize );

    controls = new OrbitControls(camera, renderer.domElement);

    // Set the OrbitControls target to the origin (0, 0, 0)
    controls.target.set(0, 0, 0);

    // Limit the rotation to the XY plane
    controls.minPolarAngle = Math.PI / 2; // 90 degrees in radians
    controls.maxPolarAngle = Math.PI / 2; // 90 degrees in radians

    /*** GUI ***/
    const gui = new GUI();

    gui.add(conf, 'size', 1, 100).step(1).onChange(() => cleanup());
    gui.add(conf, 'numTypes', 1, 50).step(1).onChange(() => cleanup());
    gui.add(conf, 'numForces', 1, 20).step(1).onChange(() => cleanup());
    gui.add(conf, 'numParticles', 1, 400).step(1).onChange(() => cleanup());
    gui.add(conf, 'trailLength', 1, 100).step(1).onChange(() => cleanup());

    /*** 3D BOX ***/
    const gridColor = new THREE.Color('rgb(96, 96, 96)')
    
    const boxGeometry = new THREE.BoxGeometry(conf.size, conf.size, conf.size);
    const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: gridColor });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    scene.add(edges);
    
    function createGrid(size, color, rotation, position) {
        const grid = new THREE.GridHelper(size, 10, color, color);
        grid.rotation.x = rotation.x;
        grid.rotation.y = rotation.y;
        grid.rotation.z = rotation.z;
        grid.position.set(position.x, position.y, position.z);
        return grid;
    }
    
    const grids = [
        createGrid(conf.size, gridColor, { x: 0, y: 0, z: 0 }, { x: 0, y: -conf.size2, z: 0 }), // Ground
        createGrid(conf.size, gridColor, { x: 0, y: 0, z: 0 }, { x: 0, y: conf.size2, z: 0 }), // Ceiling
        // createGrid(conf.size, gridColor, { x: Math.PI / 2, y: 0, z: 0 }, { x: 0, y: 0, z: -conf.size2 }), // Back wall
        // createGrid(conf.size, gridColor, { x: 0, y: 0, z: Math.PI / 2}, { x: -conf.size2, y: 0, z: 0 }), // Left wall
        // createGrid(conf.size, gridColor, { x: 0, y: 0, z: Math.PI / 2}, { x: conf.size2, y: 0, z: 0 }), // Right wall
    ];
    
    grids.forEach((grid) => scene.add(grid));
    

    colors = Array.from({ length: conf.numTypes }, () => new THREE.Color(Math.random(), Math.random(), Math.random()));
    typeProperties = Array.from({ length: conf.numTypes }, () => ({ f: Array.from({ length: conf.numForces }, () => Math.random() * 2.0 - 1.0) }));

    particles = Array.from({ length: conf.numParticles }, () => new Particle(
        (Math.random() - 0.5) * conf.size,
        (Math.random() - 0.5) * conf.size,
        (Math.random() - 0.5) * conf.size,
        Math.floor(Math.random() * conf.numTypes)
    )).map(p => (scene.add(p.mesh), p));

    /* 
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
     */
}

function animate() {

  particles.forEach((particle) => particle.update(particles));

  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate); // Update the animationId variable with the value returned by requestAnimationFrame

}

function onWindowResize() {
  // Get the canvas wrapper element
  const canvasWrapper = document.getElementById('canvasWrapper');

  // Get the dimensions of the canvas wrapper
  const wrapperWidth = canvasWrapper.clientWidth;
  const wrapperHeight = canvasWrapper.clientHeight;

  // Calculate the size of the canvas based on the smaller dimension of the wrapper
  const canvasSize = Math.min(wrapperWidth, wrapperHeight) * 0.8; // 80% of the smaller dimension

  // Update the camera's aspect ratio and projection matrix
  camera.aspect = 1; // Square aspect ratio (1:1)
  camera.updateProjectionMatrix();

  // Resize the renderer
  renderer.setSize(canvasSize, canvasSize); // Set both width and height to canvasSize
}