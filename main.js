const canvas = document.getElementById('oscilloscope');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

class GameOfLife {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = this.createEmptyGrid();
  }

  createEmptyGrid() {
    return new Array(this.height)
      .fill(null)
      .map(() => new Array(this.width).fill(false));
  }

  seedFromAudioData(dataArray) {
    const threshold = 128;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        this.grid[y][x] = dataArray[index] > threshold;
      }
    }
  }

  draw(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x]) {
          ctx.fillRect(x * 10, y * 10, 10 - 1, 10 - 1);
        }
      }
    }
  }

  step() {
    const newGrid = this.createEmptyGrid();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const neighbors = this.getAliveNeighbors(x, y);
        const alive = this.grid[y][x];

        if (alive) {
          newGrid[y][x] = neighbors === 2 || neighbors === 3;
        } else {
          newGrid[y][x] = neighbors === 3;
        }
      }
    }

    this.grid = newGrid;
  }

  getAliveNeighbors(x, y) {
    const directions = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1]
    ];
    let count = 0;

    for (const [dx, dy] of directions) {
      const nx = (x + dx + this.width) % this.width;
      const ny = (y + dy + this.height) % this.height;
      count += this.grid[ny][nx] ? 1 : 0;
    }

    return count;
  }
}

async function getMicrophoneStream() {
  const constraints = { audio: true, video: false };
  return await navigator.mediaDevices.getUserMedia(constraints);
}

function setupAudio(stream, gameOfLife) {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  function draw() {
    ctx.clearRect(0, 0, width, height);
    analyser.getByteTimeDomainData(dataArray);

    gameOfLife.seedFromAudioData(dataArray);
    gameOfLife.draw(ctx);
    gameOfLife.step();

    requestAnimationFrame(draw);
  }

  draw();
}

const gameOfLifeCanvas = document.createElement('canvas');
gameOfLifeCanvas.width = 80;
gameOfLifeCanvas.height = 20;
document.body.appendChild(gameOfLifeCanvas);

const gameOfLifeCtx = gameOfLifeCanvas.getContext('2d');
gameOfLifeCtx.fillStyle = 'black';

const gameOfLife = new GameOfLife(gameOfLifeCanvas.width, gameOfLifeCanvas.height);

(async () => {
  try {
    const stream = await getMicrophoneStream();
    setupAudio(stream, gameOfLife);
  } catch (err) {
    console.error('Error accessing the microphone:', err);
  }
})();
