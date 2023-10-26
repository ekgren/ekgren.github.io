// Initialize canvas and context
const canvas = document.getElementById("ca-canvas");
const ctx = canvas.getContext("2d");

// Define canvas size and center it
canvas.width = 400;
canvas.height = 400;

// Parameters
const cellSize = 2;
const rows = Math.floor(canvas.height / cellSize);
const cols = Math.floor(canvas.width / cellSize);
let automataGrid = [];

// Initialize grid with random states for R, G, B
function initGrid() {
    automataGrid = Array.from({length: rows}, () => 
      Array.from({length: cols}, () => ({
        R: Math.random(),
        G: Math.random(),
        B: Math.random()
      }))
    );
  }

function padGrid(grid, paddingSize) {
const paddedGrid = [
    ...grid.slice(-paddingSize),
    ...grid,
    ...grid.slice(0, paddingSize)
].map(row => [
    ...row.slice(-paddingSize),
    ...row,
    ...row.slice(0, paddingSize)
]);
return paddedGrid;
}  

// Define neighborhoods
const mooreNeighborhood = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],  [0, 0],  [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  const circle1 = [
    [-2, 0], [-1, -1], [-1, 1], [0, -2], [0, 2], [1, -1], [1, 1], [2, 0]
  ];
  
  const circle2 = [
    [-3, 0], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [0, -3], [0, 3], [1, -2], [1, 2], [2, -1], [2, 1], [3, 0]
  ];
  
// Weights for different neighborhoods
let wM = 0.99777777;
let wC1 = 0.99877777777777;
let wC2 = 0.0013737373737373;
  
function updateGrid() {
    const paddingSize = 7;  // Max distance of any neighborhood point from the cell
    const paddedGrid = padGrid(automataGrid, paddingSize);
  
    const newGrid = automataGrid.map((row, i) =>
      row.map((cell, j) => {
        let sumR = 0, sumG = 0, sumB = 0;
        let sumR1 = 0, sumG1 = 0, sumB1 = 0;
        let sumR2 = 0, sumG2 = 0, sumB2 = 0;
  
        // Helper to update sum based on neighborhood
        const updateSum = (neighborhood, sumR, sumG, sumB) => {
          for (const [dx, dy] of neighborhood) {
            const x = i + dx + paddingSize;
            const y = j + dy + paddingSize;
            sumR += paddedGrid[x][y].R;
            sumG += paddedGrid[x][y].G;
            sumB += paddedGrid[x][y].B;
          }
          return [sumR, sumG, sumB];
        };
  
        // Summing over different neighborhoods
        [sumR, sumG, sumB] = updateSum(mooreNeighborhood, sumR, sumG, sumB);
        [sumR1, sumG1, sumB1] = updateSum(circle1, sumR1, sumG1, sumB1);
        [sumR2, sumG2, sumB2] = updateSum(circle2, sumR2, sumG2, sumB2);
  
        // Calculate weighted averages using global variables for weights
        const avgR = wM * (sumR / mooreNeighborhood.length) + wC1 * (sumR1 / circle1.length) + wC2 * (sumR2 / circle2.length);
        const avgG = wM * (sumG / mooreNeighborhood.length) + wC1 * (sumG1 / circle1.length) + wC2 * (sumG2 / circle2.length);
        const avgB = wM * (sumB / mooreNeighborhood.length) + wC1 * (sumB1 / circle1.length) + wC2 * (sumB2 / circle2.length);
  
        // More complex, chaotic update rules
        // const dR = Math.sin(avgR * 2 * Math.PI) * (avgG - avgB);
        // const dG = Math.sin(avgG * 2 * Math.PI) * (avgB - avgR);
        // const dB = Math.sin(avgB * 2 * Math.PI) * (avgR - avgG);
        const dR = Math.sin(avgR * 0.1 * Math.PI) * (avgG - avgB);
        const dG = (avgB - avgR);
        const dB = (avgR - avgG);
  
        // Bounded update
        const newR = Math.min(Math.max(cell.R + dR, 0), 1);
        const newG = Math.min(Math.max(cell.G + dG, 0), 1);
        const newB = Math.min(Math.max(cell.B + dB, 0), 1);
  
        // Check for NaN and Infinity
        return {
          R: isNaN(newR) || !isFinite(newR) ? 0 : newR,
          G: isNaN(newG) || !isFinite(newG) ? 0 : newG,
          B: isNaN(newB) || !isFinite(newB) ? 0 : newB
        };
      })
    );
  
    automataGrid = newGrid;
  }
  

// Draw the automata grid with RGB channels
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    automataGrid.forEach((row, i) => {
      row.forEach((cell, j) => {
        ctx.fillStyle = `rgba(${Math.floor(255 * cell.R)}, ${Math.floor(255 * cell.G)}, ${Math.floor(255 * cell.B)}, 1)`;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      });
    });
  }

// Main loop with a fixed frame rate
let animationID;
const frameDelay = 1000 / 25;  // 25 frames per second

function mainLoop() {
  updateGrid();
  drawGrid();
  animationID = setTimeout(mainLoop, frameDelay);
}

// Button event listeners
document.getElementById("start-button").addEventListener("click", () => {
  if (!animationID) {
    animationID = setTimeout(mainLoop, frameDelay);
  }
});

document.getElementById("stop-button").addEventListener("click", () => {
  clearTimeout(animationID);
  animationID = null;
});

document.getElementById("reset-button").addEventListener("click", () => {
  initGrid();
  drawGrid();
});

// Initialize and draw initial grid
initGrid();
drawGrid();

function resetAndUpdate() {
  // Reset the grid and redraw
  initGrid();
  drawGrid();
}

// Listen to slider events to update weights
document.getElementById("moore-weight").addEventListener("input", (event) => {
  wM = parseFloat(event.target.value);
  resetAndUpdate();
});

document.getElementById("circle1-weight").addEventListener("input", (event) => {
  wC1 = parseFloat(event.target.value);
  resetAndUpdate();
});

document.getElementById("circle2-weight").addEventListener("input", (event) => {
  wC2 = parseFloat(event.target.value);
  resetAndUpdate();
});

// Randomize rules
document.getElementById("randomize-button").addEventListener("click", () => {
  wM = Math.random();
  wC1 = Math.random();
  wC2 = Math.random();

  // Normalize so they sum to 1
  const total = wM + wC1 + wC2;
  wM /= total;
  wC1 /= total;
  wC2 /= total;

  // Update sliders
  document.getElementById("moore-weight").value = wM;
  document.getElementById("circle1-weight").value = wC1;
  document.getElementById("circle2-weight").value = wC2;

  resetAndUpdate();
});
