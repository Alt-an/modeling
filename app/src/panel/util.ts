import * as THREE from 'three';
import { BufferGeometryUtils, RectAreaLightUniformsLib, TransformControls } from 'three/examples/jsm/Addons.js';
import { Viewport } from './viewport';
import { Notification } from './notif';
const elementsMap = new Map<string, HTMLElement>();
export function fixTransformControls(tf:TransformControls) {
  tf.addEventListener("change", () => {
    if (!tf.object) return;
    const anyTf = tf as any;
    tf.object.updateMatrixWorld();
    tf.object.parent?.updateMatrixWorld();
    tf.object.matrixWorld.decompose(anyTf.worldPosition, anyTf.worldQuaternion, anyTf._worldScale);

    anyTf._plane.quaternion.copy(Viewport.camera.quaternion);
    anyTf._plane.position.copy(anyTf.worldPosition);
    anyTf._plane.updateMatrixWorld(true);
  });
}
export function isDropdownOpen(element:HTMLElement) {
  return (element.querySelector(".dropdown-options") as HTMLElement)!.style.display !== "none";
}
export function getElement(query:string):HTMLElement {
  const map = elementsMap.get(query);
  if(map) return map;
  const el = document.querySelector(query) as HTMLElement | undefined;
  if(!el) throw new Error("Element not found: "+query);
  elementsMap.set(query, el);
  return el;
}
export function getButtons(query:string, funcs:Function[]):Function[] {
  const buttons = document.querySelectorAll(query);
  const functions:Function[] = [];
  buttons.forEach((btn, i) => {
    functions.push(() => (btn as HTMLButtonElement).click());
    btn.addEventListener("click", () => { funcs[i](); });
  });
  return functions;
}
export function getVertices(mesh: THREE.Mesh): THREE.Vector3[] {
  const vertices:THREE.Vector3[] = [];
  const posAttr = mesh.geometry.getAttribute("position");
  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    vertices.push(mesh.localToWorld(v));
  }
  return vertices;
}
export function getSelectedVertexIndices(
  selectedPoints: THREE.Vector3[],
  geometry: THREE.BufferGeometry,
  mesh: THREE.Mesh
): number[] {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const indices: number[] = [];
  for (const selected of selectedPoints) {
    const point = mesh.worldToLocal(selected.clone());
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      // Precision check with zero tolerance
      if (Math.abs(x - point.x) === 0 &&
          Math.abs(y - point.y) === 0 &&
          Math.abs(z - point.z) === 0) {
        indices.push(i);
        break;
      }
    }
  }
  return indices;
}
export function getWireframe(geometry:THREE.BufferGeometry) {
    return new THREE.EdgesGeometry(geometry);
}
export function deleteMesh(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
        disposeMesh(child);
    }
  });
  disposeMesh(obj);
  obj.parent?.remove(obj);
}
export function disposeMesh(obj:THREE.Object3D) {
    const m = obj as THREE.Mesh;
    m.geometry?.dispose?.();

    if (Array.isArray(m.material)) {
    m.material.forEach(mat => mat?.dispose?.());
    } else {
    m.material?.dispose?.();
    }
}
export function castRayFromScreen(camera:THREE.Camera, targets:THREE.Object3D[], position:THREE.Vector2, bounds:DOMRect) {
  const mouse = new THREE.Vector2(
    ((position.x - bounds.left) / bounds.width) * 2 - 1,
    -((position.y - bounds.top) / bounds.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObjects(targets);
}
export function createRayFromScreen(camera:THREE.Camera, position:THREE.Vector2, bounds:DOMRect) {
  const mouse = new THREE.Vector2(
    ((position.x - bounds.left) / bounds.width) * 2 - 1,
    -((position.y - bounds.top) / bounds.height) * 2 + 1
  );

  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  return ray.ray;
}
export function createRaycastFromScreen(camera:THREE.Camera, position:THREE.Vector2, bounds:DOMRect) {
  const mouse = new THREE.Vector2(
    ((position.x - bounds.left) / bounds.width) * 2 - 1,
    -((position.y - bounds.top) / bounds.height) * 2 + 1
  );

  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  return ray;
}
export function distanceFromPointsToRay(ray: THREE.Ray, points: THREE.Vector3 | THREE.Vector3[]): number[] {
  const pts = Array.isArray(points) ? points : [points];
  return pts.map(point => {
    return ray.distanceToPoint(point);
  });
}
export function disableBrowserBehavior(dom:HTMLElement) {
  Object.assign(dom.style, {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  });
  ["contextmenu", "selectstart", "pointerdown", "mousedown", "dragstart"].forEach(evt =>
    dom.addEventListener(evt, (e:any) => e.preventDefault())
  );
  document.body.style.userSelect = 'none';
  dom.addEventListener('pointerup', () => document.body.style.userSelect = '');
  dom.addEventListener('pointercancel', () => document.body.style.userSelect = '');

  let lastTap = 0;
  document.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  });
  document.addEventListener("gesturestart", e => e.preventDefault());
  document.addEventListener("gesturechange", e => e.preventDefault());
  document.addEventListener("gestureend", e => e.preventDefault());
}

export function createFrustumFromScreen(
  x1: number, y1: number,
  x2: number, y2: number,
  camera: THREE.Camera,
  domRect: DOMRect
): THREE.Frustum {
  const ndc1 = new THREE.Vector2(
    ((x1 - domRect.left) / domRect.width) * 2 - 1,
    -((y1 - domRect.top) / domRect.height) * 2 + 1
  );
  const ndc2 = new THREE.Vector2(
    ((x2 - domRect.left) / domRect.width) * 2 - 1,
    -((y2 - domRect.top) / domRect.height) * 2 + 1
  );

  const min = ndc1.clone().min(ndc2);
  const max = ndc1.clone().max(ndc2);

  // 8 corners in clip space (NDC), unprojected to world
  const corners = [
    new THREE.Vector3(min.x, min.y, -1), // near
    new THREE.Vector3(max.x, min.y, -1),
    new THREE.Vector3(max.x, max.y, -1),
    new THREE.Vector3(min.x, max.y, -1),

    new THREE.Vector3(min.x, min.y, 1), // far
    new THREE.Vector3(max.x, min.y, 1),
    new THREE.Vector3(max.x, max.y, 1),
    new THREE.Vector3(min.x, max.y, 1),
  ].map(p => p.unproject(camera));

  const [n0, n1, n2, n3, f0, f1, f2, f3] = corners;

  const frustum = new THREE.Frustum(
    new THREE.Plane().setFromCoplanarPoints(n0, n1, f1), // bottom
    new THREE.Plane().setFromCoplanarPoints(n1, n2, f2), // right
    new THREE.Plane().setFromCoplanarPoints(n2, n3, f3), // top
    new THREE.Plane().setFromCoplanarPoints(n3, n0, f0), // left
    new THREE.Plane().setFromCoplanarPoints(n1, n0, n3), // near
    new THREE.Plane().setFromCoplanarPoints(f0, f1, f2)  // far
  );

  return frustum;
}

// 4. Test objects
export function getObjectsInFrustum(frustum: THREE.Frustum, objs: THREE.Object3D[]) {
  const hits: THREE.Object3D[] = [];
  for (const root of objs) {
    root.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.geometry?.boundingSphere) {
        obj.updateMatrixWorld(true);

        const center = obj.geometry.boundingSphere.center.clone().applyMatrix4(obj.matrixWorld);
        if (frustum.containsPoint(center)) {
          hits.push(obj);
        }
      }
    });
  }
  return hits;
}
export function getPointsInFrustum(
  frustum: THREE.Frustum,
  points: THREE.Vector3[]
): THREE.Vector3[] {
  return points.filter(p => frustum.containsPoint(p));
}
export function toIndexed(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  if (geometry.getIndex()) {
    Notification.error("Geometry is already indexed", "Are you certain what you are doing is correct?");
  }
  addIndexBuffer(geometry);
  if (!geometry.getIndex()) {
    Notification.error("Failed to merge vertices", "Geometry remains unindexed");
    return;
  }
}
function addIndexBuffer(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.index) return geometry; // already indexed

  const count = geometry.attributes.position.count;
  const indices = Array.from({ length: count }, (_, i) => i);
  geometry.setIndex(indices);
  return geometry;
}
export function getEdges(geometry: THREE.BufferGeometry): [number, number][] {
  const index = geometry.getIndex();
  if (!index) throw new Error('Geometry must be indexed');
  const edgeMap = new Set<string>();
  const result: [number, number][] = [];

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    [[a, b], [b, c], [c, a]].forEach(([i1, i2]) => {
      const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
      if (!edgeMap.has(key)) {
        edgeMap.add(key);
        result.push([i1, i2]);
      }
    });
  }

  return result;
}
export function rayToLocalSpace(ray: THREE.Ray, object: THREE.Object3D): THREE.Ray {
  const inverseMatrix = new THREE.Matrix4().copy(object.matrixWorld).invert();

  const localOrigin = ray.origin.clone().applyMatrix4(inverseMatrix);

  const localDirection = ray.direction.clone().transformDirection(inverseMatrix);
  localDirection.normalize();

  return new THREE.Ray(localOrigin, localDirection);
}
export function findClosestEdge(
  edgeCandidates: [number, number][],
  vertexPositions: THREE.Vector3[],
  ray: THREE.Ray,
  tolerance: number
): [number, number] | null {
  let closest: [number, number] | null = null;
  let minDistSq = Infinity;

  for (const [i0, i1] of edgeCandidates) {
    const a = vertexPositions[i0];
    const b = vertexPositions[i1];

    const distSq = ray.distanceSqToSegment(a, b);
    if (distSq < tolerance && distSq < minDistSq) {
      minDistSq = distSq;
      closest = [i0, i1];
    }
  }
  return closest;
}
export function findOverlappingVertices(geometry: THREE.BufferGeometry, threshold = 1e-4) {
  const pos = geometry.attributes.position;
  const groups: number[][] = [];

  for (let i = 0; i < pos.count; i++) {
    const vi = new THREE.Vector3().fromBufferAttribute(pos, i);
    let found = false;

    for (const group of groups) {
      const vj = new THREE.Vector3().fromBufferAttribute(pos, group[0]);
      if (vi.distanceTo(vj) < threshold) {
        group.push(i);
        found = true;
        break;
      }
    }

    if (!found) {
      groups.push([i]);
    }
  }

  return groups;
}