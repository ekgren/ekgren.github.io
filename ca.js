
/**
 * Float32Tensor: A simple tensor class for storing float32 numbers.
 *
 * Attributes:
 * - shape: Array of integers defining the shape of the tensor.
 * - size: Total number of elements in the tensor.
 * - data: Flat Float32Array storing the tensor elements.
 * - strides: Array of integers defining the strides for each dimension.
 */
class Float32Tensor {
    constructor(shape) {
        this.shape = shape;
        this.size = this.calculateTotalElements(shape);
        this.data = new Float32Array(this.size);
        this.strides = this.calculateStrides(shape);

        // Initialize with random values
        for (let i = 0; i < this.size; i++) {
            this.data[i] = Math.random();
        }
    }

    calculateTotalElements(shape) {
        return shape.reduce((acc, dim) => acc * dim, 1);
    }

    calculateStrides(shape) {
        const strides = new Array(shape.length);
        strides[strides.length - 1] = 1;

        for (let i = shape.length - 2; i >= 0; i--) {
            strides[i] = strides[i + 1] * shape[i + 1];
        }

        return strides;
    }

    toFlatIndex(indices) {
        let index = 0;

        for (let i = 0; i < this.strides.length; i++) {
            index += this.strides[i] * indices[i];
        }

        return index;
    }

    get(indices) {
        let flatIndex = 0;
        const len = this.strides.length;
        for (let i = 0; i < len; i++) {
            flatIndex += this.strides[i] * indices[i];
        }
        return this.data[flatIndex];
    }
    
    set(indices, value) {
        let flatIndex = 0;
        const len = this.strides.length;
        for (let i = 0; i < len; i++) {
            flatIndex += this.strides[i] * indices[i];
        }
        this.data[flatIndex] = value;
    }
  
}

// Main function to pad tensor with shape [bs, c, h, w]
function padTensor(tensor, paddingSize, mode = 'circular') {
  const [bs, c, h, w] = tensor.shape;
  const newH = h + 2 * paddingSize;  // Add padding to both sides of height
  const newW = w + 2 * paddingSize;  // Add padding to both sides of width

  // Initialize new tensor with the new shape
  const newTensor = new Float32Tensor([bs, c, newH, newW]);

  // Populate the new tensor
  for (let b = 0; b < bs; b++) {
    for (let ch = 0; ch < c; ch++) {
      for (let x = 0; x < newH; x++) {
        for (let y = 0; y < newW; y++) {
          let origX = x - paddingSize;
          let origY = y - paddingSize;

          // Implement circular padding
          if (mode === 'circular') {
            if (origX < 0) origX = (h + origX) % h;
            else if (origX >= h) origX %= h;

            if (origY < 0) origY = (w + origY) % w;
            else if (origY >= w) origY %= w;
          }

          // Copy values from the original tensor
          const val = (origX >= 0 && origX < h && origY >= 0 && origY < w) ? 
                      tensor.get([b, ch, origX, origY]) : 0;
          newTensor.set([b, ch, x, y], val);
        }
      }
    }
  }

  return newTensor;
}

// Unfold function to capture neighborhoods
function unfold(tensor, kernelSize) {
  // Assuming tensor shape is [bs, c, h, w]
  const [bs, c, h, w] = tensor.shape;
  
  const d = Math.floor(kernelSize / 2);  // Distance from center to edge of kernel
  const outH = h - 2 * d;  // Reduce the size of the output spatial dimensions
  const outW = w - 2 * d;
  
  // Initialize the output tensor
  const unfolded = new Float32Tensor([bs, c, outH, outW, kernelSize * kernelSize]);
  
  // Populate the unfolded tensor
  for (let b = 0; b < bs; b++) {
    for (let ch = 0; ch < c; ch++) {
      let k = 0;  // Index for the last dimension of the unfolded tensor
      for (let x = d; x < h - d; x++) {
        for (let y = d; y < w - d; y++) {
          for (let dx = -d; dx <= d; dx++) {
            for (let dy = -d; dy <= d; dy++) {
              const val = tensor.get([b, ch, x + dx, y + dy]);
              unfolded.set([b, ch, x - d, y - d, k], val);
              k++;
            }
          }
          k = 0;  // Reset k for the next block
        }
      }
    }
  }
  
  return unfolded;
}


// Custom reduce function for Game of Life
const gameOfLifeRule = (vals) => {
  const centerIdx = Math.floor(vals.length / 2);
  const currentState = vals[centerIdx];
  const sum = vals.reduce((acc, v) => acc + v, 0) - currentState;  // Exclude the center cell
  return currentState ? (sum === 2 || sum === 3) : (sum === 3);
};

// Reduce function
function reduceLastDimension(tensor, reduceFn) {
  // Assuming tensor shape is [bs, c, h, w, k]
  const [bs, c, h, w, k] = tensor.shape;
  
  // Initialize the output tensor
  const reduced = new Float32Tensor([bs, c, h, w]);
  
  // Populate the reduced tensor
  for (let b = 0; b < bs; b++) {
    for (let ch = 0; ch < c; ch++) {
      for (let x = 0; x < h; x++) {
        for (let y = 0; y < w; y++) {
          let vals = [];
          for (let ki = 0; ki < k; ki++) {
            vals.push(tensor.get([b, ch, x, y, ki]));
          }
          const reducedVal = reduceFn(vals);
          reduced.set([b, ch, x, y], reducedVal);
        }
      }
    }
  }
  
  return reduced;
}


const gameRule = (neighborhood) => {
  const kernel = [.9, 1., .9, 
                  1., 0., 1.,
                  .9, 1., .9];

  let sumNeighbors = 0;
  for (let i = 0; i < neighborhood.length; i++) {
    sumNeighbors += neighborhood[i] * kernel[i];
  }
  
  if (sumNeighbors >= 0 && sumNeighbors < 2) {
    return 0.;
  } else if (sumNeighbors >= 2 && sumNeighbors < 3) {
    return 0.95;
  } else if (sumNeighbors >= 3) {
    return 0.12;
  }
};



/**
 * // Create a Float32Tensor object of shape [1, 1, 4, 4] (N=1, C=1, H=4, W=4)
 * const tensor = new Float32Tensor([1, 1, 4, 4]);
 * 
 * // Print the original tensor data (it should be filled with random numbers)
 * console.log("Original tensor data:", tensor.data);
 * 
 * // Apply unfold with a kernel size of [2, 2] and stride of [1, 1]
 * const unfolded = tensor.unfold([2, 2], [1, 1]);
 * 
 * // Print the unfolded tensor data
 * console.log("Unfolded tensor data:", unfolded.data);
 */

// Usage
// const tensor = new Float32Tensor([1, 3, 100, 100]);

// Get an element
// const value = tensor.get([0, 2, 50, 50]);

// Set an element
// tensor.set([0, 2, 50, 50], 0.42);

// const paddingSize = [[0, 0], [0, 0], [2, 2], [2, 2]];  // Pad 1 row on both sides in dim 0, 2 rows in dim 1, and 3 rows in dim 2

// Padding with constant value
// const paddedTensorConstant = padTensor(tensor, paddingSize, 'constant', 0.42);

// Padding with circular mode
// const paddedTensorCircular = padTensor(tensor, paddingSize, 'circular');

// Initialize canvas and context
const canvas = document.getElementById("ca-canvas");
const ctx = canvas.getContext("2d");

// Define canvas size and center it
canvas.width = 400;
canvas.height = 400;

// Parameters
const cellSize = 4;
const rows = Math.floor(canvas.height / cellSize);
const cols = Math.floor(canvas.width / cellSize);
let automataGrid;

// Initialize grid with random states for R, G, B
function initGrid() {
  automataGrid = new Float32Tensor([1, 1, rows, cols]);
}
  
function updateGrid() {
    const paddingSize = 1;  // Max distance of any neighborhood point from the cell
    const paddedGrid = padTensor(automataGrid, paddingSize, 'circular');
    const unfoldedGrid = unfold(paddedGrid, 3);

    // Example usage
    const newGrid = reduceLastDimension(unfoldedGrid, gameRule);

    console.log("newGrid", newGrid.shape)
  
    automataGrid = newGrid;
  }
  

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const shape = automataGrid.shape;  // Either [bs, 3, h, w] or [bs, 1, h, w]
    const channels = shape[1];
    const rows = shape[2];
    const cols = shape[3];
  
    for (let i = 0; i < rows; ++i) {
      for (let j = 0; j < cols; ++j) {
        let R, G, B;
  
        if (channels === 3) {
          // RGB
          R = automataGrid.get([0, 0, i, j]);
          G = automataGrid.get([0, 1, i, j]);
          B = automataGrid.get([0, 2, i, j]);
        } else {
          // Grayscale
          const gray = automataGrid.get([0, 0, i, j]);
          R = G = B = gray;
        }
        
        ctx.fillStyle = `rgba(${Math.floor(255 * R)}, ${Math.floor(255 * G)}, ${Math.floor(255 * B)}, 1)`;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
  }
  


// Main loop with a fixed frame rate
let animationID;
const frameDelay = 1000 / 50;  // 25 frames per second

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
