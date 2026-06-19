// MicroPython WASM has no bundled types; declare just what we use.
declare module '@micropython/micropython-webassembly-pyscript/micropython.mjs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function loadMicroPython(options: Record<string, unknown>): Promise<any>
}
declare module '*.wasm?url' {
  const url: string
  export default url
}
