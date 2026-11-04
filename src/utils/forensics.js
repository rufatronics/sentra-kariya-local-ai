// src/utils/forensics.js
// Pure signal extraction utilities for document verification.
// All judgment, classification, and reasoning is left to Gemma 4.

import FFT from 'fft.js';

// ─── 1. Error Level Analysis (ELA) ─────────────────────────────────────────
export async function performELA(imageElement, quality = 0.85) {
  return new Promise((resolve) => {
    try {
      const width = imageElement.naturalWidth || imageElement.width;
      const height = imageElement.naturalHeight || imageElement.height;

      // Original Canvas
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = width;
      originalCanvas.height = height;
      const originalCtx = originalCanvas.getContext('2d');
      originalCtx.drawImage(imageElement, 0, 0);

      // Re-compress to JPEG
      originalCanvas.toBlob(async (blob) => {
        if (!blob) {
          resolve({ error: 'Failed to create ELA blob', score: 0 });
          return;
        }

        const compressedUrl = URL.createObjectURL(blob);
        const compressedImage = new Image();
        compressedImage.onload = () => {
          // Compressed Canvas
          const compressedCanvas = document.createElement('canvas');
          compressedCanvas.width = width;
          compressedCanvas.height = height;
          const compressedCtx = compressedCanvas.getContext('2d');
          compressedCtx.drawImage(compressedImage, 0, 0);

          const originalData = originalCtx.getImageData(0, 0, width, height);
          const compressedData = compressedCtx.getImageData(0, 0, width, height);

          // Create Heatmap Canvas
          const heatmapCanvas = document.createElement('canvas');
          heatmapCanvas.width = width;
          heatmapCanvas.height = height;
          const heatmapCtx = heatmapCanvas.getContext('2d');
          const heatmapData = heatmapCtx.createImageData(width, height);

          let totalDiff = 0;
          const pixelCount = width * height;

          for (let i = 0; i < originalData.data.length; i += 4) {
            const rDiff = Math.abs(originalData.data[i] - compressedData.data[i]);
            const gDiff = Math.abs(originalData.data[i + 1] - compressedData.data[i + 1]);
            const bDiff = Math.abs(originalData.data[i + 2] - compressedData.data[i + 2]);

            // Accumulate difference score
            const avgDiff = (rDiff + gDiff + bDiff) / 3;
            totalDiff += avgDiff;

            // Amplify difference for visualization (scaled ELA)
            const scale = 20;
            heatmapData.data[i] = Math.min(255, rDiff * scale);     // R
            heatmapData.data[i + 1] = Math.min(255, gDiff * scale); // G
            heatmapData.data[i + 2] = Math.min(255, bDiff * scale); // B
            heatmapData.data[i + 3] = 255;                          // A
          }

          heatmapCtx.putImageData(heatmapData, 0, 0);
          const averageDiffScore = totalDiff / pixelCount;

          resolve({
            score: averageDiffScore,
            heatmapDataUrl: heatmapCanvas.toDataURL('image/png'),
            width,
            height
          });

          URL.revokeObjectURL(compressedUrl);
        };

        compressedImage.onerror = () => {
          resolve({ error: 'Failed to load compressed ELA image', score: 0 });
        };

        compressedImage.src = compressedUrl;
      }, 'image/jpeg', quality);
    } catch (err) {
      resolve({ error: err.message, score: 0 });
    }
  });
}

// ─── 2. FFT-based Artifact Check ───────────────────────────────────────────
// Flags periodic frequency peaks associated with AI-generated images
export async function performFFTCheck(imageElement) {
  try {
    const size = 128; // Downscaled grayscale size (power of 2)
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Convert to grayscale intensity values
    const grayscale = new Float32Array(size * size);
    for (let i = 0; i < data.length; i += 4) {
      // Standard luminance formula
      grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Perform row-by-row FFTs and compute average 1D magnitude spectrum
    const fft = new FFT(size);
    const avgMagnitude = new Float32Array(size / 2);

    for (let row = 0; row < size; row++) {
      const input = new Array(size);
      for (let col = 0; col < size; col++) {
        input[col] = grayscale[row * size + col];
      }
      const out = fft.createComplexArray();
      fft.realTransform(out, input);
      fft.completeSpectrum(out);

      // Compute magnitude of positive frequencies (excluding DC component at index 0)
      for (let k = 1; k < size / 2; k++) {
        const re = out[2 * k];
        const im = out[2 * k + 1];
        const mag = Math.sqrt(re * re + im * im);
        avgMagnitude[k] += mag / size;
      }
    }

    // Extract statistics and top peaks from the frequency spectrum
    let sum = 0;
    for (let k = 1; k < size / 2; k++) {
      sum += avgMagnitude[k];
    }
    const mean = sum / (size / 2 - 1);

    let varianceSum = 0;
    for (let k = 1; k < size / 2; k++) {
      varianceSum += Math.pow(avgMagnitude[k] - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / (size / 2 - 1));

    // Find peaks relative to neighbors (excluding very low frequencies < 5)
    const peaks = [];
    for (let k = 5; k < size / 2 - 1; k++) {
      if (avgMagnitude[k] > avgMagnitude[k - 1] && avgMagnitude[k] > avgMagnitude[k + 1]) {
        const threshold = mean + 2.5 * stdDev;
        if (avgMagnitude[k] > threshold) {
          peaks.push({
            frequencyIndex: k,
            magnitude: avgMagnitude[k],
            stdDevsAboveMean: (avgMagnitude[k] - mean) / (stdDev || 1)
          });
        }
      }
    }

    // Sort by prominence (highest magnitude first)
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    return {
      spectrumMean: mean,
      spectrumStdDev: stdDev,
      detectedPeaksCount: peaks.length,
      topPeaks: peaks.slice(0, 5)
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── 3. Noise Consistency Map (Laplacian / Block Variance) ───────────────
export async function performNoiseConsistency(imageElement) {
  try {
    const scaleWidth = 256;
    const scaleHeight = 256;
    const canvas = document.createElement('canvas');
    canvas.width = scaleWidth;
    canvas.height = scaleHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, scaleWidth, scaleHeight);

    const imgData = ctx.getImageData(0, 0, scaleWidth, scaleHeight);
    const data = imgData.data;

    // Convert to grayscale
    const gray = new Float32Array(scaleWidth * scaleHeight);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Laplacian Filter Kernel convolution:
    //  0  1  0
    //  1 -4  1
    //  0  1  0
    const laplacian = new Float32Array(scaleWidth * scaleHeight);
    for (let y = 1; rowSafeCheck(y, scaleHeight); y++) {
      for (let x = 1; colSafeCheck(x, scaleWidth); x++) {
        const idx = y * scaleWidth + x;
        const neighborsSum =
          gray[idx - scaleWidth] + // top
          gray[idx + scaleWidth] + // bottom
          gray[idx - 1] +          // left
          gray[idx + 1];           // right
        laplacian[idx] = neighborsSum - 4 * gray[idx];
      }
    }

    // Local Variance per 16x16 grid block
    const blockSize = 16;
    const blocksX = scaleWidth / blockSize;
    const blocksY = scaleHeight / blockSize;
    const blockVariances = [];

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        // Collect block values
        const values = [];
        let blockSum = 0;
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            const px = (by * blockSize + y) * scaleWidth + (bx * blockSize + x);
            values.push(laplacian[px]);
            blockSum += laplacian[px];
          }
        }
        const blockMean = blockSum / values.length;
        let blockVarSum = 0;
        for (const val of values) {
          blockVarSum += Math.pow(val - blockMean, 2);
        }
        const blockVar = blockVarSum / values.length;
        blockVariances.push(blockVar);
      }
    }

    // Sort to compute Median block variance
    const sortedVariances = [...blockVariances].sort((a, b) => a - b);
    const medianVariance = sortedVariances[Math.floor(sortedVariances.length / 2)];

    // Variance of Variances (Standard Deviation of local noise block variances)
    let varSum = 0;
    blockVariances.forEach(v => { varSum += v; });
    const meanVariance = varSum / blockVariances.length;

    let varVarSum = 0;
    blockVariances.forEach(v => { varVarSum += Math.pow(v - meanVariance, 2); });
    const stdDevOfVariances = Math.sqrt(varVarSum / blockVariances.length);

    // Count blocks deviating significantly from median
    let highDeviationBlocks = 0;
    blockVariances.forEach(v => {
      if (Math.abs(v - medianVariance) > 2 * stdDevOfVariances) {
        highDeviationBlocks++;
      }
    });

    return {
      totalBlocksAnalyzed: blockVariances.length,
      medianNoiseVariance: medianVariance,
      noiseVarianceStdDev: stdDevOfVariances,
      highDeviationBlocksCount: highDeviationBlocks,
      minBlockVariance: sortedVariances[0],
      maxBlockVariance: sortedVariances[sortedVariances.length - 1]
    };
  } catch (err) {
    return { error: err.message };
  }
}

function rowSafeCheck(y, limit) { return y < limit - 1; }
function colSafeCheck(x, limit) { return x < limit - 1; }

// ─── 4. Text Line Alignment & Stamp Isolation (OpenCV.js) ────────────────
export async function performOpenCVForensics(imageElement) {
  return new Promise((resolve) => {
    try {
      if (!window.cv) {
        resolve({ error: 'OpenCV.js is not yet loaded in browser environment' });
        return;
      }

      const cv = window.cv;
      const src = cv.imread(imageElement);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // --- 4a. Text Line Alignment Analysis ---
      const binary = new cv.Mat();
      cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

      // Morphological dilate horizontally to group text lines together
      const horizontalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25, 3));
      const dilated = new cv.Mat();
      cv.dilate(binary, dilated, horizontalKernel);

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const textLines = [];
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const rect = cv.boundingRect(cnt);
        const aspectRatio = rect.width / (rect.height || 1);

        // Heuristic filtering for horizontal line-like contours (exclude full page or small noise)
        if (aspectRatio > 3 && rect.width > 30 && rect.height > 4 && rect.width < src.cols * 0.95) {
          textLines.push(rect);
        }
      }

      // Compute spacing consistency & baseline y-variance
      let baselineYVariance = 0;
      let verticalSpacingVariance = 0;
      let verticalSpacings = [];

      if (textLines.length > 1) {
        // Sort text lines top-to-bottom
        textLines.sort((a, b) => a.y - b.y);

        // Calculate spacings between lines
        for (let i = 1; i < textLines.length; i++) {
          const spacing = textLines[i].y - (textLines[i - 1].y + textLines[i - 1].height);
          if (spacing >= 0) verticalSpacings.push(spacing);
        }

        // Variance of spacing
        if (verticalSpacings.length > 0) {
          let sumSp = 0;
          verticalSpacings.forEach(s => { sumSp += s; });
          const meanSp = sumSp / verticalSpacings.length;
          let varSumSp = 0;
          verticalSpacings.forEach(s => { varSumSp += Math.pow(s - meanSp, 2); });
          verticalSpacingVariance = varSumSp / verticalSpacings.length;
        }

        // Baseline Y centers variance relative to standard trend line if needed,
        // or just center deviation from average line spacing.
        let yCenters = textLines.map(line => line.y + line.height);
        let sumY = 0;
        yCenters.forEach(y => { sumY += y; });
        const meanY = sumY / yCenters.length;
        let varSumY = 0;
        yCenters.forEach(y => { varSumY += Math.pow(y - meanY, 2); });
        baselineYVariance = varSumY / yCenters.length;
      }

      // --- 4b. Stamp / Signature Isolation & Analysis ---
      // Detect colored blobs (blue, red, magenta stamps or signatures)
      const hsv = new cv.Mat();
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      // Create masks for blue/purple and red regions
      const blueMask = new cv.Mat();
      const redMask1 = new cv.Mat();
      const redMask2 = new cv.Mat();
      const redMask = new cv.Mat();

      // HSV Ranges:
      // Blue: H: 90-130, S: 50-255, V: 50-255
      const lowBlue = new cv.Mat(src.rows, src.cols, src.type(), [90, 50, 50, 0]);
      const highBlue = new cv.Mat(src.rows, src.cols, src.type(), [130, 255, 255, 255]);
      cv.inRange(hsv, lowBlue, highBlue, blueMask);

      // Red wraps around 0 and 180
      const lowRed1 = new cv.Mat(src.rows, src.cols, src.type(), [0, 50, 50, 0]);
      const highRed1 = new cv.Mat(src.rows, src.cols, src.type(), [10, 255, 255, 255]);
      const lowRed2 = new cv.Mat(src.rows, src.cols, src.type(), [170, 50, 50, 0]);
      const highRed2 = new cv.Mat(src.rows, src.cols, src.type(), [180, 255, 255, 255]);

      cv.inRange(hsv, lowRed1, highRed1, redMask1);
      cv.inRange(hsv, lowRed2, highRed2, redMask2);
      cv.bitwise_or(redMask1, redMask2, redMask);

      // Combined Stamp color mask
      const stampMask = new cv.Mat();
      cv.bitwise_or(blueMask, redMask, stampMask);

      const stampContours = new cv.MatVector();
      const stampHierarchy = new cv.Mat();
      cv.findContours(stampMask, stampContours, stampHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const detectedStampRegions = [];
      for (let i = 0; i < stampContours.size(); i++) {
        const cnt = stampContours.get(i);
        const rect = cv.boundingRect(cnt);
        const area = cv.contourArea(cnt);

        // Filter by reasonable Stamp/Signature dimensions and area
        if (rect.width > 20 && rect.height > 20 && area > 200) {
          detectedStampRegions.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area
          });
        }
      }

      // Cleanup
      src.delete(); gray.delete(); binary.delete(); horizontalKernel.delete();
      dilated.delete(); contours.delete(); hierarchy.delete(); hsv.delete();
      blueMask.delete(); redMask1.delete(); redMask2.delete(); redMask.delete();
      stampMask.delete(); stampContours.delete(); stampHierarchy.delete();
      lowBlue.delete(); highBlue.delete(); lowRed1.delete(); highRed1.delete();
      lowRed2.delete(); highRed2.delete();

      resolve({
        textLinesDetectedCount: textLines.length,
        textLineBaselineYVariance: baselineYVariance,
        textLineVerticalSpacingVariance: verticalSpacingVariance,
        detectedStampRegionsCount: detectedStampRegions.length,
        stampRegionsList: detectedStampRegions.slice(0, 5) // Top 5
      });
    } catch (err) {
      resolve({ error: `OpenCV Error: ${err.message}` });
    }
  });
}

// ─── 5. Re-compression depth estimate (JPEG Quantization Parser) ───────────
// Checks JPEG quantization table (DQT) artifacts to find compression signatures
export async function parseJPEGQuantization(file) {
  if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
    return { status: 'not_applicable', reason: 'File is not a JPEG' };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const buffer = new Uint8Array(e.target.result);
        let i = 0;

        // Verify JPEG SOI marker (0xFFD8)
        if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
          resolve({ error: 'Invalid JPEG SOI marker' });
          return;
        }

        const tables = [];
        i = 2;
        while (i < buffer.length - 1) {
          if (buffer[i] === 0xFF) {
            const marker = buffer[i + 1];
            // 0xFFDB is DQT (Define Quantization Table) marker
            if (marker === 0xDB) {
              const length = (buffer[i + 2] << 8) + buffer[i + 3];
              let tablePtr = i + 4;
              const tableEnd = i + 2 + length;

              while (tablePtr < tableEnd) {
                const info = buffer[tablePtr];
                const id = info & 0x0F;
                const precision = (info >> 4) === 0 ? 8 : 16;
                const tableValues = [];

                tablePtr++;
                const valueCount = 64; // 8x8 block size
                for (let k = 0; k < valueCount; k++) {
                  if (tablePtr >= buffer.length) break;
                  if (precision === 8) {
                    tableValues.push(buffer[tablePtr]);
                    tablePtr++;
                  } else {
                    tableValues.push((buffer[tablePtr] << 8) + buffer[tablePtr + 1]);
                    tablePtr += 2;
                  }
                }

                tables.push({ id, precision, values: tableValues });
              }
              i += 2 + length;
            } else if (marker === 0xD9) {
              // EOI (End of Image) marker, stop parsing
              break;
            } else {
              // Skip other sections
              const length = (buffer[i + 2] << 8) + buffer[i + 3];
              i += 2 + length;
            }
          } else {
            i++;
          }
        }

        if (tables.length === 0) {
          resolve({ status: 'no_tables_found', message: 'No standard DQT found. Might be custom or optimized.' });
          return;
        }

        // Calculate compression signatures
        // Standard quantization table averages range from ~10 (high quality) to ~80 (low quality)
        const luminanceTable = tables.find(t => t.id === 0);
        let averageLuminanceStep = null;
        if (luminanceTable && luminanceTable.values.length === 64) {
          let sum = 0;
          luminanceTable.values.forEach(v => { sum += v; });
          averageLuminanceStep = sum / 64;
        }

        resolve({
          status: 'success',
          tablesCount: tables.length,
          tablesMeta: tables.map(t => ({ id: t.id, precision: t.precision })),
          averageLuminanceStep: averageLuminanceStep,
          rawLuminanceQuantizationTable: luminanceTable ? luminanceTable.values : null
        });
      } catch (err) {
        resolve({ error: err.message });
      }
    };

    reader.onerror = () => {
      resolve({ error: 'Failed to read JPEG buffer' });
    };

    reader.readAsArrayBuffer(file);
  });
}
