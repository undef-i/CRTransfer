/* tslint:disable */
/* eslint-disable */
export function gts(tn: string, from: string, to: string): any;
export function find_k(o: string, d: string, esc_o: boolean, esc_d: boolean): Promise<void>;
export function find_mx(o: string, d: string, mtt: number, esc_o: boolean, esc_d: boolean): Promise<void>;
export function stop(): void;
export function find(o: string, d: string, mtt: number, esc_o: boolean, esc_d: boolean): Promise<void>;
export function g_stns(): string[];
export function init(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly find_mx: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly g_stns: () => [number, number, number, number];
  readonly find: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly stop: () => void;
  readonly init: () => [number, number];
  readonly gts: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly find_k: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly closure47_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure34_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
