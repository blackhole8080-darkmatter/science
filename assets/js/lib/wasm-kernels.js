/**
 * WebAssembly compute kernels.
 *
 * The C++ sources in wasm/ are compiled freestanding for wasm32 (see
 * tools/build-wasm.sh). They import their transcendental functions from this
 * module rather than linking a libm, which keeps the binaries at a couple of
 * kilobytes and — more usefully — makes them produce bit-identical results to
 * the JavaScript reference implementations. That equivalence is asserted in the
 * test suite, so the fast path can never silently drift from the readable one.
 *
 * Loading is optional and always fails soft: if the binary is missing, the host
 * has no WebAssembly, or instantiation throws, callers fall back to JavaScript
 * and nothing about the result changes except how long it took.
 */

const KERNEL_BASE = "assets/wasm";

/** Math imported into every kernel — the host's, so semantics match exactly. */
const MATH_IMPORTS = {
  js_exp: Math.exp,
  js_sin: Math.sin,
  js_cos: Math.cos,
  js_acos: Math.acos,
  js_atan2: Math.atan2,
  js_pow: Math.pow,
  js_log: Math.log,
};

const cache = new Map();

/**
 * Instantiate a kernel by name, once. Resolves to its exports, or to null when
 * the kernel is unavailable for any reason.
 * @param {string} name file stem in assets/wasm, e.g. "orbital"
 */
export function loadKernel(name) {
  if (cache.has(name)) return cache.get(name);

  const promise = (async () => {
    if (typeof WebAssembly !== "object" || !WebAssembly.instantiate) return null;
    try {
      const response = await fetch(`${KERNEL_BASE}/${name}.wasm`, { cache: "force-cache" });
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, { env: MATH_IMPORTS });
      return instance.exports;
    } catch {
      return null; // offline, blocked, or unsupported — JavaScript takes over
    }
  })();

  cache.set(name, promise);
  return promise;
}

/**
 * Sample |ψ|² for an orbital using the C++ kernel.
 * @returns the same shape as the JS densityCloud, or null if unavailable.
 */
export async function sampleOrbitalDensity(orbital, { count = 14000, seed = 7 } = {}) {
  const kernel = await loadKernel("orbital");
  if (!kernel?.sample_density) return null;

  const angularId = ANGULAR_IDS[orbital.angular];
  if (angularId === undefined) return null;

  const capacity = kernel.max_points();
  const wanted = Math.min(count, capacity);
  const accepted = kernel.sample_density(orbital.n, orbital.l, angularId, orbital.extent, wanted, seed);
  if (!accepted) return null;

  // Copy out of linear memory: the views would be detached if it ever grows.
  const points = Array.from(new Float64Array(kernel.memory.buffer, kernel.points_ptr(), accepted * 3));
  const phases = Array.from(new Int8Array(kernel.memory.buffer, kernel.phases_ptr(), accepted));
  return { points, phases };
}

/** Angular function ids, matching the switch in wasm/orbital.cpp. */
const ANGULAR_IDS = {
  s: 0, pz: 1, px: 2, py: 3, dz2: 4, dxz: 5, dyz: 6, dxy: 7, "dx2-y2": 8,
};

export { ANGULAR_IDS, MATH_IMPORTS };
