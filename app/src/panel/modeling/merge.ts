import { EditableMesh } from "./mesh";
import * as THREE from "three";

export function mergeVertices(mesh: EditableMesh, indices: number[]): number;
export function mergeVertices(mesh: EditableMesh, indices: number | number[]): number {
  if (!Array.isArray(indices)) indices = [indices];
  if (indices.length < 2) return indices[0];

  const mergedPos = new THREE.Vector3();
  for (const i of indices) {
    mergedPos.add(mesh.getVertex(i));
  }
  mergedPos.divideScalar(indices.length);

  const newIndex = mesh.vertices.length;
  mesh.vertices.push(mergedPos);

  for (let i = 0; i < mesh.faces.length; i++) {
    const face = mesh.faces[i].map(v => indices.includes(v) ? newIndex : v);
    const unique = new Set(face);
    if (unique.size < 3) {
      mesh.faces[i] = null!; // Mark as degenerate
    } else {
      mesh.faces[i] = [...face] as [number, number, number];
    }
  }

  // Step 4: Remove degenerate faces
  mesh.faces = mesh.faces.filter(f => f && new Set(f).size === 3);

  // Step 5: Cleanup unused vertices
  const used = new Set<number>();
  for (const [a, b, c] of mesh.faces) {
    used.add(a);
    used.add(b);
    used.add(c);
  }

  const oldToNew = new Map<number, number>();
  const newVertices: THREE.Vector3[] = [];
  mesh.vertices.forEach((v, i) => {
    if (used.has(i)) {
      oldToNew.set(i, newVertices.length);
      newVertices.push(v);
    }
  });
  for (let i = 0; i < mesh.faces.length; i++) {
    mesh.faces[i] = mesh.faces[i].map(v => oldToNew.get(v)!) as [number, number, number];
  }
  mesh.vertices = newVertices;

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();

  return oldToNew.get(newIndex)!;
}