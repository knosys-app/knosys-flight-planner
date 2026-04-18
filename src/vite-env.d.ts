/// <reference types="vite/client" />

declare module '*?b64' {
  const base64: string;
  export default base64;
}

declare module '*?raw' {
  const source: string;
  export default source;
}
