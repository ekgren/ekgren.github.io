
const TensorLib = (() => {

class Tensor {
    constructor(data, shape) {
      this.data = data;
      this.shape = shape;
      this.rank = shape.length;
      this.size = shape.reduce((a, b) => a * b);
    }
  
    static fromArray(array, shape = null) {
      if (!shape) {
        shape = this.inferShape(array);
      }
      return new Tensor(new Float32Array(array.flat(Infinity)), shape);
    }
  
    static inferShape(array) {
      const shape = [];
      let curr = array;
      while (Array.isArray(curr)) {
        shape.push(curr.length);
        curr = curr[0];
      }
      return shape;
    }
  
    static zeros(shape) {
      const size = shape.reduce((a, b) => a * b);
      return new Tensor(new Float32Array(size), shape);
    }
  
    atIndex(...indices) {
      const idx = this.indicesToIndex(indices);
      return this.data[idx];
    }
  
    setAtIndex(value, ...indices) {
      const idx = this.indicesToIndex(indices);
      this.data[idx] = value;
    }
  
    indicesToIndex(indices) {
      let idx = 0;
      for (let i = 0; i < this.rank; ++i) {
        idx = idx * this.shape[i] + indices[i];
      }
      return idx;
    }
  
    indexToIndices(index) {
      let idx = index;
      const indices = new Array(this.rank);
      for (let i = this.rank - 1; i >= 0; --i) {
        indices[i] = idx % this.shape[i];
        idx = Math.floor(idx / this.shape[i]);
      }
      return indices;
    }
  
    map(fn) {
      const newData = new Float32Array(this.size);
      for (let i = 0; i < this.size; ++i) {
        const indices = this.indexToIndices(i);
        newData[i] = fn(this.data[i], ...indices);
      }
      return new Tensor(newData, this.shape);
    }
  
    add(other) {
      if (this.size !== other.size) {
        throw new Error("Tensor sizes do not match");
      }
      const newData = new Float32Array(this.size);
      for (let i = 0; i < this.size; ++i) {
        newData[i] = this.data[i] + other.data[i];
      }
      return new Tensor(newData, this.shape);
    }
  
    multiply(other) {
      if (this.size !== other.size) {
        throw new Error("Tensor sizes do not match");
      }
      const newData = new Float32Array(this.size);
      for (let i = 0; i < this.size; ++i) {
        newData[i] = this.data[i] * other.data[i];
      }
      return new Tensor(newData, this.shape);
    }
  
    // Add more operations as needed (subtract, divide, matmul, etc.)
  
    toString(maxElementsPerDim = 3, maxDecimalPlaces = 4, minExp = -4, maxExp = 4) {
      const shapeStr = `(${this.shape.join(', ')})`;
  
      const formatNumber = (num) => {
        const absNum = Math.abs(num);
        if (absNum >= Math.pow(10, minExp) && absNum < Math.pow(10, maxExp)) {
          return num.toFixed(maxDecimalPlaces);
        }
        return num.toExponential(maxDecimalPlaces - 1);
      };
  
      const getMaxWidth = (depth, index) => {
        if (depth === this.rank - 1) {
          let maxWidth = 0;
          for (let i = 0; i < this.shape[depth]; ++i) {
            maxWidth = Math.max(maxWidth, formatNumber(this.atIndex(...index, i)).length);
          }
          return maxWidth;
        }
  
        let maxWidth = 0;
        for (let i = 0; i < this.shape[depth]; ++i) {
          maxWidth = Math.max(maxWidth, getMaxWidth(depth + 1, [...index, i]));
        }
        return maxWidth;
      };
  
      const maxWidth = getMaxWidth(0, []);
      const bracketPadding = ' '.repeat(this.rank - 1);
  
      const formatArray = (depth, index) => {
        if (depth === this.rank - 1) {
          const elements = [];
          for (let i = 0; i < Math.min(maxElementsPerDim, this.shape[depth]); ++i) {
            elements.push(formatNumber(this.atIndex(...index, i)).padStart(maxWidth));
          }
          return '[' + elements.join(', ') + ']';
        }
  
        const subarrays = [];
        for (let i = 0; i < Math.min(maxElementsPerDim, this.shape[depth]); ++i) {
          subarrays.push(formatArray(depth + 1, [...index, i]));
        }
  
        if (this.shape[depth] > maxElementsPerDim) {
          subarrays.push('...'.padStart(maxWidth, ' '));
        }
  
        const separator = ', ';
        const newlinePrefix = bracketPadding + ' '.repeat(depth * (maxWidth + 2));
        return '[' + subarrays.join(separator + '\n' + newlinePrefix) + ']';
      };
  
      return `tensor(\n ${formatArray(0, [])},\nshape=${shapeStr})`;
    }
  } 
  
/*
// Example usage:
const tensorA = Tensor.fromArray([[1.123123123213, 2.123213123], [3, 4]]);
const tensorB = Tensor.fromArray([[5, 6], [7, 8]]);
const tensorC = tensorA.add(tensorB);
console.log(tensorC.toString());
*/

function pad(tensor, padSizes, mode = 'constant', constantValue = 0) {
    if (padSizes.length !== 2 * tensor.rank) {
      throw new Error('Invalid pad sizes');
    }
  
    // Compute the new shape
    const newShape = tensor.shape.map((dimSize, dimIdx) => dimSize + padSizes[dimIdx * 2] + padSizes[dimIdx * 2 + 1]);
    const newTensor = Tensor.zeros(newShape);
  
    // Pad tensor using the specified mode
    for (let i = 0; i < newTensor.size; ++i) {
      const newIndices = newTensor.indexToIndices(i);
      const originalIndices = newIndices.map((newIndex, dimIdx) => {
        const padBefore = padSizes[dimIdx * 2];
        const originalSize = tensor.shape[dimIdx];
  
        if (newIndex < padBefore || newIndex >= padBefore + originalSize) {
          return null; // Out of bounds
        }
        return newIndex - padBefore;
      });
  
      if (originalIndices.some(idx => idx === null)) {
        // Out of bounds, apply padding
        switch (mode) {
          case 'constant':
            newTensor.data[i] = constantValue;
            break;
          case 'zeros':
            newTensor.data[i] = 0;
            break;
          case 'circular':
            const circularIndices = originalIndices.map((idx, dimIdx) => {
              if (idx === null) {
                const padBefore = padSizes[dimIdx * 2];
                const originalSize = tensor.shape[dimIdx];
                return (newIndices[dimIdx] - padBefore + originalSize) % originalSize;
              }
              return idx;
            });
            newTensor.data[i] = tensor.atIndex(...circularIndices);
            break;
          default:
            throw new Error('Invalid padding mode');
        }
      } else {
        // Within bounds, copy original value
        newTensor.data[i] = tensor.atIndex(...originalIndices);
      }
    }
  
    return newTensor;
  }
/*
// Example usage:
const tensor = Tensor.fromArray([[1, 2], [3, 4]]);
const paddedTensor = pad(tensor, [0, 0, 1, 1], 'zeros');
console.log(tensor.toString());
console.log(paddedTensor.toString());
*/

function conv2d(input, weight, bias = null, stride = [1, 1], padding = [0, 0], dilation = [1, 1]) {
    const batchSize = input.shape[0];
    const inputChannels = input.shape[1];
    const inputHeight = input.shape[2];
    const inputWidth = input.shape[3];
  
    const outputChannels = weight.shape[0];
    const kernelHeight = weight.shape[2];
    const kernelWidth = weight.shape[3];
  
    const outputHeight = Math.floor((inputHeight + 2 * padding[0] - dilation[0] * (kernelHeight - 1) - 1) / stride[0]) + 1;
    const outputWidth = Math.floor((inputWidth + 2 * padding[1] - dilation[1] * (kernelWidth - 1) - 1) / stride[1]) + 1;
  
    const output = Tensor.zeros([batchSize, outputChannels, outputHeight, outputWidth]);
  
    for (let n = 0; n < batchSize; ++n) {
      for (let c = 0; c < outputChannels; ++c) {
        for (let h = 0; h < outputHeight; ++h) {
          for (let w = 0; w < outputWidth; ++w) {
            let value = 0;
            for (let ic = 0; ic < inputChannels; ++ic) {
              for (let kh = 0; kh < kernelHeight; ++kh) {
                for (let kw = 0; kw < kernelWidth; ++kw) {
                  const ih = h * stride[0] - padding[0] + kh * dilation[0];
                  const iw = w * stride[1] - padding[1] + kw * dilation[1];
  
                  if (ih >= 0 && ih < inputHeight && iw >= 0 && iw < inputWidth) {
                    const inputValue = input.atIndex(n, ic, ih, iw);
                    const weightValue = weight.atIndex(c, ic, kh, kw);
                    value += inputValue * weightValue;
                  }
                }
              }
            }
            if (bias) {
              value += bias.atIndex(c);
            }
            output.setAtIndex(value, n, c, h, w);
          }
        }
      }
    }
  
    return output;
  }
  /*
  // Example usage:
  const input = Tensor.fromArray([[
    [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]
  ]]);
  const kernel = Tensor.fromArray([[
    [
      [1, 0],
      [0, -1]
    ]
  ]]);
  const output = conv2d(input, kernel);
  console.log(output.toString());
  */

  return {
    Tensor,
    pad,
    conv2d,
  };
})();