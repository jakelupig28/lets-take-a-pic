import { GridType, FrameColor, FilterType } from "../types";
import { GRID_CONFIGS } from "../constants";

/**
 * Captures the current frame from the video element applying the selected filter.
 */
export const captureFrame = (
  video: HTMLVideoElement,
  filter: FilterType
): string => {
  const canvas = document.createElement("canvas");
  // Use the video's intrinsic dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Apply filter contextually if supported, otherwise we might need specific logic
  // Note: ctx.filter is supported in most modern browsers.
  if (filter !== FilterType.NORMAL) {
    ctx.filter = filter;
  }

  // Flip horizontally to match mirror view usually expected in photobooths
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

/**
 * Generates the final composite image (strip or grid).
 */
export const generateComposite = async (
  images: string[],
  gridType: GridType,
  frameColor: FrameColor,
  title: string = "let's take a pic"
): Promise<string> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Base configuration
  const padding = 40;
  const gap = 20;
  const bottomLabelHeight = 160; // Increased footer for better portrait balance
  
  // Assuming all captured images are same size. Load first to get dimensions.
  const loadedImages = await Promise.all(
    images.map(src => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    })
  );

  if (loadedImages.length === 0) return "";

  const sourceW = loadedImages[0].width;
  const sourceH = loadedImages[0].height;

  // Determine Cell Size and Cropping based on Grid Type
  let cellW = sourceW;
  let cellH = sourceH;
  let sX = 0;
  let sY = 0;
  let sW = sourceW;
  let sH = sourceH;

  // For Grid 2x2, we use slight landscape (4:3 ratio)
  if (gridType === GridType.GRID_2X2) {
      const targetRatio = 4/3;
      
      if (sourceW / sourceH > targetRatio) {
          // Source is wider than target. Fit height, crop width.
          sH = sourceH;
          sW = sourceH * targetRatio;
          sX = (sourceW - sW) / 2;
          sY = 0;
      } else {
          // Source is taller. Fit width, crop height.
          sW = sourceW;
          sH = sourceW / targetRatio;
          sX = 0;
          sY = (sourceH - sH) / 2;
      }
      cellW = sW;
      cellH = sH;
  }

  let canvasWidth = 0;
  let canvasHeight = 0;

  // Calculate composite dimensions
  switch (gridType) {
    case GridType.SINGLE:
      canvasWidth = sourceW + (padding * 2);
      canvasHeight = sourceH + (padding * 2) + bottomLabelHeight;
      break;
    case GridType.STRIP_3:
    case GridType.STRIP_4:
      canvasWidth = sourceW + (padding * 2);
      canvasHeight = (sourceH * loadedImages.length) + (gap * (loadedImages.length - 1)) + (padding * 2) + bottomLabelHeight;
      break;
    case GridType.GRID_2X2:
      canvasWidth = (cellW * 2) + gap + (padding * 2);
      canvasHeight = (cellH * 2) + gap + (padding * 2) + bottomLabelHeight;
      break;
  }

  // Setup Canvas
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Draw Background
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw Images
  let currentX = padding;
  let currentY = padding;

  loadedImages.forEach((img, index) => {
    if (gridType === GridType.GRID_2X2) {
      const row = Math.floor(index / 2);
      const col = index % 2;
      currentX = padding + (col * (cellW + gap));
      currentY = padding + (row * (cellH + gap));
      
      // Draw with crop
      ctx.drawImage(img, sX, sY, sW, sH, currentX, currentY, cellW, cellH);

    } else {
       // Strips or Single - assume full image for now (or could add logic if strips need cropping)
       currentX = padding;
       currentY = padding + (index * (sourceH + gap));
       ctx.drawImage(img, currentX, currentY, sourceW, sourceH);
    }
  });

  // Draw Footer Text
  ctx.fillStyle = (frameColor === FrameColor.BLACK) ? '#FFFFFF' : '#1A1A1A';
  ctx.font = 'bold 40px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const textY = canvasHeight - (bottomLabelHeight / 2) - 10;
  ctx.fillText(title, canvasWidth / 2, textY);

  // Date
  ctx.font = '24px "DM Sans", sans-serif';
  ctx.globalAlpha = 0.7;
  const dateStr = new Date().toLocaleDateString();
  ctx.fillText(dateStr, canvasWidth / 2, textY + 40);

  return canvas.toDataURL("image/png");
};