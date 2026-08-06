/**
 * Shared reference data: physical constants, formula sheets and the genetic code.
 * Values follow the 2019 SI redefinition (exact where marked).
 */

export const CONSTANTS = [
  { symbol: "c", name: "Speed of light in vacuum", value: 2.99792458e8, unit: "m·s⁻¹", exact: true, subject: "physics" },
  { symbol: "h", name: "Planck constant", value: 6.62607015e-34, unit: "J·s", exact: true, subject: "physics" },
  { symbol: "ħ", name: "Reduced Planck constant", value: 1.054571817e-34, unit: "J·s", subject: "physics" },
  { symbol: "G", name: "Gravitational constant", value: 6.6743e-11, unit: "m³·kg⁻¹·s⁻²", subject: "physics" },
  { symbol: "g", name: "Standard gravity", value: 9.80665, unit: "m·s⁻²", exact: true, subject: "physics" },
  { symbol: "e", name: "Elementary charge", value: 1.602176634e-19, unit: "C", exact: true, subject: "physics" },
  { symbol: "mₑ", name: "Electron rest mass", value: 9.1093837015e-31, unit: "kg", subject: "physics" },
  { symbol: "mₚ", name: "Proton rest mass", value: 1.67262192369e-27, unit: "kg", subject: "physics" },
  { symbol: "ε₀", name: "Vacuum permittivity", value: 8.8541878128e-12, unit: "F·m⁻¹", subject: "physics" },
  { symbol: "μ₀", name: "Vacuum permeability", value: 1.25663706212e-6, unit: "N·A⁻²", subject: "physics" },
  { symbol: "k", name: "Coulomb constant", value: 8.9875517923e9, unit: "N·m²·C⁻²", subject: "physics" },
  { symbol: "σ", name: "Stefan–Boltzmann constant", value: 5.670374419e-8, unit: "W·m⁻²·K⁻⁴", subject: "physics" },
  { symbol: "N_A", name: "Avogadro constant", value: 6.02214076e23, unit: "mol⁻¹", exact: true, subject: "chemistry" },
  { symbol: "R", name: "Molar gas constant", value: 8.314462618, unit: "J·mol⁻¹·K⁻¹", exact: true, subject: "chemistry" },
  { symbol: "k_B", name: "Boltzmann constant", value: 1.380649e-23, unit: "J·K⁻¹", exact: true, subject: "chemistry" },
  { symbol: "F", name: "Faraday constant", value: 96485.33212, unit: "C·mol⁻¹", exact: true, subject: "chemistry" },
  { symbol: "V_m", name: "Molar volume of ideal gas (STP, 273.15 K, 100 kPa)", value: 0.02271095464, unit: "m³·mol⁻¹", exact: true, subject: "chemistry" },
  { symbol: "K_w", name: "Ionic product of water (25 °C)", value: 1.0e-14, unit: "mol²·dm⁻⁶", subject: "chemistry" },
];

export const FORMULA_SHEETS = {
  physics: [
    {
      topic: "Kinematics",
      accent: "--phys",
      rows: [
        ["v = u + at", "Velocity after constant acceleration"],
        ["s = ut + ½at²", "Displacement from initial velocity"],
        ["v² = u² + 2as", "Time-independent relation"],
        ["s = ½(u + v)t", "Displacement from average velocity"],
      ],
    },
    {
      topic: "Dynamics & energy",
      accent: "--phys",
      rows: [
        ["F = ma", "Newton's second law"],
        ["p = mv", "Linear momentum"],
        ["W = Fs·cos θ", "Work done by a force"],
        ["Eₖ = ½mv²", "Kinetic energy"],
        ["E_p = mgh", "Gravitational potential energy (uniform field)"],
        ["P = W/t = Fv", "Power"],
      ],
    },
    {
      topic: "Circular motion & gravitation",
      accent: "--phys",
      rows: [
        ["a = v²/r = ω²r", "Centripetal acceleration"],
        ["F = GMm/r²", "Newtonian gravitation"],
        ["g = GM/r²", "Gravitational field strength"],
        ["T² = 4π²r³/GM", "Kepler's third law"],
      ],
    },
    {
      topic: "Electricity",
      accent: "--phys",
      rows: [
        ["V = IR", "Ohm's law"],
        ["P = VI = I²R = V²/R", "Electrical power"],
        ["R_series = ΣRᵢ", "Resistors in series"],
        ["1/R_parallel = Σ(1/Rᵢ)", "Resistors in parallel"],
        ["Q = CV", "Capacitor charge"],
        ["F = kq₁q₂/r²", "Coulomb's law"],
      ],
    },
    {
      topic: "Waves & optics",
      accent: "--phys",
      rows: [
        ["v = fλ", "Wave equation"],
        ["n₁ sin θ₁ = n₂ sin θ₂", "Snell's law of refraction"],
        ["1/f = 1/v − 1/u", "Thin lens equation (real-is-positive)"],
        ["m = v/u", "Linear magnification"],
        ["E = hf", "Photon energy"],
      ],
    },
    {
      topic: "Thermal & modern physics",
      accent: "--phys",
      rows: [
        ["Q = mcΔθ", "Sensible heat"],
        ["Q = mL", "Latent heat"],
        ["pV = nRT", "Ideal gas law"],
        ["E = mc²", "Mass–energy equivalence"],
        ["N = N₀e^(−λt)", "Radioactive decay"],
      ],
    },
  ],
  chemistry: [
    {
      topic: "The mole",
      accent: "--chem",
      rows: [
        ["n = m / M", "Moles from mass and molar mass"],
        ["n = N / N_A", "Moles from particle count"],
        ["n = cV", "Moles in solution (V in dm³)"],
        ["n = pV / RT", "Moles of gas"],
      ],
    },
    {
      topic: "Gases",
      accent: "--chem",
      rows: [
        ["p₁V₁/T₁ = p₂V₂/T₂", "Combined gas law"],
        ["pV = nRT", "Ideal gas equation"],
        ["p_total = Σpᵢ", "Dalton's law of partial pressures"],
      ],
    },
    {
      topic: "Equilibrium & acids",
      accent: "--chem",
      rows: [
        ["K_c = [C]^c[D]^d / [A]^a[B]^b", "Equilibrium constant"],
        ["pH = −log₁₀[H⁺]", "pH definition"],
        ["pOH = 14 − pH", "At 25 °C"],
        ["pH = pK_a + log([A⁻]/[HA])", "Henderson–Hasselbalch"],
      ],
    },
    {
      topic: "Energetics & kinetics",
      accent: "--chem",
      rows: [
        ["ΔH = ΣΔH_f(products) − ΣΔH_f(reactants)", "Hess's law"],
        ["q = mcΔT", "Calorimetry"],
        ["ΔG = ΔH − TΔS", "Gibbs free energy"],
        ["k = Ae^(−E_a/RT)", "Arrhenius equation"],
      ],
    },
  ],
  biology: [
    {
      topic: "Genetics",
      accent: "--bio",
      rows: [
        ["p + q = 1", "Allele frequencies"],
        ["p² + 2pq + q² = 1", "Hardy–Weinberg equilibrium"],
        ["3 : 1", "Monohybrid F₂ phenotype ratio"],
        ["9 : 3 : 3 : 1", "Dihybrid F₂ phenotype ratio"],
      ],
    },
    {
      topic: "Cells & transport",
      accent: "--bio",
      rows: [
        ["magnification = image size / actual size", "Microscopy"],
        ["Ψ = Ψ_s + Ψ_p", "Water potential"],
        ["SA:V ratio", "Falls as an organism grows — limits diffusion"],
      ],
    },
    {
      topic: "Respiration & photosynthesis",
      accent: "--bio",
      rows: [
        ["C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O", "Aerobic respiration (≈32 ATP)"],
        ["6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "Photosynthesis (light-driven)"],
        ["C₆H₁₂O₆ → 2C₃H₆O₃", "Lactate fermentation (2 ATP)"],
      ],
    },
  ],
};

/** Standard genetic code, keyed by mRNA codon. */
export const CODON_TABLE = {
  UUU: "Phe", UUC: "Phe", UUA: "Leu", UUG: "Leu",
  CUU: "Leu", CUC: "Leu", CUA: "Leu", CUG: "Leu",
  AUU: "Ile", AUC: "Ile", AUA: "Ile", AUG: "Met",
  GUU: "Val", GUC: "Val", GUA: "Val", GUG: "Val",
  UCU: "Ser", UCC: "Ser", UCA: "Ser", UCG: "Ser",
  CCU: "Pro", CCC: "Pro", CCA: "Pro", CCG: "Pro",
  ACU: "Thr", ACC: "Thr", ACA: "Thr", ACG: "Thr",
  GCU: "Ala", GCC: "Ala", GCA: "Ala", GCG: "Ala",
  UAU: "Tyr", UAC: "Tyr", UAA: "Stop", UAG: "Stop",
  CAU: "His", CAC: "His", CAA: "Gln", CAG: "Gln",
  AAU: "Asn", AAC: "Asn", AAA: "Lys", AAG: "Lys",
  GAU: "Asp", GAC: "Asp", GAA: "Glu", GAG: "Glu",
  UGU: "Cys", UGC: "Cys", UGA: "Stop", UGG: "Trp",
  CGU: "Arg", CGC: "Arg", CGA: "Arg", CGG: "Arg",
  AGU: "Ser", AGC: "Ser", AGA: "Arg", AGG: "Arg",
  GGU: "Gly", GGC: "Gly", GGA: "Gly", GGG: "Gly",
};

/** Amino acid properties used to colour translation output. */
export const AMINO_ACIDS = {
  Ala: { letter: "A", name: "Alanine", type: "nonpolar" },
  Arg: { letter: "R", name: "Arginine", type: "basic" },
  Asn: { letter: "N", name: "Asparagine", type: "polar" },
  Asp: { letter: "D", name: "Aspartate", type: "acidic" },
  Cys: { letter: "C", name: "Cysteine", type: "polar" },
  Gln: { letter: "Q", name: "Glutamine", type: "polar" },
  Glu: { letter: "E", name: "Glutamate", type: "acidic" },
  Gly: { letter: "G", name: "Glycine", type: "nonpolar" },
  His: { letter: "H", name: "Histidine", type: "basic" },
  Ile: { letter: "I", name: "Isoleucine", type: "nonpolar" },
  Leu: { letter: "L", name: "Leucine", type: "nonpolar" },
  Lys: { letter: "K", name: "Lysine", type: "basic" },
  Met: { letter: "M", name: "Methionine (start)", type: "nonpolar" },
  Phe: { letter: "F", name: "Phenylalanine", type: "nonpolar" },
  Pro: { letter: "P", name: "Proline", type: "nonpolar" },
  Ser: { letter: "S", name: "Serine", type: "polar" },
  Thr: { letter: "T", name: "Threonine", type: "polar" },
  Trp: { letter: "W", name: "Tryptophan", type: "nonpolar" },
  Tyr: { letter: "Y", name: "Tyrosine", type: "polar" },
  Val: { letter: "V", name: "Valine", type: "nonpolar" },
  Stop: { letter: "*", name: "Stop codon", type: "stop" },
};

/** Validated four-slot categorical set (worst adjacent CVD ΔE 8.4) plus a neutral stop. */
export const AMINO_TYPE_COLORS = {
  nonpolar: "#c98500",
  polar: "#199e70",
  basic: "#3987e5",
  acidic: "#e66767",
  stop: "#8b93b5",
};

/**
 * Organelles rendered by the interactive cell diagram. Colours are drawn from the
 * validated categorical set; each structure is also labelled directly on the
 * diagram and listed in the key, so colour is never the only identifier.
 */
export const ORGANELLES = [
  { id: "nucleus", name: "Nucleus", color: "#9085e9", found: "both", role: "Holds chromosomal DNA; site of transcription and ribosome subunit assembly (nucleolus)." },
  { id: "mitochondrion", name: "Mitochondrion", color: "#e66767", found: "both", role: "Aerobic respiration — the Krebs cycle and oxidative phosphorylation generate ATP on the cristae." },
  { id: "chloroplast", name: "Chloroplast", color: "#3f8f2f", found: "plant", role: "Photosynthesis: light-dependent reactions on the thylakoids, Calvin cycle in the stroma." },
  { id: "rer", name: "Rough ER", color: "#3987e5", found: "both", role: "Ribosome-studded membrane network that folds and transports secreted proteins." },
  { id: "golgi", name: "Golgi apparatus", color: "#d95926", found: "both", role: "Modifies, sorts and packages proteins into vesicles for secretion." },
  { id: "vacuole", name: "Permanent vacuole", color: "#22a5b8", found: "plant", role: "Stores cell sap and maintains turgor pressure against the cell wall." },
  { id: "wall", name: "Cell wall", color: "#c98500", found: "plant", role: "Cellulose layer giving mechanical strength and preventing osmotic lysis." },
  { id: "membrane", name: "Cell-surface membrane", color: "#b06ab0", found: "both", role: "Phospholipid bilayer controlling entry and exit of substances." },
  { id: "ribosome", name: "Ribosomes", color: "#199e70", found: "both", role: "Translate mRNA into polypeptides (80S in eukaryotes, 70S in prokaryotes)." },
  { id: "lysosome", name: "Lysosome", color: "#d55181", found: "animal", role: "Vesicle of hydrolytic enzymes that digests worn organelles and engulfed material." },
];
