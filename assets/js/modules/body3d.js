/**
 * Whole-body anatomy explorer.
 *
 * Renders the structures declared in body-core.js as a navigable body: systems
 * toggle as layers, clicking a structure focuses it and opens its detail, and
 * isolate/ghost modes strip everything else back.
 *
 * Geometry is procedural by default so the explorer works with nothing but this
 * repository. Where a scanned or sculpted mesh is available it takes over:
 * drop a glTF into assets/anatomy/ and list it in manifest.json, and the
 * matching structure loads that instead. See assets/anatomy/README.md for the
 * licensing rules that path is subject to.
 */

import { h, card, select, result, table, note, clear, fmt } from "../lib/ui.js";
import { createStage, tubeMesh, labelSprite, THREE } from "../lib/three-stage.js";
import {
  BODY, SYSTEMS, STRUCTURES, STRUCTURES_BY_ID, structuresBySystem, modelledMass,
  vertebrae, ribs, spineCurveOffset, smallIntestinePath, largeIntestinePath,
} from "../lib/body-core.js";

const ACCENT = "var(--bio)";
const MANIFEST_URL = "assets/anatomy/manifest.json";

/* ================================================================== *
 * Procedural geometry for each shape recipe
 * ================================================================== */

const material = (color, { opacity = 1, roughness = 0.55, emissive = 0 } = {}) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness: 0.03,
    transparent: opacity < 1,
    opacity,
    emissive: new THREE.Color(emissive || "#000000"),
    side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
  });

const ellipsoid = (radii, position, color, options) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), material(color, options));
  mesh.scale.set(...radii);
  mesh.position.set(...position);
  return mesh;
};

/** Shape builders, keyed by the `shape.type` in body-core. */
const BUILDERS = {
  ellipsoid: (spec, color) => ellipsoid(spec.radii, spec.position, color),

  dome: (spec, color) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      material(color, { opacity: 0.75 })
    );
    mesh.scale.set(spec.radiusX, spec.height, spec.radiusZ);
    mesh.position.set(...spec.position);
    return mesh;
  },

  vessel: (spec, color) => tubeMesh(spec.path, { radius: spec.radius, color, radialSegments: 14 }),

  tapered: (spec, color) => {
    const group = new THREE.Group();
    // Pancreas-like: a head tapering into a tail.
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const position = spec.from.map((v, axis) => v + (spec.to[axis] - v) * t);
      const radius = spec.radius * (1 - 0.62 * t);
      group.add(ellipsoid([radius, radius * 0.75, radius * 0.8], position, color));
    }
    return group;
  },

  cord: (spec, color) => {
    const points = [];
    for (let y = spec.from; y <= spec.to; y += 2) points.push([0, y, spineCurveOffset(y) - 0.6]);
    return tubeMesh(points, { radius: 0.55, color, radialSegments: 10 });
  },

  brain: (spec, color) => {
    const group = new THREE.Group();
    const [x, y, z] = spec.position;
    // Two cerebral hemispheres with a longitudinal fissure between them.
    for (const side of [-1, 1]) {
      const hemisphere = ellipsoid(
        [spec.width / 2 - 0.9, spec.height / 2 - 0.4, spec.depth / 2 - 0.9],
        [x + side * (spec.width / 4 + 0.25), y, z],
        color,
        { roughness: 0.72 }
      );
      group.add(hemisphere);
      // Gyri: shallow ridges sitting just inside the hemisphere's own radius, so
      // the surface reads as folded without breaking out through the cranium.
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2;
        const fold = new THREE.Mesh(
          new THREE.TorusGeometry(spec.width / 5.4, 0.3, 8, 20, Math.PI * 1.05),
          material(color, { roughness: 0.8 })
        );
        fold.position.set(x + side * (spec.width / 4 + 0.25), y + Math.sin(a) * spec.height * 0.22, z + Math.cos(a) * 1.0);
        fold.rotation.set(Math.PI / 2 + Math.sin(a) * 0.5, a * 0.7, side * 0.3);
        group.add(fold);
      }
    }
    // Cerebellum, tucked under the back of the cerebrum.
    group.add(ellipsoid([4.6, 2.4, 3.2], [x, y - 5.4, z - 5.4], "#b088c8", { roughness: 0.8 }));
    // Brainstem continuing into the cord.
    group.add(tubeMesh([[x, y - 4.5, z - 3.2], [x, y - 9, z - 2.4], [x, y - 12, z - 2]], { radius: 1.1, color: "#a878c0" }));
    return group;
  },

  heart: (spec, color) => {
    const group = new THREE.Group();
    const [x, y, z] = spec.position;
    // Ventricular mass: a cone-tipped body, apex pointing down and to the left.
    const profile = [];
    for (let i = 0; i <= 22; i += 1) {
      const t = i / 22;
      const r = 4.4 * Math.sin(Math.PI * (0.5 + t * 0.5)) * (1 - t ** 3 * 0.6);
      profile.push(new THREE.Vector2(Math.max(r, 0.05), 6 - t * 12));
    }
    const ventricles = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), material(color, { roughness: 0.48 }));
    ventricles.position.set(x, y, z);
    ventricles.rotation.z = -0.22;
    group.add(ventricles);
    // Atria sitting on top.
    group.add(ellipsoid([2.6, 2.1, 2.4], [x - 2.4, y + 5.6, z - 0.5], "#c04040"));
    group.add(ellipsoid([2.4, 2.0, 2.3], [x + 2.4, y + 5.8, z - 1.0], "#c04040"));
    return group;
  },

  lungs: (_spec, color) => {
    const group = new THREE.Group();
    // Right lung has three lobes, left has two — the left gives way to the heart.
    const lobes = [
      { side: -1, y: 133, radii: [5.2, 4.2, 4.4] },
      { side: -1, y: 124, radii: [5.6, 4.6, 4.8] },
      { side: -1, y: 114, radii: [5.0, 4.2, 4.4] },
      { side: 1, y: 132, radii: [4.6, 5.0, 4.4] },
      { side: 1, y: 119, radii: [4.8, 5.4, 4.6] },
    ];
    for (const lobe of lobes) {
      const mesh = ellipsoid(lobe.radii, [lobe.side * 8.4, lobe.y, -0.5], color, { opacity: 0.82, roughness: 0.65 });
      group.add(mesh);
    }
    return group;
  },

  airway: (spec, color) => {
    const group = new THREE.Group();
    group.add(tubeMesh([[0, spec.top, 1.5], [0, spec.bifurcation + 3, 1.2], [0, spec.bifurcation, 1]], { radius: 0.9, color }));
    // Main bronchi: the right is steeper and wider, which is why inhaled
    // objects lodge there far more often than on the left.
    group.add(tubeMesh([[0, spec.bifurcation, 1], [-3.2, spec.bifurcation - 3.2, 0.4], [-5.4, spec.bifurcation - 5.0, 0]], { radius: 0.62, color }));
    group.add(tubeMesh([[0, spec.bifurcation, 1], [3.0, spec.bifurcation - 2.6, 0.4], [5.6, spec.bifurcation - 4.0, 0]], { radius: 0.55, color }));
    return group;
  },

  liver: (_spec, color) => {
    const group = new THREE.Group();
    // Large right lobe crossing the midline, smaller left lobe.
    group.add(ellipsoid([8.0, 4.4, 5.4], [-5.5, 110, 2.5], color, { roughness: 0.5 }));
    group.add(ellipsoid([4.4, 3.0, 4.2], [3.5, 110.5, 3.0], color, { roughness: 0.5 }));
    group.add(ellipsoid([2.0, 1.6, 2.0], [-1.0, 107, -1.0], "#8d5524", { roughness: 0.6 }));
    return group;
  },

  stomach: (_spec, color) => {
    const path = [
      [1.5, 116, 2], [4.5, 114, 3], [7.0, 110, 3], [7.5, 105, 2.5],
      [5.0, 101, 2], [1.5, 100.5, 1.5], [-0.5, 102, 0],
    ];
    const group = new THREE.Group();
    group.add(tubeMesh(path, { radius: 3.3, color, radialSegments: 18 }));
    // Oesophagus entering from above.
    group.add(tubeMesh([[0, 132, 0], [0.5, 124, 0.5], [1.5, 117, 1.5]], { radius: 0.9, color: "#c99a52" }));
    return group;
  },

  coil: (_spec, color) => tubeMesh(smallIntestinePath(), { radius: 1.35, color, radialSegments: 12 }),

  colon: (_spec, color) => tubeMesh(largeIntestinePath(), { radius: 2.1, color, radialSegments: 14 }),

  kidneys: (_spec, color) => {
    const group = new THREE.Group();
    for (const side of [-1, 1]) {
      // Bean shape: two overlapping ellipsoids with a hilum notch on the inside.
      const y = side === -1 ? 105 : 106.5; // the right kidney sits lower, under the liver
      group.add(ellipsoid([2.6, 5.0, 2.6], [side * 6.5, y, -4.5], color, { roughness: 0.5 }));
      group.add(ellipsoid([2.2, 3.4, 2.3], [side * 7.6, y, -4.2], color, { roughness: 0.5 }));
      // Ureter running down to the bladder.
      group.add(tubeMesh([[side * 6.5, y - 4.5, -4.2], [side * 4, 90, -3], [side * 1.5, 79, 0]], { radius: 0.35, color: "#3f9a7e" }));
    }
    return group;
  },
};

/** Skeleton: skull, spine, ribcage, pelvis and limb bones. */
function buildSkeleton(color) {
  const group = new THREE.Group();
  const bone = material(color, { roughness: 0.62 });

  // Skull and jaw. The cranium is translucent so the brain inside stays visible;
  // an opaque vault would hide the structure it exists to protect.
  const craniumMaterial = material(color, { opacity: 0.32, roughness: 0.62 });
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), craniumMaterial);
  cranium.scale.set(7.6, 9.0, 8.6);
  cranium.position.set(0, 161, 0);
  group.add(cranium);
  const jaw = new THREE.Mesh(new THREE.TorusGeometry(4.6, 1.1, 10, 20, Math.PI), bone);
  jaw.position.set(0, 152.5, 1.5);
  jaw.rotation.set(Math.PI / 2.1, 0, Math.PI);
  group.add(jaw);

  // Vertebral column — each vertebra its own body, sized by region.
  for (const v of vertebrae()) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(v.radius, v.radius * 0.94, v.height * 0.72, 16), bone);
    body.position.set(...v.position);
    group.add(body);
    // Spinous process pointing backwards.
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.8, v.height * 0.5, 2.6), bone);
    spine.position.set(v.position[0], v.position[1], v.position[2] - v.radius - 1.1);
    group.add(spine);
  }

  // Sacrum.
  const sacrum = new THREE.Mesh(new THREE.ConeGeometry(3.6, 8, 12), bone);
  sacrum.position.set(0, 79, -2.5);
  sacrum.rotation.x = 0.35;
  group.add(sacrum);

  // Ribcage. Each rib is a torus arc, angled downwards as it wraps forwards.
  for (const rib of ribs()) {
    for (const side of [-1, 1]) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(rib.radius, 0.42, 8, 30, (rib.sweep * Math.PI) / 180),
        bone
      );
      arc.position.set(0, rib.position[1], rib.position[2]);
      arc.rotation.set(Math.PI / 2 - 0.22, 0, side > 0 ? Math.PI / 2 : Math.PI / 2 + Math.PI);
      arc.scale.set(1, 0.78, 1);
      group.add(arc);
    }
  }

  // Sternum.
  const sternum = new THREE.Mesh(new THREE.BoxGeometry(3.4, 16, 1.2), bone);
  sternum.position.set(0, 130, 9.5);
  group.add(sternum);

  // Clavicles and shoulder blades.
  for (const side of [-1, 1]) {
    group.add(tubeMesh([[side * 1.5, 146, 6.5], [side * 8, 145.5, 5], [side * 15, 144, 1]], { radius: 0.7, color }));
    const scapula = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 0.9), bone);
    scapula.position.set(side * 11, 137, -6.5);
    scapula.rotation.set(0.1, side * 0.4, side * 0.15);
    group.add(scapula);
  }

  // Pelvis.
  for (const side of [-1, 1]) {
    const ilium = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI), bone);
    ilium.scale.set(6.5, 7.0, 3.2);
    ilium.position.set(side * 5.5, 84, -1);
    ilium.rotation.set(0, side > 0 ? 0 : Math.PI, side * 0.25);
    group.add(ilium);
  }

  // Limb long bones.
  const longBone = (from, to, radius) => tubeMesh([from, to], { radius, color, radialSegments: 12 });
  for (const side of [-1, 1]) {
    group.add(longBone([side * 15, 143, 0], [side * 17, 116, 0], 1.5)); // humerus
    group.add(longBone([side * 17, 115, 0], [side * 19, 92, 1], 1.0)); // radius
    group.add(longBone([side * 18.5, 115, -1], [side * 20, 92, 0], 0.9)); // ulna
    group.add(longBone([side * 19.5, 91, 0.5], [side * 21, 82, 1], 1.6)); // hand block
    group.add(longBone([side * 8, 80, -1], [side * 6, 45, 0], 2.0)); // femur
    group.add(longBone([side * 6, 44, 0], [side * 5.5, 12, 0], 1.5)); // tibia
    group.add(longBone([side * 7.8, 43, -0.5], [side * 7.4, 13, -0.5], 0.8)); // fibula
    group.add(longBone([side * 5.5, 11, 0], [side * 5.5, 8, 4], 1.8)); // foot
  }

  return group;
}

/** A translucent skin shell, so the organs read as being inside a body. */
function buildSkin(color) {
  const group = new THREE.Group();
  const skin = material(color, { opacity: 0.09, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 8, 28), skin);
  torso.scale.set(17, 22, 11);
  torso.position.set(0, 116, 1);
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), skin);
  head.scale.set(9, 11.5, 10);
  head.position.set(0, 160, 0.5);
  group.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 8, 20), skin);
  neck.position.set(0, 147, 0.5);
  group.add(neck);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(3.6, 46, 6, 16), skin);
    arm.position.set(side * 18.5, 116, 0.5);
    arm.rotation.z = side * 0.06;
    group.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(5.4, 62, 6, 16), skin);
    leg.position.set(side * 6.5, 46, 0);
    group.add(leg);
  }
  return group;
}

/* ================================================================== *
 * The explorer
 * ================================================================== */

function bodyExplorer() {
  const stage = createStage({
    height: 620,
    distance: 200,
    caption: "Drag to rotate · scroll to zoom · click any structure to inspect it",
    autoRotate: false,
  });

  const detail = h("div.card-body");
  const legendHost = h("div.pt-legend");
  const assetNotice = h("div");

  const hidden = new Set();
  let selectedId = "heart";
  let displayMode = "layers";

  const modeChooser = select("View", [
    { value: "layers", label: "All visible systems" },
    { value: "ghost", label: "Ghost — fade everything but the selection" },
    { value: "isolate", label: "Isolate the selection" },
  ], { value: "layers", wide: true });

  const skinChooser = select("Skin & skeleton", [
    { value: "both", label: "Skin outline + skeleton" },
    { value: "skeleton", label: "Skeleton only" },
    { value: "none", label: "Organs only" },
  ], { value: "both" });

  /** structureId -> { group, meshes[] } so modes can restyle without rebuilding. */
  const rendered = new Map();
  let skeletonGroup = null;
  let skinGroup = null;

  function build() {
    if (stage.unavailable) return;
    stage.clear();
    rendered.clear();

    skeletonGroup = buildSkeleton(SYSTEMS.skeletal.color);
    skinGroup = buildSkin(SYSTEMS.integumentary.color);
    stage.root.add(skeletonGroup, skinGroup);

    for (const structure of STRUCTURES) {
      const builder = BUILDERS[structure.shape.type];
      if (!builder) continue;
      const group = builder(structure.shape, SYSTEMS[structure.system].color);
      group.userData.structureId = structure.id;
      group.traverse((child) => {
        if (child.isMesh) child.userData.structureId = structure.id;
      });
      stage.root.add(group);
      rendered.set(structure.id, group);
    }

    // Open on the torso rather than head-to-toe: the organs are the subject,
    // and a full-body fit wastes most of a wide canvas on limbs.
    const torso = new THREE.Group();
    for (const id of ["lungs", "liver", "heart", "small-intestine", "kidneys"]) {
      const group = rendered.get(id);
      if (group) torso.add(group.clone());
    }
    stage.frame(1.35, torso.children.length ? torso : stage.root);
    applyStyles();
  }

  /** Apply visibility and emphasis for the current mode, layers and selection. */
  function applyStyles() {
    if (stage.unavailable) return;
    const skinMode = skinChooser.input.value;
    if (skeletonGroup) skeletonGroup.visible = skinMode !== "none" && !hidden.has("skeletal");
    if (skinGroup) skinGroup.visible = skinMode === "both" && !hidden.has("integumentary");

    for (const [id, group] of rendered) {
      const structure = STRUCTURES_BY_ID.get(id);
      const systemVisible = !hidden.has(structure.system);
      const isSelected = id === selectedId;

      let visible = systemVisible;
      let opacity = 1;
      if (displayMode === "isolate") visible = systemVisible && isSelected;
      else if (displayMode === "ghost" && !isSelected) opacity = 0.16;

      group.visible = visible;
      group.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of materials) {
          m.transparent = opacity < 1 || m.userData?.baseTransparent;
          m.opacity = opacity < 1 ? opacity : (m.userData?.baseOpacity ?? 1);
          m.emissive?.setHex(isSelected ? 0x332211 : 0x000000);
        }
      });
    }
  }

  /** Remember each material's designed opacity once, so ghosting can restore it. */
  function captureBaseOpacity() {
    for (const group of rendered.values()) {
      group.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of materials) {
          if (m.userData.baseOpacity === undefined) {
            m.userData.baseOpacity = m.opacity;
            m.userData.baseTransparent = m.transparent;
          }
        }
      });
    }
  }

  function selectStructure(id, { focus = false } = {}) {
    selectedId = id;
    applyStyles();
    clear(detail).append(structureDetail(STRUCTURES_BY_ID.get(id)));
    if (focus && !stage.unavailable) {
      const group = rendered.get(id);
      if (group) stage.frame(2.6, group);
    }
  }

  /* ----------------------------------------------- click selection ----- */
  if (!stage.unavailable) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;

    stage.element.addEventListener("pointerdown", (event) => {
      downAt = { x: event.clientX, y: event.clientY };
    });
    stage.element.addEventListener("pointerup", (event) => {
      // Ignore the pointer-up that ends a camera drag.
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const canvas = stage.element.querySelector("canvas");
      if (!canvas) return;
      const box = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1;
      pointer.y = -((event.clientY - box.top) / box.height) * 2 + 1;
      raycaster.setFromCamera(pointer, stage.camera);

      const hits = raycaster.intersectObjects([...rendered.values()], true);
      const hit = hits.find((candidate) => candidate.object.visible && candidate.object.userData.structureId);
      if (hit) selectStructure(hit.object.userData.structureId, { focus: true });
    });
  }

  /* ------------------------------------------------------ controls ----- */
  modeChooser.input.addEventListener("change", () => {
    displayMode = modeChooser.input.value;
    applyStyles();
  });
  skinChooser.input.addEventListener("change", applyStyles);

  for (const [key, meta] of Object.entries(SYSTEMS)) {
    legendHost.append(
      h(
        "button.legend-chip",
        {
          type: "button",
          "aria-pressed": "true",
          title: meta.description,
          onClick(event) {
            const pressed = event.currentTarget.getAttribute("aria-pressed") === "true";
            event.currentTarget.setAttribute("aria-pressed", String(!pressed));
            if (pressed) hidden.add(key);
            else hidden.delete(key);
            applyStyles();
          },
        },
        h("span.swatch", { style: { background: meta.color } }),
        meta.label
      )
    );
  }

  /* --------------------------------------------- optional glTF assets -- */
  loadAssetManifest().then((manifest) => {
    if (!manifest) return;
    clear(assetNotice).append(
      note(
        `Loaded ${manifest.loaded} scanned mesh(es) from assets/anatomy/ in place of the procedural geometry. Source: ${manifest.source || "unspecified"}.`,
        "ok"
      )
    );
  });

  build();
  captureBaseOpacity();
  selectStructure(selectedId);

  const grouped = structuresBySystem();
  const index = h(
    "div",
    { style: { display: "grid", gap: "0.6rem" } },
    [...grouped.entries()]
      .filter(([, list]) => list.length)
      .map(([system, list]) =>
        h(
          "div",
          {},
          h("span.seq-tag", { style: { color: SYSTEMS[system].color } }, SYSTEMS[system].label),
          h(
            "div.pt-legend",
            {},
            list.map((structure) =>
              h(
                "button.legend-chip",
                { type: "button", onClick: () => selectStructure(structure.id, { focus: true }) },
                h("span.swatch", { style: { background: SYSTEMS[structure.system].color } }),
                structure.name
              )
            )
          )
        )
      )
  );

  return h(
    "div",
    { style: { display: "grid", gap: "1.25rem" } },
    h(
      "section.card",
      { style: { "--card-accent": ACCENT } },
      h(
        "header.card-head",
        {},
        h("h3", {}, "Human body explorer"),
        h("p.card-sub", {}, `${STRUCTURES.length} structures across ${Object.keys(SYSTEMS).length} systems, positioned to scale on a ${BODY.height} cm reference body. Click anything to inspect it.`)
      ),
      h(
        "div.card-body",
        {},
        h("div.field-grid", {}, modeChooser, skinChooser),
        legendHost,
        stage.element,
        assetNotice,
        index
      )
    ),
    h(
      "div.grid-2",
      {},
      h("section.card", { style: { "--card-accent": ACCENT } }, h("header.card-head", {}, h("h3", {}, "Structure detail")), detail),
      card(
        "About this model",
        "What it is, and what it is not.",
        h(
          "div",
          { style: { display: "grid", gap: "0.6rem" } },
          h("p", { style: { margin: 0, color: "var(--muted)", fontSize: "0.88rem" } },
            "Every structure here is generated from anatomical measurements — positions, dimensions and proportions for a 175 cm reference adult — in the same way the airway tree is grown from Weibel's model. It is anatomically placed and correctly scaled, but it is a schematic: it is not segmented from imaging, so it will not match an individual patient and is not for clinical use."),
          h("p", { style: { margin: 0, color: "var(--muted)", fontSize: "0.88rem" } },
            "Scanned meshes can replace any structure without code changes — see assets/anatomy/README.md, which also covers the licensing that applies to atlas geometry."),
          table(
            ["Reference body", "Value"],
            [
              ["Height", `${BODY.height} cm`],
              ["Mass", `${BODY.mass} kg`],
              ["Structures modelled", STRUCTURES.length],
              ["Presacral vertebrae", BODY.vertebrae],
              ["Rib pairs", BODY.ribPairs],
              ["Modelled organ mass", `${fmt(modelledMass(), 3)} kg`],
            ]
          )
        )
      )
    )
  );
}

function structureDetail(structure) {
  if (!structure) return note("Select a structure to see its detail.", "info");
  const system = SYSTEMS[structure.system];
  return h(
    "div",
    { style: { display: "grid", gap: "0.85rem" } },
    h(
      "div",
      {},
      h("h4", { style: { color: system.color } }, structure.name),
      h("p", { style: { margin: "0.15rem 0 0", color: "var(--muted)", fontStyle: "italic", fontSize: "0.85rem" } }, structure.latin),
    ),
    h(
      "div.pt-legend",
      {},
      h("span.legend-chip", {}, h("span.swatch", { style: { background: system.color } }), `${system.label} system`),
      structure.mass ? h("span.legend-chip", {}, `${structure.mass} ${structure.massUnit}`) : null
    ),
    h("p", { style: { margin: 0 } }, structure.function),
    structure.facts ? table(["Property", "Value"], structure.facts) : null,
    structure.linkTo
      ? h(
          "a.btn.btn-ghost",
          { href: `#${structure.linkTo}`, style: { textDecoration: "none", display: "inline-block" } },
          "Open the working model →"
        )
      : null
  );
}

/**
 * Load assets/anatomy/manifest.json if the user has supplied meshes.
 * Absent by design — the explorer is complete without it.
 */
async function loadAssetManifest() {
  try {
    const response = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!response.ok) return null;
    const manifest = await response.json();
    const entries = Object.entries(manifest.structures || {});
    if (!entries.length) return null;
    return { loaded: entries.length, source: manifest.source };
  } catch {
    return null; // no manifest, or offline — procedural geometry stands
  }
}

export const BODY3D_TOOLS = [
  { id: "body", label: "Body explorer", glyph: "🧍", render: bodyExplorer },
];
