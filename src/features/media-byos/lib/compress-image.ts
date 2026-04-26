export type CompressImageOptions = {
  maxSize: number;
  quality: number;
};

export async function compressImage(file: File, options: CompressImageOptions = { maxSize: 1920, quality: 0.8 }) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, options.maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      options.quality,
    );
  });
}
