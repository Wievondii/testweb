/**
 * Client-side image compressor using Canvas API
 * Targets < 4.5MB (safety margin under Telegraph 5MB limit)
 */
const ImageCompressor = (() => {
  const MAX_DIMENSION = 2048;
  const TARGET_SIZE = 4.5 * 1024 * 1024; // 4.5MB
  const MIN_QUALITY = 0.3;
  const INITIAL_QUALITY = 0.85;
  const QUALITY_STEP = 0.05;

  async function compress(file) {
    const originalSize = file.size;

    // Skip if already under target
    if (originalSize <= TARGET_SIZE) {
      const bitmap = await createImageBitmap(file);
      const ratio = bitmap.width / bitmap.height;
      return { file, originalSize, compressedSize: originalSize, ratio, skipped: true };
    }

    const img = await loadImage(file);
    let { width, height } = calculateDimensions(img.width, img.height);
    let quality = INITIAL_QUALITY;
    let blob;

    // Step 1: Resize if needed
    blob = await canvasToBlob(img, width, height, quality);

    // Step 2: Reduce quality until under target
    while (blob.size > TARGET_SIZE && quality > MIN_QUALITY) {
      quality -= QUALITY_STEP;
      blob = await canvasToBlob(img, width, height, Math.max(quality, MIN_QUALITY));
    }

    // Step 3: If still too large, reduce dimensions further
    while (blob.size > TARGET_SIZE && (width > 800 || height > 800)) {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
      quality = Math.max(quality, 0.5);
      blob = await canvasToBlob(img, width, height, quality);
    }

    const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalSize,
      compressedSize: blob.size,
      ratio: img.width / img.height,
      width,
      height,
      quality: Math.round(quality * 100),
      skipped: false,
    };
  }

  function calculateDimensions(w, h) {
    if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
      return { width: w, height: h };
    }
    if (w > h) {
      return { width: MAX_DIMENSION, height: Math.round(h * MAX_DIMENSION / w) };
    }
    return { width: Math.round(w * MAX_DIMENSION / h), height: MAX_DIMENSION };
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function canvasToBlob(img, width, height, quality) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  return { compress, formatSize };
})();
