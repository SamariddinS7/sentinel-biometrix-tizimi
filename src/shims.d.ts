declare module 'helmet' {
  const helmet: (options?: any) => (req: any, res: any, next: any) => void;
  export default helmet;
}

declare module 'express-rate-limit' {
  const rateLimit: (options?: any) => (req: any, res: any, next: any) => void;
  export default rateLimit;
}

declare module 'onnxruntime-node' {
  export class InferenceSession {
    inputNames: string[];
    outputNames: string[];
    static create(path: string, options?: any): Promise<InferenceSession>;
    run(feeds: any, options?: any): Promise<any>;
    release(): Promise<void>;
  }
  export class Tensor {
    constructor(type: string, data: any, dims: any);
  }
  const ort: any;
  export default ort;
}

declare module 'tesseract.js' {
  export const createWorker: any;
  const tesseract: any;
  export default tesseract;
}
