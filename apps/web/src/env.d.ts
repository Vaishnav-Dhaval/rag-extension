/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    GROQ_API_KEY: string;
    GEMINI_API_KEY: string;
    GROQ_MODEL: string;
    GEMINI_MODEL: string;
    GROQ_TIMEOUT_MS: string;
    GEMINI_TIMEOUT_MS: string;
    MAX_POST_LENGTH: string;
    MAX_PAYLOAD_BYTES: string;
    REQUEST_TIMEOUT_MS: string;
    ALLOWED_EXTENSION_ORIGINS: string;
    LOG_LEVEL: string;
    NODE_ENV: 'development' | 'production' | 'test';
    NEXT_PUBLIC_APP_URL: string;
  }
}
