import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, scene, renderer;
let colors;
let particles;
let conf;
let controls;
let animationId = null;

let forces;

conf = {
    size: 500,
    numTypes: 10,
    numForces: 1,
    numParticles: 100,
    trailLength: 100,
    // Below are derived values
    size2: 250,
    cameraDistance: 500 * 1.4,
};

const G = 1.; //6.67430e-11; // Gravitational constant
const k = 8.99 * Math.pow(10, 9);
const mu0 = 4 * Math.PI * Math.pow(10, -3);
const EPSILON = 1e-6; // A small constant
// Time step (delta t)
const dt = 0.01; // Adjust this value according to your simulation's needs

const PARTICLE_SIZE = 4.0;
const c = 1.06; // Speed of light

function wrap(value, min, max) {
    /**
     * Wraps a value between a given minimum and maximum value.
     */
    const rangeSize = max - min;
    const valueRelativeToMin = value - min;
    const wrappedPosition = (valueRelativeToMin % rangeSize + rangeSize) % rangeSize;

    return wrappedPosition + min;
}


class Particle {

    constructor(config, type) {
        this.mass = 100 * Math.random();
        this.charge = 0.001 * Math.random();
        this.type = type;
        this.typeColor = colors[type];
        this.mesh = new THREE.Mesh(
            // new THREE.SphereGeometry(PARTICLE_SIZE, 4, 5),
            new THREE.SphereGeometry(1.5 + .1 * this.mass, 4, 5),
            new THREE.MeshBasicMaterial({ color: this.typeColor })
        );
        this.mesh.position.set(
            Math.random() * conf.size - conf.size2,
            Math.random() * conf.size - conf.size2,
            Math.random() * conf.size - conf.size2,
        );
        this.velocity = new THREE.Vector3(Math.random()*0.2-0.1, Math.random()*0.2-0.1, Math.random()*0.2-0.1);
        this.totalForceVector = new THREE.Vector3();

        /*** TRAIL ***/
            // Create a buffer geometry for the trail
            const trailGeometry = new THREE.BufferGeometry();
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(conf.trailLength * 3), 3));
            const trailMaterial = new THREE.LineBasicMaterial({ color: this.typeColor });

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
        /** END TRAIL **/
    }

    update(particles) {

        this.mesh.position.set(
            wrap(this.mesh.position.x, -conf.size2, conf.size2), 
            wrap(this.mesh.position.y, -conf.size2, conf.size2),
            wrap(this.mesh.position.z, -conf.size2, conf.size2)
        );

        const m1 = this.mass + 1e-6;

        particles.forEach((particle) => {
            if (this !== particle) {
                // Initialize total electric and magnetic fields to zero
                const E_total = new THREE.Vector3(0, 0, 0);
                const B_total = new THREE.Vector3(0, 0, 0);
                
                const m2 = particle.mass;
                
                // Calculate the distance delta vector
                const delta = new THREE.Vector3().subVectors(this.mesh.position, particle.mesh.position);
                delta.set(
                    wrap(delta.x, -conf.size2, conf.size2),
                    wrap(delta.y, -conf.size2, conf.size2),
                    wrap(delta.z, -conf.size2, conf.size2)
                );

                // Calculate the distance (magnitude of the vector)
                const r = delta.length();
                const r_hat = delta.normalize();

                // Calculate the electric field contribution from this particle
                const E_contribution = r_hat.clone().multiplyScalar(k * particle.charge / (r * r));

                // Calculate the magnetic field contribution from this particle
                const v_cross_r_hat = new THREE.Vector3().crossVectors(particle.velocity, r_hat);
                const B_contribution = v_cross_r_hat.multiplyScalar(mu0 / (4 * Math.PI) * particle.charge / (r * r));

                // Add these contributions to the total electric and magnetic fields
                E_total.add(E_contribution);
                B_total.add(B_contribution);
                
                // Calculate the relative velocity
                // const relativeVelocity = new THREE.Vector3().subVectors(this.velocity, particle.velocity);
                const relativeVelocity = new THREE.Vector3().copy(particle.velocity).multiplyScalar(-1)
                const relativeSpeed = relativeVelocity.length();

                // Calculate the time dilation factor (gamma) using the relative speed
                const innerSqrt = Math.max(1 - Math.pow(relativeSpeed / c, 2), 0); // Prevent negative values
                const gamma = 1 / Math.sqrt(innerSqrt); // Gamma is 1 if relativeSpeed == 0 and approaches infinity as relativeSpeed approaches c

                // Adjust dt based on gamma
                const dt_dilated = dt / gamma;

                // Calculate the force magnitude
                const F = - G * (m1 * m2) / (r * r + EPSILON);

                // Normalize the delta vector to get the direction
                const direction = delta.normalize();

                // Calculate the force vector by scaling the direction vector by the force magnitude
                const force = direction.multiplyScalar(F);
                this.totalForceVector.set(0, 0, 0); // Reset the total force vector
                this.totalForceVector.add(force);   // Add the gravitational force

                // Now that we have the total fields, calculate the Lorentz force
                const v_cross_B = new THREE.Vector3().crossVectors(this.velocity, B_total);
                const F_Lorentz = E_total.clone().add(v_cross_B).multiplyScalar(this.charge);
                
                // Add this to the total force
                this.totalForceVector.add(F_Lorentz);

                // Calculate the acceleration
                //const acceleration = new THREE.Vector3().copy(force).divideScalar(m1);
                const acceleration = new THREE.Vector3().copy(this.totalForceVector).divideScalar(m1);

                this.velocity.add(acceleration.multiplyScalar(dt));
                // Update the velocity
                this.velocity.add(acceleration.multiplyScalar(dt_dilated));
                if (this.velocity.length() > c) {
                    this.velocity.normalize().multiplyScalar(c);
                }

                // Calculate the distance the particle would travel in one update (without length contraction)
                const properDistance = this.velocity.clone().multiplyScalar(dt);

                // Apply length contraction to the distance
                const contractedDistance = properDistance.multiplyScalar(1 / gamma);

                // Update the position using the contracted distance
                this.mesh.position.add(contractedDistance);
                
            }
        })
        
        /*** TRAIL ***/
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
        /** END TRAIL **/
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
    camera = null; scene = null; renderer = null; colors = null; particles = null; animationId = null;

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
    controls.autoRotateSpeed = 0.2;

    // Limit the rotation to the XY plane
    controls.minPolarAngle = Math.PI / 2; // 90 degrees in radians
    controls.maxPolarAngle = Math.PI / 2; // 90 degrees in radians

    /*** GUI ***/
    const gui = new GUI();

    gui.add(conf, 'size', 1, 600).step(1).onChange(() => cleanup());
    // gui.add(conf, 'numTypes', 1, 50).step(1).onChange(() => cleanup());
    // gui.add(conf, 'numForces', 1, 20).step(1).onChange(() => cleanup());
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

    // Generate the particles
    particles = Array.from({ length: conf.numParticles }, () => new Particle(
        conf,
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