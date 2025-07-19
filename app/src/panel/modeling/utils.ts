import { EditableMesh } from "./mesh";
import * as THREE from 'three';
// ==== Util ====
export function getSelectedFaces(mesh: EditableMesh): [number, number, number][] {
  return mesh.faces.filter(face =>
    face.every(i => mesh.selectedVertices.has(i))
  );
}

export function getFaceNormal(mesh: EditableMesh, face: [number, number, number]): THREE.Vector3 {
  const [a, b, c] = face;
  const va = mesh.getVertexWorld(a);
  const vb = mesh.getVertexWorld(b);
  const vc = mesh.getVertexWorld(c);
  return new THREE.Triangle(va, vb, vc).getNormal(new THREE.Vector3());
}