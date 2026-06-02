export function encodeYjsUpdate(update: Uint8Array) {
  let binary = "";

  update.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary);
}

export function decodeYjsUpdate(value: string) {
  const binary = atob(value);
  const result = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }

  return result;
}
