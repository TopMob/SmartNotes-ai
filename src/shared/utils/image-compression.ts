/**
 * Zero-dependency client-side image compression using HTML5 Canvas.
 * Scales down large images to a maximum dimension while maintaining aspect ratio,
 * and encodes them to JPEG format at a specific quality factor (0.8) to keep files under 500KB.
 */
export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<File> {
  // Only compress images
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // SVG images do not need canvas resizing/JPEG encoding
  if (file.type === "image/svg+xml") {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;

      // Calculate aspect-ratio preserved dimensions
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // canvas context creation failed, fallback to original
        return;
      }

      // Draw image into the scaled canvas context
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG with the desired quality factor
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // If compressed file is larger than the original, fallback to original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // image loading failed, fallback to original
    };

    img.src = objectUrl;
  });
}
