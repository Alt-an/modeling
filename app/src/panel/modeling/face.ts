import * as THREE from 'three';
import { Viewport } from '../viewport';
import { TransformControls, LineSegments2 } from 'three/examples/jsm/Addons.js';
import { createRaycastFromScreen } from '../util';
import { createFaceOutlineDisplay } from '../display';
import { EditableMesh } from './mesh';
import { ModelingTool } from './tools';
import * as EXTRUDE from './extrude'

let selected: EditableMesh | null = null;
let selectedIndices: number[] = [];
let enabled = false;

let transform: TransformControls;
let dummy = new THREE.Object3D();
const dummyOrigin = new THREE.Vector3();

let faceOutlineDisplay: LineSegments2 | null = null;

export function init(sharedDummy: THREE.Object3D, transformControl: TransformControls, container: HTMLElement) {
  dummy = sharedDummy;
  transform = transformControl;

  transform.addEventListener('mouseDown', () => {
    if (!enabled) return;
    Viewport.orbit.enabled = false;
    container.addEventListener('pointermove', onTransformMove);
  });

  transform.addEventListener('mouseUp', () => {
    if (!enabled) return;
    Viewport.orbit.enabled = true;
    container.removeEventListener('pointermove', onTransformMove);
  });

  let mouseStart = new THREE.Vector2();
  let mouseTime = 0;

  container.addEventListener("pointerdown", (e) => {
    if (!enabled) return;
    mouseTime = performance.now();
    mouseStart.set(e.clientX, e.clientY);
  });

  container.addEventListener('pointerup', (e) => {
    if (!enabled || !selected) return;

    const delta = new THREE.Vector2(e.clientX, e.clientY).sub(mouseStart);
    const tooFar = delta.lengthSq() > 4;
    const tooSlow = performance.now() - mouseTime > 200;
    if (tooFar || tooSlow) return;

    const ray = createRaycastFromScreen(
      Viewport.camera,
      new THREE.Vector2(e.clientX, e.clientY),
      Viewport.renderer.domElement.getBoundingClientRect()
    );

    const hits = ray.intersectObject(selected.mesh, false);
    if (hits.length === 0) return drop();

    const faceIndex = hits[0].faceIndex!;
    if (!selectedIndices.includes(faceIndex)) {
      selectedIndices.push(faceIndex);
      updateSelectionDisplay();
    } else {
      selectedIndices.splice(selectedIndices.indexOf(faceIndex));
      updateSelectionDisplay();
    }
  });
}

export function enable(flag: boolean) {
  enabled = flag;
  if (!enabled) {
    clearDisplay();
  } else if (selected) {
    updateSelectionDisplay();
  }
}

export function select(obj: THREE.Object3D) {
  if (!(obj instanceof THREE.Mesh)) return;
  selected = new EditableMesh(obj);
  updateSelectionDisplay();
}

export function drop() {
  selected = null;
  selectedIndices = [];
  clearDisplay();
}

function clearDisplay() {
  transform.detach();

  if (faceOutlineDisplay) {
    Viewport.removeDev(faceOutlineDisplay);
    faceOutlineDisplay = null;
  }
}

function updateSelectionDisplay() {
  if (!selected || selectedIndices.length === 0) {
    clearDisplay();
    return;
  }

  const faceTriangles: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [];
  const center = new THREE.Vector3();
  let total = 0;

  for (const f of selectedIndices) {
    const indices = selected.getFaceVertexIndices(f);
    const v0 = selected.getVertexWorld(indices[0]);
    const v1 = selected.getVertexWorld(indices[1]);
    const v2 = selected.getVertexWorld(indices[2]);

    center.add(v0).add(v1).add(v2);
    total += 3;

    faceTriangles.push([v0.clone(), v1.clone(), v2.clone()]);
  }

  center.divideScalar(total);
  dummy.position.copy(center);
  dummyOrigin.copy(center);
  transform.attach(dummy);

  if (faceOutlineDisplay) Viewport.removeDev(faceOutlineDisplay);
  faceOutlineDisplay = createFaceOutlineDisplay(faceTriangles);
  Viewport.addDev(faceOutlineDisplay);
}

function onTransformMove() {
  if (!selected || selectedIndices.length === 0) return;

  const worldDelta = dummy.position.clone().sub(dummyOrigin);
  const localDelta = selected.mesh.worldToLocal(selected.mesh.localToWorld(worldDelta.clone()));
  dummyOrigin.copy(dummy.position);

  const moved = new Set<number>();

  for (const faceIndex of selectedIndices) {
    const indices = selected.getFaceVertexIndices(faceIndex);
    for (const i of indices) {
      if (!moved.has(i)) {
        moved.add(i);
      }
    }
  }

  selected.moveVertices(Array.from(moved), localDelta);
  updateSelectionDisplay();
}

export const tool:ModelingTool = {
  extrude: () => {
    if(selected === null) return;
    const added = EXTRUDE.extrudeFaces(selected, selectedIndices.map(i => selected!.faces[i]), 0.1);
    selectedIndices = added;
    updateSelectionDisplay();
  }
}