declare module "gif-encoder-2" {
  class GIFEncoder {
    out: { getData(): Uint8Array };
    constructor(
      width: number,
      height: number,
      algorithm?: "neuquant" | "octree",
      useOptimizer?: boolean,
      totalFrames?: number
    );
    setQuality(quality: number): void;
    setDelay(delay: number): void;
    setRepeat(repeat: number): void;
    start(): void;
    addFrame(ctx: CanvasRenderingContext2D): void;
    finish(): void;
  }
  export = GIFEncoder;
}
