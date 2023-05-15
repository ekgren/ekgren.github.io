import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, scene, renderer;
let colors, typeForceConstants;
let particles;
let conf;
let controls;
let animationId = null;

let forces;

conf = {
  size: 50,
  numTypes: 20,
  numForces: 8,
  numParticles: 100,
  trailLength: 10,
  // Below are derived values
  size2: 25,
  cameraDistance: 50 * 1.4,
};

class Force {
  constructor() {
      // Initialize the force parameters
      this.forceConstant = Math.random() * 20;
      this.exponent = 1 + Math.random() * 2;
  }

  calculateForce(distance, delta, const1, const2) {
      // Calculate the force as a vector quantity
      // Gravitational force is inversely proportional to the square of the distance
      const forceMagnitude = this.forceConstant / Math.pow(distance, this.exponent);
      let forceDirection = delta.clone().normalize();

      return forceDirection.multiplyScalar(forceMagnitude);
  }
}


class Particle {

    constructor(x, y, z, type) {

        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 4, 5),
            new THREE.MeshBasicMaterial({ color: colors[type] })
        );
        // this.mesh.position.set(x, y, z);
        this.mesh.position.set(0, 0, 0);
        this.velocity = new THREE.Vector3(
          Math.random() * 0.02 - 0.01,
          Math.random() * 0.02 - 0.01,
          Math.random() * 0.02 - 0.01
        );
        this.type = type;
        this.totalForceVector = new THREE.Vector3();
        // this.forces = typeProperties[this.type].map(parameters => new Force(parameters));

        
        /*** TRAIL ***/
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

              // For each particle, calculate the distance delta vector
              const delta = new THREE.Vector3().subVectors(this.mesh.position, particle.mesh.position);
              delta.set(
                  wrap(delta.x, -conf.size2, conf.size2),
                  wrap(delta.y, -conf.size2, conf.size2),
                  wrap(delta.z, -conf.size2, conf.size2)
              );

              const dist = Math.sqrt(delta.lengthSq()) + 1e-6; // Add a small constant to avoid division by zero
              
              // const totalForceVector = new THREE.Vector3();
              this.totalForceVector.set(0, 0, 0); // Reset the total force vector
              forces.forEach((force, i) => {
                  const forceVector = force.calculateForce(
                      dist,
                      delta,
                      typeForceConstants[this.type][i],
                      typeForceConstants[particle.type][i]
                  );
                  const forceMagnitude = typeForceConstants[this.type][i] * typeForceConstants[particle.type][i] / dist;
                  forceVector.multiplyScalar(forceMagnitude);
                  // totalForceVector.add(forceVector);
                  this.totalForceVector.add(forceVector);

              });

              // After calculating all the forces and before updating the velocities:
              let maxForce = 0;
              let maxVelocity = 0;
              particles.forEach((particle) => {
                  const forceMagnitude = particle.totalForceVector.length();
                  const velocityMagnitude = particle.velocity.length();
                  maxForce = Math.max(maxForce, forceMagnitude);
                  maxVelocity = Math.max(maxVelocity, velocityMagnitude);
              });

              // Renormalize the forces and velocities
              particles.forEach((particle) => {
                  if (maxForce > 0) {
                      particle.totalForceVector.divideScalar(maxForce);
                  }
                  if (maxVelocity > 0) {
                      particle.velocity.divideScalar(maxVelocity);
                  }
              });

              
              const speed = this.velocity.length();
              const c = 0.5; // Speed of light
              const deltaV = this.totalForceVector; // Change in velocity
              const newVelocity = this.velocity.clone().add(deltaV); // Calculate the new velocity without relativity
              const newSpeed = newVelocity.length();

              if (newSpeed >= c) {
                  // If the new speed exceeds the speed of light, adjust it using the relativistic velocity addition formula
                  const u = deltaV.length();
                  const v = speed;
                  const newSpeedRelativistic = (v + u) / (1 + (v * u / Math.pow(c, 2)));
                  newVelocity.normalize().multiplyScalar(newSpeedRelativistic);
              }

              this.velocity = newVelocity;
              // this.velocity.add(totalForceVector);
              // this.velocity.clampLength(0, 0.2);
          }
      })

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

    // Remove particles and their trails from the scene
    if (particles) {
        particles.forEach(particle => {
            scene.remove(particle.mesh);
            scene.remove(particle.trail);
        });
    }

    // Reset global variables
    camera = null; scene = null; renderer = null; colors = null; typeForceConstants = null; particles = null; animationId = null;

    conf.size2 = conf.size / 2;
    conf.cameraDistance = conf.size * 1.4;
    
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
    controls.autoRotate = true;

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
    ]

    grids.forEach((grid) => scene.add(grid));

    colors = Array.from({ length: conf.numTypes }, () => new THREE.Color(Math.random(), Math.random(), Math.random()));

    // For each type and force generate a constant and store in 2d array.
    typeForceConstants = []; // Initialize an empty array
    for (let i = 0; i < conf.numTypes; i++) {
        let forceArray = []; // Initialize an array for this type
        for (let j = 0; j < conf.numForces; j++) {
            // Generate physical constants for this force and type
            let typeForceConstant = Math.random() * 2 - 1; // Generate a random number between -1 and 1
            forceArray.push(typeForceConstant); // Add the random number to the force array
        }
        typeForceConstants.push(forceArray); // Add the force array to the type array
    }

    // Create the forces
    forces = Array.from({length: conf.numForces}, () => new Force());

    // Generate the particles
    particles = Array.from({ length: conf.numParticles }, () => new Particle(
        (Math.random() - 0.5) * conf.size,
        (Math.random() - 0.5) * conf.size,
        (Math.random() - 0.5) * conf.size,
        Math.floor(Math.random() * conf.numTypes)
    )).map(p => (scene.add(p.mesh), p));
};

function animate() {

  particles.forEach((particle) => particle.update(particles));
  controls.update();
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