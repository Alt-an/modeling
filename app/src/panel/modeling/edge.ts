import * as THREE from 'three';
import { Viewport } from '../viewport';
import { TransformControls, LineSegments2 } from 'three/examples/jsm/Addons.js';
import { createRaycastFromScreen, findClosestEdge, rayToLocalSpace, toIndexed } from '../util';
import { createEdgeDisplay } from '../display';
import { Edge, EditableMesh } from './mesh';
import { ModelingTool } from './tools';
import * as EXTRUDE from './extrude';
import * as KNIFE from './knife';
import * as BEVEL from './bevel';
import { Modeling } from '../modeling';
import { moveEdgesInward } from './controls';
import { updateSelectionDisplay } from './face';

let enabled = false;
let selected: EditableMesh | null = null;
let selectedEdges: Edge[] = [];

let transform: TransformControls;
let dummy = new THREE.Object3D();
const dummyOrigin = new THREE.Vector3();

let edgeDisplay: LineSegments2 | null = null;

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

  container.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    mouseTime = performance.now();
    mouseStart.set(e.clientX, e.clientY);
  });

  container.addEventListener('pointerup', (e) => {
    if (!enabled || !selected) return;
    const delta = new THREE.Vector2(e.clientX, e.clientY).sub(mouseStart);
    if (delta.lengthSq() > 4 || performance.now() - mouseTime > 200) return;

    const ray = createRaycastFromScreen(Viewport.camera, new THREE.Vector2(e.clientX, e.clientY), Viewport.renderer.domElement.getBoundingClientRect());
    const hits = ray.intersectObject(selected.mesh, false);
    if (hits.length === 0) return drop();

    const faceIndex = hits[0].faceIndex!;
    const [i0, i1, i2] = selected.faces[faceIndex];

    const tri = [
      [i0, i1],
      [i1, i2],
      [i2, i0]
    ] as [number, number][];

    const rayLocal = rayToLocalSpace(ray.ray, selected.mesh);
    const closest = findClosestEdge(tri, selected.vertices, rayLocal, 0.2);
    if (closest === null) {
      selectedEdges = [];
      updateTransformOrigin();
      return;
    }

    if (!hasEdge(closest)) {
      selectedEdges.push(closest);
    } else {
      selectedEdges = selectedEdges.filter(([a, b]) =>
        !(a === closest[0] && b === closest[1]) && !(a === closest[1] && b === closest[0])
      );
    }

    updateTransformOrigin();
  });
}

export function enable(flag: boolean) {
  enabled = flag;
  if (!enabled) {
    clearDisplay();
  } else if (selected) {
    updateTransformOrigin();
  }
}

export function select(mesh: THREE.Mesh) {
  if (!(mesh instanceof THREE.Mesh)) return;
  const index = mesh.geometry.getIndex();
  if (!index) {
    toIndexed(mesh);
    console.warn('Automatically indexing geometry');
  }
  const editable = new EditableMesh(mesh);
  editable.rebuildFromGeometry();
  selected = editable;
  updateTransformOrigin();
}

export function drop() {
  selected = null;
  selectedEdges = [];
  clearDisplay();
}

function clearDisplay() {
  transform.detach();
  if (edgeDisplay) {
    Viewport.removeDev(edgeDisplay);
    edgeDisplay = null;
  }
}

function hasEdge([a, b]: [number, number]) {
  return selectedEdges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function updateTransformOrigin() {
  if (!selected || selectedEdges.length === 0) {
    clearDisplay();
    return;
  }

  const center = new THREE.Vector3();
  const edgeSegments: [THREE.Vector3, THREE.Vector3][] = [];

  for (const [i0, i1] of selectedEdges) {
    const a = selected.getVertexWorld(i0);
    const b = selected.getVertexWorld(i1);
    center.add(a).add(b);
    edgeSegments.push([a.clone(), b.clone()]);
  }

  center.divideScalar(selectedEdges.length * 2);
  dummy.position.copy(center);
  dummyOrigin.copy(center);
  transform.attach(dummy);

  if (edgeDisplay) Viewport.removeDev(edgeDisplay);
  edgeDisplay = createEdgeDisplay(edgeSegments);
  Viewport.addDev(edgeDisplay);
}

function onTransformMove() {
  if (!selected || selectedEdges.length === 0) return;

  const worldDelta = dummy.position.clone().sub(dummyOrigin);
  if(Modeling.control.inwardScaling) {
    moveEdgesInward(selected, selectedEdges, worldDelta.y);
    dummyOrigin.copy(dummy.position);
    updateTransformOrigin();
    return;
  }
  const localDelta = selected.mesh.worldToLocal(selected.mesh.localToWorld(worldDelta.clone()));
  dummyOrigin.copy(dummy.position);

  const moved = new Set<number>();
  for (const [i0, i1] of selectedEdges) {
    for (const i of [i0, i1]) {
      if (moved.has(i)) continue;
      moved.add(i);

      selected.vertices[i].add(localDelta);
      selected.setVertex(i, selected.vertices[i]);
    }
  }

  updateTransformOrigin();
}

export const tool:ModelingTool = {
  extrude: () => {
    if(selected === null) return;
    const added = EXTRUDE.extrudeEdges(selected, selectedEdges, 0.1);
    selectedEdges = added;
    updateTransformOrigin();
  },
  bevel: () => {
    if(selected === null) return;
    const added = BEVEL.bevelEdges(selected, selectedEdges, 0.1, Modeling.options.bevel.segments);
    selectedEdges = added;
    updateSelectionDisplay();
    updateTransformOrigin();
  },
  knife: () => {
    if(selected === null) return;
    const added = KNIFE.knifeEdges(selected, selectedEdges, 0.5);
    selectedEdges = added;
    updateTransformOrigin();
  }
}