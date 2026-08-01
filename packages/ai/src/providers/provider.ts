export interface GenerateReplyParams {
  readonly sourceText: string;
  readonly requestId: string;
}

export interface GenerateReplyOutput {
  readonly text: string;
}

export interface ProviderConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
}

export interface AIProvider {
  readonly name: string;
  readonly timeoutMs: number;
  generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput>;
}
