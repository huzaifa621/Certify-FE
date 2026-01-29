// src/utils/signatureUtils.js

/**
 * Remove background from signature image and convert ink to black
 * Works with white/gray/colored backgrounds
 * Converts all ink colors (blue, black, red, etc.) to pure black
 * @param {ImageData} imageData - The image data to process
 * @param {number} threshold - Brightness threshold (0-255), default 200
 */
export function removeWhiteBackground(imageData, threshold = 200) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate brightness (average of RGB)
    const brightness = (r + g + b) / 3;
    
    // If pixel is light (background), make it fully transparent
    if (brightness > threshold) {
      data[i] = 0;     // R
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
      data[i + 3] = 0; // Alpha - fully transparent
    } else {
      // Dark pixel (signature ink) - convert to pure black
      data[i] = 0;     // R - black
      data[i + 1] = 0; // G - black
      data[i + 2] = 0; // B - black
      data[i + 3] = 255; // Alpha - fully opaque
    }
  }
  
  return imageData;
}

/**
 * Process uploaded signature image
 * Removes background and returns canvas
 * @param {File} file - The image file to process
 * @param {number} threshold - Brightness threshold (0-255), default 200
 */
export async function processSignatureImage(file, threshold = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Draw image
        ctx.drawImage(img, 0, 0);
        
        // Get image data and remove white background
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const processedData = removeWhiteBackground(imageData, threshold);
        
        // Put processed data back
        ctx.putImageData(processedData, 0, 0);
        
        resolve(canvas);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Trim transparent pixels from signature canvas
 * Returns cropped canvas with signature only
 */
export function trimSignatureCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let top = canvas.height;
  let bottom = 0;
  let left = canvas.width;
  let right = 0;
  
  // Find bounding box of non-transparent pixels
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const alpha = data[i + 3];
      
      if (alpha > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  
  // If no content found, return original
  if (bottom === 0 && right === 0) {
    return canvas;
  }
  
  // Add small padding
  const padding = 10;
  top = Math.max(0, top - padding);
  left = Math.max(0, left - padding);
  bottom = Math.min(canvas.height - 1, bottom + padding);
  right = Math.min(canvas.width - 1, right + padding);
  
  const width = right - left + 1;
  const height = bottom - top + 1;
  
  // Create new canvas with trimmed size
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = width;
  trimmedCanvas.height = height;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  
  // Copy trimmed portion
  trimmedCtx.drawImage(
    canvas,
    left, top, width, height,
    0, 0, width, height
  );
  
  return trimmedCanvas;
}

/**
 * Apply signature to certificate at specified position
 * Returns new canvas with signature overlaid
 * Signature fills width while maintaining aspect ratio
 */
export async function applySignatureToCertificate(
  certificateUrl,
  signatureCanvas,
  signatureField,
  templateWidth,
  templateHeight
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Create canvas with certificate dimensions
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // Draw certificate
      ctx.drawImage(img, 0, 0);
      
      // Calculate signature position and size
      const placeholderX = signatureField.x * img.width;
      const placeholderY = signatureField.y * img.height;
      const placeholderWidth = signatureField.width * img.width;
      const placeholderHeight = signatureField.height * img.height;
      
      // Calculate signature aspect ratio
      const sigAspectRatio = signatureCanvas.width / signatureCanvas.height;
      const placeholderAspectRatio = placeholderWidth / placeholderHeight;
      
      // Fill width, maintain aspect ratio (Option A)
      let drawWidth = placeholderWidth;
      let drawHeight = placeholderWidth / sigAspectRatio;
      
      // If height exceeds placeholder, scale down to fit height instead
      if (drawHeight > placeholderHeight) {
        drawHeight = placeholderHeight;
        drawWidth = placeholderHeight * sigAspectRatio;
      }
      
      // Center signature in placeholder
      const drawX = placeholderX + (placeholderWidth - drawWidth) / 2;
      const drawY = placeholderY + (placeholderHeight - drawHeight) / 2;
      
      // Draw signature with calculated dimensions
      ctx.drawImage(
        signatureCanvas,
        drawX, drawY,
        drawWidth, drawHeight
      );
      
      resolve(canvas);
    };
    
    img.onerror = () => reject(new Error('Failed to load certificate image'));
    img.src = certificateUrl;
  });
}

/**
 * Convert canvas to blob for upload
 */
export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, type);
  });
}

/**
 * Clear signature canvas
 */
export function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Initialize signature canvas for drawing
 */
export function initializeSignatureCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  
  // Clear canvas to transparent (no white background!)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set up canvas for smooth pen-like drawing
  ctx.lineCap = 'round';        // Rounded line ends
  ctx.lineJoin = 'round';       // Smooth corners
  ctx.strokeStyle = '#000000';  // Black ink
  ctx.lineWidth = 3;            // Pen thickness (3px)
  
  // Enable anti-aliasing for smooth lines
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  return ctx;
}