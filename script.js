const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 10;
const numRows = canvas.height / cellSize;
const numCols = canvas.width / cellSize;
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const clearButton = document.getElementById('clearButton');
let interval;
let grid;

function createGrid(rows, cols) {
  return new Array(rows).fill(null).map(() => new Array(cols).fill(false));
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      if (grid[row][col]) {
        ctx.fillStyle = 'black';
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }
}

function randomizeGrid() {
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      grid[row][col] = Math.random() < 0.5;
    }
  }
}

function countNeighbors(row, col) {
    const neighbors = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];
  
    let count = 0;
  
    neighbors.forEach(([dx, dy]) => {
      const newRow = row + dx;
      const newCol = col + dy;
  
      if (
        newRow >= 0 && newRow < numRows &&
        newCol >= 0 && newCol < numCols &&
        grid[newRow][newCol]
      ) {
        count++;
      }
    });
  
    return count;
  }
  
  function step() {
    const newGrid = createGrid(numRows, numCols);
  
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const aliveNeighbors = countNeighbors(row, col);
        const isAlive = grid[row][col];
  
        if (isAlive) {
          newGrid[row][col] = aliveNeighbors === 2 || aliveNeighbors === 3;
        } else {
          newGrid[row][col] = aliveNeighbors === 3;
        }
      }
    }
  
    grid = newGrid;
    drawGrid();
  }
  
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
  
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
  
    grid[row][col] = !grid[row][col];
    drawGrid();
  });
  
  startButton.addEventListener('click', () => {
    if (!interval) {
      interval = setInterval(step, 100);
    }
  });
  
  stopButton.addEventListener('click', () => {
    clearInterval(interval);
    interval = null;
  });
  
  clearButton.addEventListener('click', () => {
    grid = createGrid(numRows, numCols);
    drawGrid();
  });
  
  grid = createGrid(numRows, numCols);
  drawGrid();
  