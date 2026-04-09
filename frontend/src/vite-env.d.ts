/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    CKEDITOR?: {
      replace: (element: HTMLTextAreaElement, config?: Record<string, unknown>) => {
        on: (eventName: string, handler: () => void) => void;
        setData: (value: string) => void;
        getData: () => string;
        destroy: (noUpdate?: boolean) => void;
      };
    };
  }
}

export {};
