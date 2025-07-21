import * as THREE from 'three';
import { EditableMesh, Edge } from './mesh';
export function moveVerticesInward(mesh: EditableMesh, selectedVerts: number[], amount: number) {
  const center = new THREE.Vector3();
  for (const idx of selectedVerts) center.add(mesh.vertices[idx]);
  center.divideScalar(selectedVerts.length);

  for (const idx of selectedVerts) {
    const v = mesh.vertices[idx];
    const dir = v.clone().sub(center);
    const dist = dir.length();
    v.addScaledVector(dir.normalize(), Math.min(-amount, dist)); // inward
  }

  mesh.commit();
}
export function moveEdgesInward(mesh: EditableMesh, selectedEdges: Edge[], amount: number) {
  const vertSet = new Set<number>();
  for (const [a, b] of selectedEdges) {
    vertSet.add(a);
    vertSet.add(b);
  }

  const verts = Array.from(vertSet);
  const center = new THREE.Vector3();
  for (const idx of verts) center.add(mesh.vertices[idx]);
  center.divideScalar(verts.length);

  for (const idx of verts) {
    const v = mesh.vertices[idx];
    const dir = v.clone().sub(center);
    const dist = dir.length();
    v.addScaledVector(dir.normalize(), Math.min(-amount, dist)); // inward move
  }

  mesh.commit();
}