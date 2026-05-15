import "@google/model-viewer";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: string | boolean;
          "camera-controls"?: string | boolean;
          ar?: string | boolean;
          "ar-modes"?: string;
          "shadow-intensity"?: string | number;
          slot?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
