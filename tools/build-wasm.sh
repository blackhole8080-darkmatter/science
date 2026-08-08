#!/usr/bin/env bash
# Compile the C++ compute kernels to freestanding wasm32.
#
# Needs clang with a wasm32 target and wasm-ld (LLVM 15+). No Emscripten: the
# kernels are freestanding and import their math from the host, so there is no
# libc to link and the output is a few kilobytes rather than a few hundred.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/assets/wasm"
mkdir -p "$out"

if ! command -v clang++ >/dev/null; then
  echo "clang++ not found — the prebuilt .wasm in assets/wasm/ is already committed," >&2
  echo "so this is only needed when changing the C++ sources." >&2
  exit 1
fi

for src in "$root"/wasm/*.cpp; do
  name="$(basename "$src" .cpp)"
  clang++ \
    --target=wasm32 \
    -std=c++20 \
    -nostdlib \
    -O3 \
    -flto \
    -fno-fast-math \
    -Wall -Wextra \
    -Wl,--no-entry \
    -Wl,--export-memory \
    -Wl,--export=sample_density \
    -Wl,--export=points_ptr \
    -Wl,--export=phases_ptr \
    -Wl,--export=max_points \
    -Wl,--allow-undefined \
    -Wl,--initial-memory=4194304 \
    -o "$out/$name.wasm" \
    "$src"
  printf '  built %-16s %s bytes\n' "$name.wasm" "$(stat -c%s "$out/$name.wasm")"
done
