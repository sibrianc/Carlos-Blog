/// <reference types="vite/client" />

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
