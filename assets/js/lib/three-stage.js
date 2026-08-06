/**
 * Shared three.js stage: scene, camera, renderer, orbit controls, resizing,
 * theme awareness and — importantly — disposal.
 *
 * The app tears down and rebuilds the view on every navigation, so each stage
 * registers itself and releases its GPU resources when the view goes away.
 * Without that, every visit to a 3D tool would leak a WebGL context (browsers
 * cap these at around 16, after which the oldest is dropped and the canvas
 * turns black).
 */

import * as THREE from "../../../vendor/three/three.module.js";
import { OrbitControls } from "../../../vendor/three/OrbitControls.js";
import { h } from "./ui.js";

export { THREE };

const liveStages = new Set();

/** Release every stage. Called by the shell before it clears the view. */
export function disposeAllStages() {
  for (const stage of [...liveStages]) stage.dispose();
}

/** True when the browser can give us a WebGL context at all. */
export function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Read a CSS custom property from the document root as a colour string. */
function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Create a 3D stage inside a sized container.
 * @param {object} options
 * @param {number} [options.height] CSS height of the canvas area
 * @param {number} [options.distance] initial camera distance
 * @param {string} [options.caption] figure caption
 * @returns stage handle: { element, scene, camera, controls, root, refresh, dispose }
 */
export function createStage({ height = 420, distance = 12, caption = "", autoRotate = true } = {}) {
  if (!webglAvailable()) {
    return {
      unavailable: true,
      element: h(
        "figure.figure",
        {},
        h(
          "p.note.note-error",
          {},
          "This view needs WebGL, which this browser or device has turned off. Every measurement below is still exact — the 3D view is an illustration of the same numbers."
        )
      ),
      dispose() {},
    };
  }

  const canvasHost = h("div.stage3d", { style: { height: `${height}px` } });
  const element = h(
    "figure.figure.figure-3d",
    {},
    canvasHost,
    caption ? h("figcaption", {}, caption) : null
  );

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  camera.position.set(distance * 0.7, distance * 0.5, distance);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(600, height, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  canvasHost.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 0.9;
  controls.enablePan = false;

  // Lighting: a key light, a cool fill and a soft ambient so unlit faces of a
  // molecule are still readable.
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 6, 6);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.7);
  fill.position.set(-6, -2, -4);
  scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.55));

  /** Everything a tool adds goes under root, so it can be swapped wholesale. */
  const root = new THREE.Group();
  scene.add(root);

  let disposed = false;
  let visible = true;
  const themeListeners = new Set();
  const frameListeners = new Set();
  let lastFrameTime = 0;

  // Re-render on a theme switch, whether it came from the app's own toggle
  // (which stamps data-theme) or from the operating system preference.
  const notifyTheme = () => {
    if (disposed) return;
    for (const listener of themeListeners) listener();
  };
  const themeObserver = new MutationObserver(notifyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
  colorSchemeQuery.addEventListener("change", notifyTheme);

  const resize = () => {
    const width = canvasHost.clientWidth || 600;
    const boxHeight = canvasHost.clientHeight || height;
    if (width === 0 || boxHeight === 0) return;
    camera.aspect = width / boxHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, boxHeight, false);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasHost);

  // Only animate while on screen — an off-screen canvas should not burn battery.
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    },
    { threshold: 0 }
  );
  intersectionObserver.observe(canvasHost);

  const animate = (now = 0) => {
    if (disposed) return;
    requestAnimationFrame(animate);
    if (!visible) {
      lastFrameTime = now;
      return;
    }
    // Seconds since the previous drawn frame, clamped so a backgrounded tab
    // does not resume with one enormous jump in the simulation.
    const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0;
    lastFrameTime = now;
    for (const listener of frameListeners) listener(delta, now / 1000);
    controls.update();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(() => {
    resize();
    animate();
  });

  /** Free every geometry, material and texture below a node. */
  function disposeNode(node) {
    node.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
    });
  }

  const stage = {
    element,
    scene,
    camera,
    controls,
    root,
    THREE,
    /** Remove everything previously added, disposing its GPU resources. */
    clear() {
      disposeNode(root);
      root.clear();
    },
    /**
     * Frame the camera on the contents. Pass a specific object to measure when
     * the scene also holds helpers (axes, cell outlines) that should not drag
     * the camera back.
     */
    frame(padding = 1.12, target = root) {
      const box = new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());

      // Fit the box itself rather than its bounding sphere — a sphere badly
      // over-estimates a flat molecule and leaves it marooned in the middle of
      // the canvas. Height and width are fitted separately, then half the depth
      // is added so the near face does not clip.
      const halfFov = (camera.fov * Math.PI) / 360;
      const forHeight = size.y / 2 / Math.tan(halfFov);
      const forWidth = size.x / 2 / (Math.tan(halfFov) * Math.max(camera.aspect, 0.2));
      const fitDistance = Math.max(forHeight, forWidth) * padding + size.z / 2;

      controls.target.copy(centre);
      camera.position.copy(centre).add(
        new THREE.Vector3(0.55, 0.42, 1).normalize().multiplyScalar(Math.max(fitDistance, 0.5))
      );
      camera.near = Math.max(0.01, fitDistance / 100);
      camera.far = fitDistance * 100;
      camera.updateProjectionMatrix();
      controls.update();
    },
    setAutoRotate(on) {
      controls.autoRotate = on;
    },
    /** Run `callback` whenever the page theme changes. Cleared on dispose. */
    onThemeChange(callback) {
      themeListeners.add(callback);
    },
    /**
     * Run `callback(deltaSeconds, elapsedSeconds)` before each rendered frame.
     * Only fires while the canvas is on screen, and is cleared on dispose.
     */
    onFrame(callback) {
      frameListeners.add(callback);
      return () => frameListeners.delete(callback);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      liveStages.delete(stage);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      colorSchemeQuery.removeEventListener("change", notifyTheme);
      themeListeners.clear();
      frameListeners.clear();
      controls.dispose();
      disposeNode(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };

  liveStages.add(stage);
  return stage;
}

/* ------------------------------------------------------------------ *
 * Shared builders
 * ------------------------------------------------------------------ */

/** A sphere for an atom. Geometry is shared per radius bucket by the caller. */
export function atomMesh({ position, radius, color, segments = 32 }) {
  const geometry = new THREE.SphereGeometry(radius, segments, segments / 2);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.38,
    metalness: 0.06,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

/**
 * A cylinder spanning two points — used for bonds. Split into two halves so each
 * end can take the colour of the atom it touches, the standard convention.
 */
export function bondMesh({ from, to, radius = 0.09, colorFrom, colorTo, segments = 20 }) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const middle = start.clone().add(end).multiplyScalar(0.5);
  const group = new THREE.Group();

  for (const [a, b, color] of [
    [start, middle, colorFrom],
    [middle, end, colorTo],
  ]) {
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), segments, 1, true);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.45,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(a).add(direction.clone().multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    group.add(mesh);
  }
  return group;
}

/**
 * A flat text label that always faces the camera.
 * The fill and halo default to the page's own text and surface colours, so a
 * label stays legible in either theme — white-on-white is otherwise invisible
 * the moment the viewer switches to light mode.
 */
export function labelSprite(text, { color, halo, size = 0.5 } = {}) {
  const label = String(text);
  const fontSize = 72;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  // Size the canvas to the text before drawing — a fixed square silently
  // crops anything longer than a couple of characters.
  const font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`;
  context.font = font;
  const padding = fontSize * 0.4;
  const width = Math.ceil(context.measureText(label).width + padding * 2);
  const height = Math.ceil(fontSize * 1.5);
  canvas.width = width;
  canvas.height = height;

  // Resizing the canvas resets the context, so restate everything.
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 9;
  context.strokeStyle = halo || cssColor("--panel-solid", "#000000");
  context.fillStyle = color || cssColor("--text", "#ffffff");
  context.lineJoin = "round";
  context.strokeText(label, width / 2, height / 2);
  context.fillText(label, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  // Keep the aspect ratio so wide labels are not squeezed.
  sprite.scale.set((size * width) / height, size, size);
  sprite.renderOrder = 10;
  return sprite;
}

export function tubeMesh(points, { radius = 0.2, color = "#ffffff", segments = null, radialSegments = 12, opacity = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, segments || Math.max(8, points.length * 4), radius, radialSegments, false);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.45,
    metalness: 0.05,
    transparent: opacity < 1,
    opacity,
  });
  return new THREE.Mesh(geometry, material);
}

/** Dashed line, used for lone pairs and unit-cell edges. */
export function dashedLine(points, { color = "#8b93b5", dashSize = 0.16, gapSize = 0.12 } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
  const material = new THREE.LineDashedMaterial({ color: new THREE.Color(color), dashSize, gapSize, transparent: true, opacity: 0.8 });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

export { cssColor };
