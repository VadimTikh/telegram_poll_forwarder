declare module 'input' {
  const input: {
    text(prompt: string): Promise<string>;
  };
  export default input;
}

declare module 'qrcode-terminal' {
  function generate(text: string, options?: { small?: boolean }): void;
  export = { generate };
}
