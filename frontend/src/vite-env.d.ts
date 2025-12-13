/// <reference types="vite/client" />

// CSS module declarations
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// NodeJS types for setTimeout/setInterval refs
declare namespace NodeJS {
  interface Timeout {}
}
