const { Tensor, pad, conv2d } = TensorLib;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 200;
const cellSize = canvas.width / gridSize;
let gameInterval;

// Initialize game state
function initGameState(n) {
  const data = new Array(gridSize).fill(0).map(() => new Array(gridSize).fill(0).map(() => Math.random() < 0.5 ? n : 0));
  return Tensor.fromArray(data, [1, 1, gridSize, gridSize]);
}

let gameState = initGameState(5);
let memState = initGameState(0);

function updateGameState(state, mem) {
    
    const kernel = Tensor.fromArray([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1]
    ], [1, 1, 3, 3]);
    /*
    const size = 3;
    const kernelData = new Array(size).fill(0).map(() => new Array(size).fill(0).map(() => Math.random() < 0.5 ? 1 : 0));
    const kernel = Tensor.fromArray(kernelData, [1, 1, size, size]);
    */
    // Use circular mode for padding
    const paddedState = pad(state, [0, 0, 0, 0, 1, 1, 1, 1], 'circular');
    // const neighborCount = conv2d(paddedState, kernel, null, [1, 1], [0, 0], [1, 1]);
    const newMem = mem.add(conv2d(paddedState, kernel, null, [1, 1], [0, 0], [1, 1]));
    const newState = Tensor.zeros(state.shape);

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // If cell is alive
        if (state.atIndex(0, 0, i, j) >= 0.5) {
          /*
          // If cell has 2 or 3 neighbors, it stays alive
          if (neighborCount.atIndex(0, 0, i, j) === 2 ) {
            newState.setAtIndex(1, 0, 0, i, j);}
          else if (neighborCount.atIndex(0, 0, i, j) === 3) {
            newState.setAtIndex(1, 0, 0, i, j);}
          // Otherwise, it dies
          else {
            newState.setAtIndex(0, 0, 0, i, j);}} 
          */
            const n = state.atIndex(0, 0, i, j) - 1;
            newState.setAtIndex(n, 0, 0, i, j);
          }
        // else cell is dead
        else {
          /* 
          // If cell has 3 neighbors, it comes alive
          if (neighborCount.atIndex(0, 0, i, j) === 3) {
            newState.setAtIndex(1, 0, 0, i, j);} 
          // Otherwise, it stays dead
          else {
            newState.setAtIndex(0, 0, 0, i, j);}
          }
          */
          if (mem.atIndex(0, 0, i, j) >= 24 ) {
            newState.setAtIndex(2, 0, 0, i, j);
            newMem.setAtIndex(0, 0, 0, i, j);}
        }
      }
    }

    return [newState, newMem];
  }
  

// Render the game state on the canvas
function renderGameState(state) {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (state.atIndex(0, 0, i, j) >= 0.5) {        
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
  }
}

// Add event listeners for the buttons
document.getElementById('startButton').addEventListener('click', () => {
  if (!gameInterval) {
    gameInterval = setInterval(() => {
      [gameState, memState] = updateGameState(gameState, memState);
      renderGameState(gameState);
    }, 100);
  }
});

document.getElementById('stopButton').addEventListener('click', () => {
  clearInterval(gameInterval);
  gameInterval = null;
});

document.getElementById('resetButton').addEventListener('click', () => {
  clearInterval(gameInterval);
  gameInterval = null;
  gameState = initGameState(); // Tensor.zeros([1, 1, gridSize, gridSize]);
  renderGameState(gameState);
});

// Initialize the canvas with the initial game state
renderGameState(gameState, memState);
