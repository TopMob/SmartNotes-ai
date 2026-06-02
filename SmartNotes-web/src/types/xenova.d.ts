declare module "@xenova/transformers" {
  export const pipeline: (task: string, model: string) => Promise<unknown>;
  export const env: {
    cacheDir: string;
  };
}
