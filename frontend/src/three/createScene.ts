// src/three/createScene.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Feature = {
  id?: string | number;
  geometry: { type: string; coordinates: any };
  height_m?: number;
  levels?: number;
  address?: string;
  zoning?: string;
  assessed_value?: number | null;
  raw?: any;
};

type Callbacks = {
  onPick?: (f: Feature | null) => void;
};

function lonLatToXY(lon: number, lat: number, lon0: number, lat0: number) {
  // crude local ENU projection good enough for a few city blocks
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const x = (lon - lon0) * mPerDegLon;
  const z = (lat - lat0) * mPerDegLat; // use Z for north
  return { x, z };
}

export default function createScene(container: HTMLElement, opts?: Callbacks) {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f7f7);
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
  camera.position.set(120, 120, 120);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(200, 300, 150);
  scene.add(dir);

  // ground grid
  const grid = new THREE.GridHelper(1000, 20, 0x888888, 0xcccccc);
  (grid.material as THREE.Material).opacity = 0.6;
  (grid.material as any).transparent = true;
  scene.add(grid);

  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  const meshById = new Map<string | number, THREE.Mesh>();

  let lon0 = -114.0719, lat0 = 51.0475; // default downtown center; updated from features

  function addBuildingFromPolygon(coords: number[][], height: number, feature: Feature) {
    // coords: array of [lon,lat] making the outer ring
    const shape = new THREE.Shape();
    coords.forEach(([lon, lat], idx) => {
      const { x, z } = lonLatToXY(lon, lat, lon0, lat0);
      if (idx === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });

    const extrudeSettings = { depth: height, bevelEnabled: false, curveSegments: 1, steps: 1 };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateX(-Math.PI / 2); // make Y up
    const mat = new THREE.MeshStandardMaterial({ color: 0x5aa7ff, metalness: 0.1, roughness: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.feature = feature;
    if (feature.id !== undefined) mesh.userData.id = feature.id;

    buildingGroup.add(mesh);
    if (feature.id !== undefined) meshById.set(feature.id, mesh);
  }

  function addFeature(f: Feature) {
    const g = f.geometry;
    const h = Math.max(1, Number(f.height_m || 12)); // safety
    if (!g || !g.type) return;
    if (g.type === "Polygon") {
      // outer ring at index 0
      const ring = g.coordinates?.[0] as number[][];
      if (Array.isArray(ring) && ring.length >= 3) {
        addBuildingFromPolygon(ring, h, f);
      }
    } else if (g.type === "MultiPolygon") {
      const polys = g.coordinates as number[][][][];
      polys?.forEach((poly) => {
        const ring = poly?.[0];
        if (Array.isArray(ring) && ring.length >= 3) addBuildingFromPolygon(ring as any, h, f);
      });
    }
  }

  function computeLonLat0(features: Feature[]) {
    // set origin to bbox-like center to keep numbers small
    const pts: [number, number][] = [];
    for (const f of features) {
      const g = f.geometry;
      if (!g || !g.coordinates) continue;
      let lon = 0, lat = 0, n = 0;
      const ring = g.type === "Polygon" ? g.coordinates[0] : (g.type === "MultiPolygon" ? g.coordinates[0]?.[0] : null);
      if (ring) {
        for (const p of ring) { lon += p[0]; lat += p[1]; n++; }
        if (n > 0) pts.push([lon / n, lat / n]);
      }
    }
    if (pts.length) {
      const avgLon = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const avgLat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      lon0 = avgLon; lat0 = avgLat;
    }
  }

  function clearBuildings() {
    meshById.clear();
    while (buildingGroup.children.length) {
      const obj = buildingGroup.children.pop() as THREE.Mesh;
      if (obj) {
        (obj.geometry as THREE.BufferGeometry).dispose();
        (obj.material as THREE.Material).dispose();
      }
    }
  }

  function loadFeatures(features: Feature[]) {
    clearBuildings();
    if (!features?.length) return;
    computeLonLat0(features);
    for (const f of features) addFeature(f);
  }

  // highlight helpers
  function highlightByIds(ids: Array<string | number>) {
    const set = new Set(ids ?? []);
    buildingGroup.children.forEach((obj) => {
      const mesh = obj as THREE.Mesh;
      const id = mesh.userData?.id;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat) return;
      if (set.has(id)) mat.color.setHex(0xff8a00);
      else mat.color.setHex(0x5aa7ff);
    });
  }

  // picking
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function onClick(ev: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, false);
    if (hits.length) {
      const mesh = hits[0].object as THREE.Mesh;
      const f = mesh.userData?.feature as Feature;
      opts?.onPick?.(f || null);
    } else {
      opts?.onPick?.(null);
    }
  }
  renderer.domElement.addEventListener("click", onClick);

  // resize
  function onResize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);

  // animate
  let disposed = false;
  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    loadFeatures,
    highlightByIds,
    dispose() {
      disposed = true;
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.dispose();
    }
  };
}
