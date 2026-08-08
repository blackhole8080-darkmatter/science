// Hydrogenic orbital sampling kernel.
//
// The probability cloud in the orbital viewer is rejection-sampled from |psi|^2,
// which is the heaviest numeric loop in the application: hundreds of thousands
// of candidate points, each needing a wavefunction evaluation. That is the one
// place where dropping out of JavaScript pays for itself.
//
// Built freestanding for wasm32 — no libc, no runtime. The transcendental
// functions are imported from the host's Math object rather than reimplemented,
// so this kernel and the JavaScript reference implementation agree bit for bit
// and can be cross-checked against each other. Only sqrt is taken from the
// hardware, because wasm has an instruction for it.
//
// Build:  tools/build-wasm.sh   (needs clang with a wasm32 target)

extern "C" {
// Imported from the host: identical semantics to the JS path by construction.
double js_exp(double x);
double js_sin(double x);
double js_cos(double x);
double js_acos(double x);
double js_atan2(double y, double x);
}

namespace {

constexpr double PI = 3.14159265358979323846;
constexpr int MAX_POINTS = 40000;

// Output buffers, read back through the exported linear memory.
double g_points[MAX_POINTS * 3];
signed char g_phases[MAX_POINTS];

/** mulberry32 — the same PRNG the JS path uses, so seeds line up exactly. */
struct Random {
  unsigned state;
  explicit Random(unsigned seed) : state(seed) {}
  double next() {
    state += 0x6d2b79f5u;
    unsigned t = state;
    t = (t ^ (t >> 15)) * (t | 1u);
    t ^= t + (t ^ (t >> 7)) * (t | 61u);
    return static_cast<double>((t ^ (t >> 14))) / 4294967296.0;
  }
};

/** Radial functions R_nl(r), exact for n <= 3, in units of the Bohr radius. */
double radial(int n, int l, double r) {
  if (n == 1 && l == 0) return 2.0 * js_exp(-r);
  if (n == 2 && l == 0) return (1.0 / (2.0 * 1.4142135623730951)) * (2.0 - r) * js_exp(-r / 2.0);
  if (n == 2 && l == 1) return (1.0 / (2.0 * 2.449489742783178)) * r * js_exp(-r / 2.0);
  if (n == 3 && l == 0) return (2.0 / (81.0 * 1.7320508075688772)) * (27.0 - 18.0 * r + 2.0 * r * r) * js_exp(-r / 3.0);
  if (n == 3 && l == 1) return (4.0 / (81.0 * 2.449489742783178)) * (6.0 * r - r * r) * js_exp(-r / 3.0);
  if (n == 3 && l == 2) return (4.0 / (81.0 * 5.477225575051661)) * r * r * js_exp(-r / 3.0);
  return 0.0;
}

/**
 * Real angular functions, selected by id:
 * 0 s · 1 pz · 2 px · 3 py · 4 dz2 · 5 dxz · 6 dyz · 7 dxy · 8 dx2-y2
 */
double angular(int id, double theta, double phi) {
  const double st = js_sin(theta);
  const double ct = js_cos(theta);
  switch (id) {
    case 0: return 0.5 / 1.7724538509055159;                        // 1/(2*sqrt(pi))
    case 1: return 0.4886025119029199 * ct;                          // sqrt(3/4pi)
    case 2: return 0.4886025119029199 * st * js_cos(phi);
    case 3: return 0.4886025119029199 * st * js_sin(phi);
    case 4: return 0.31539156525252005 * (3.0 * ct * ct - 1.0);      // sqrt(5/16pi)
    case 5: return 1.0925484305920792 * st * ct * js_cos(phi);       // sqrt(15/4pi)
    case 6: return 1.0925484305920792 * st * ct * js_sin(phi);
    case 7: return 0.5462742152960396 * st * st * js_sin(2.0 * phi); // sqrt(15/16pi)
    case 8: return 0.5462742152960396 * st * st * js_cos(2.0 * phi);
    default: return 0.0;
  }
}

double psi(int n, int l, int angularId, double r, double theta, double phi) {
  return radial(n, l, r) * angular(angularId, theta, phi);
}

} // namespace

extern "C" {

double* points_ptr() { return g_points; }
signed char* phases_ptr() { return g_phases; }
int max_points() { return MAX_POINTS; }

/**
 * Rejection-sample |psi|^2 inside a sphere of the given extent.
 * Writes xyz triples (with y and z swapped for the viewer's up-axis) and the
 * sign of psi, and returns how many points were accepted.
 */
int sample_density(int n, int l, int angularId, double extent, int count, unsigned seed) {
  if (count > MAX_POINTS) count = MAX_POINTS;
  Random rng(seed);

  // Estimate the peak of |psi|^2 to normalise the acceptance test, using the
  // same scan the JS implementation performs.
  double peak = 0.0;
  for (int i = 0; i < 4000; ++i) {
    const double r = extent * static_cast<double>(i % 200) / 200.0;
    const double theta = PI * rng.next();
    const double phi = 2.0 * PI * rng.next();
    const double amplitude = psi(n, l, angularId, r, theta, phi);
    const double density = amplitude * amplitude;
    if (density > peak) peak = density;
  }
  if (peak <= 0.0) return 0;

  int accepted = 0;
  long attempts = 0;
  const long maxAttempts = static_cast<long>(count) * 400L;
  while (accepted < count && attempts < maxAttempts) {
    ++attempts;
    const double x = (rng.next() * 2.0 - 1.0) * extent;
    const double y = (rng.next() * 2.0 - 1.0) * extent;
    const double z = (rng.next() * 2.0 - 1.0) * extent;
    const double r = __builtin_sqrt(x * x + y * y + z * z);
    if (r > extent || r == 0.0) continue;

    const double theta = js_acos(z / r);
    const double phi = js_atan2(y, x);
    const double amplitude = psi(n, l, angularId, r, theta, phi);
    if (amplitude * amplitude > rng.next() * peak) {
      g_points[accepted * 3 + 0] = x;
      g_points[accepted * 3 + 1] = z; // viewer uses y as the vertical axis
      g_points[accepted * 3 + 2] = y;
      g_phases[accepted] = amplitude >= 0.0 ? 1 : -1;
      ++accepted;
    }
  }
  return accepted;
}

} // extern "C"
