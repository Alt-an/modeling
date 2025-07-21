import * as THREE from 'three';
import { Viewport } from '../viewport';
import { Selection } from '../selection';
import { createRayFromScreen, distanceFromPointsToRay } from '../util';
import { createSelectionMarkers, createVertexDisplay, updateVertexDisplay } from '../display';
import { TransformControls } from 'three/examples/jsm/Addons.js';
import { EditableMesh } from './mesh';
import { ModelingTool } from './tools';
import { mergeVertices } from './merge';
import { Modeling } from '../modeling';
import { moveVerticesInward } from './controls';


let enabled = false;
let selected: EditableMesh | null = null;
let vertexDisplay: THREE.InstancedMesh | null = null;
let selectedDisplay: THREE.InstancedMesh | null = null;
let selectedIndices: number[] = [];

let dummy = new THREE.Object3D();
const dummyOrigin = new THREE.Vector3();
let transform: TransformControls;

export function init(sharedDummy: THREE.Object3D, transformControl: TransformControls, container: HTMLElement) {
  dummy = sharedDummy;
  transform = transformControl;

  transform.addEventListener("mouseDown", () => {
    if (!enabled) return;
    container.addEventListener("pointermove", onTransformMove);
    Viewport.orbit.enabled = false;
  });

  transform.addEventListener("mouseUp", () => {
    if (!enabled) return;
    container.removeEventListener("pointermove", onTransformMove);
    Viewport.orbit.enabled = true;
  });

  container.addEventListener("pointerdown", (e) => {
    if (!enabled || !selected) return;
    onPointerDown(e);
    mouseStart.set(e.clientX, e.clientY);
    mouseTime = performance.now();
  });

  container.addEventListener("pointermove", () => {
    if (enabled) clearSelectionTimer();
    if (enabled && selected) updateAllDisplays();
  });

  container.addEventListener("pointerup", (e) => {
    if (!enabled || !selected) return;
    clearSelectionTimer();
    selectVertexFromClick(e);
  });
}

export function enable(flag: boolean) {
  enabled = flag;
  if (!enabled) drop();
  else if (selected) updateVertexDisplayFromMesh();
}

export function select(obj: THREE.Object3D) {
  if (!(obj instanceof THREE.Mesh)) return;
  selected = new EditableMesh(obj);
  updateVertexDisplayFromMesh();
}

export function drop() {
  transform.detach();
  selected = null;
  selectedIndices = [];

  if (vertexDisplay) Viewport.removeDev(vertexDisplay);
  vertexDisplay = null;

  if (selectedDisplay) Viewport.removeDev(selectedDisplay);
  selectedDisplay = null;
}

export function update() {
  if (!selected) return;
  updateAllDisplays();
}

// === Internal helpers ===

function updateAllDisplays() {
  if (!selected) return;
  if(vertexDisplay) updateVertexDisplay(vertexDisplay, selected.getVertexWorldPositions());
  if(selectedDisplay) updateVertexDisplay(selectedDisplay, selectedIndices.map(i => selected!.getVertexWorld(i)));
}

function updateVertexDisplayFromMesh() {
  if (!selected || !enabled) return;

  const vertices = selected.getVertexWorldPositions();
  if (!vertexDisplay) {
    vertexDisplay = createVertexDisplay(vertices);
    Viewport.addDev(vertexDisplay);
  }
  updateVertexDisplay(vertexDisplay, vertices);
}

function updateTransformOrigin() {
  if (!selected || selectedIndices.length === 0) {
    transform.detach();
    if (selectedDisplay) Viewport.removeDev(selectedDisplay);
    selectedDisplay = null;
    return;
  }

  const center = new THREE.Vector3();
  selectedIndices.forEach(i => center.add(selected!.getVertexWorld(i)));
  center.divideScalar(selectedIndices.length);

  dummy.position.copy(center);
  dummyOrigin.copy(center);
  transform.attach(dummy);

  if (selectedDisplay) Viewport.removeDev(selectedDisplay);
  selectedDisplay = createSelectionMarkers(selectedIndices.map(i => selected!.getVertexWorld(i)));
  Viewport.addDev(selectedDisplay);
}

function onTransformMove() {
  if (!selected || selectedIndices.length === 0) return;

  // World-space delta from the dummy movement
  const worldDelta = dummy.position.clone().sub(dummyOrigin);

  // Convert world-space delta to mesh-local delta
  if(Modeling.control.inwardScaling) {
    moveVerticesInward(selected, selectedIndices, worldDelta.y);
    dummyOrigin.copy(dummy.position);
    updateAllDisplays();
    return;
  }
  const localDelta = worldDelta.clone().applyMatrix3(
    new THREE.Matrix3().setFromMatrix4(selected.mesh.matrixWorld).invert()
  );


  // Apply to vertices
  dummyOrigin.copy(dummy.position);
  selected.moveVertices(selectedIndices, localDelta);

  updateAllDisplays();
}

let mouseStart = new THREE.Vector2();
let mouseTime = 0;

function selectVertexFromClick(e: PointerEvent) {
  const dragDelta = new THREE.Vector2(e.clientX, e.clientY).sub(mouseStart);
  const timeElapsed = performance.now() - mouseTime;
  if (dragDelta.lengthSq() > 4 || timeElapsed > 200 || !selected) return;

  const ray = createRayFromScreen(Viewport.camera, new THREE.Vector2(e.clientX, e.clientY), Viewport.renderer.domElement.getBoundingClientRect());
  const vertices = selected.getVertexWorldPositions();
  const distances = distanceFromPointsToRay(ray, vertices);

  const hitIndices: number[] = [];
  let minDistSq = Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const point = vertices[i];
    const distSq = distances[i];
    if (checkIfPointHidden(point)) continue;
    if (distSq > 0.16) continue; // 0.2²

    if (distSq < minDistSq) {
      minDistSq = distSq;
      hitIndices.length = 0;
      hitIndices.push(i);
    } else if (distSq === minDistSq) {
      hitIndices.push(i);
    }
  }

  if (hitIndices.length === 0) {
    transform.detach();
    selectedIndices = [];
    if (selectedDisplay) Viewport.removeDev(selectedDisplay);
    selectedDisplay = null;
    return;
  }

  for (const index of hitIndices) {
    const i = selectedIndices.indexOf(index);
    if (i === -1) selectedIndices.push(index);
    else selectedIndices.splice(i, 1); // toggle
  }

  updateTransformOrigin();
}

function checkIfPointHidden(point: THREE.Vector3): boolean {
  if (!selected) return false;

  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3().subVectors(point, Viewport.camera.position).normalize();
  raycaster.set(Viewport.camera.position, dir);
  raycaster.far = Viewport.camera.position.distanceTo(point);

  const hit = raycaster.intersectObject(selected.mesh, true)[0];
  if (!hit) return false;

  const pointDist = Viewport.camera.position.distanceTo(point);
  return Math.abs(hit.distance - pointDist) > 0.1;
}

// === Multi-select hold logic ===

let selectTimer: NodeJS.Timeout | null = null;

function onPointerDown(e: PointerEvent) {
  if (!selected || !enabled) return;
  if (selectTimer) clearTimeout(selectTimer);

  const vertices = selected.getVertexWorldPositions();
  selectTimer = setTimeout(() => {
    if(!selected) return;
    new Selection(new THREE.Vector2(e.clientX, e.clientY), vertices, 'points').result(hits => {
      const newIndices = (hits as THREE.Vector3[])
        .map(v => vertices.indexOf(v))
        .filter(i => i !== -1 && !checkIfPointHidden(vertices[i]));

      if (newIndices.length > 0) {
        selectedIndices.push(...newIndices);
        selectedIndices = [...new Set(selectedIndices)];
        updateTransformOrigin();
      }
    });
  }, 300);
}

function clearSelectionTimer() {
  if (selectTimer) {
    clearTimeout(selectTimer);
    selectTimer = null;
  }
}
export const tool:ModelingTool = {
  merge: () => {
    if(selected === null) return;
    const added = mergeVertices(selected, selectedIndices);
    selectedIndices = [added];
    updateVertexDisplayFromMesh();
    updateTransformOrigin();
  },
}