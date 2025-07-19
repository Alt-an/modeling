import * as THREE from 'three';
import { EditableMesh, Face } from "./mesh"

export type ModelingTool = {
    extrude?: () => void
    inset?: () => void
    bevel?: () => void
    knife?: () => void
    merge?: () => void
}
export function extrudeFaces(mesh: EditableMesh, faces: Face[], displacement = 1.0): number[] {
  if (!faces.length) return [];
  const newFaceIndices: number[] = [];

  const oldToNewVertex = new Map<number, number>();
  const removedFaces = new Set<number>();

  for (let i = 0; i < mesh.faces.length; i++) {
    const f = mesh.faces[i];
    if (faces.some(([a, b, c]) => a === f[0] && b === f[1] && c === f[2])) {
      removedFaces.add(i);
    }
  }

  // Remove old faces
  mesh.faces = mesh.faces.filter((_, i) => !removedFaces.has(i));

  for (const face of faces) {
    const [i0, i1, i2] = face;
    const normal = getFaceNormal(mesh, face); // normalized
    const displace = normal.clone().multiplyScalar(displacement);

    // map original verts -> new extruded verts
    const newIndices = [i0, i1, i2].map(i => {
      if (!oldToNewVertex.has(i)) {
        const newPos = mesh.vertices[i].clone().add(displace);
        oldToNewVertex.set(i, mesh.addVertex(newPos));
      }
      return oldToNewVertex.get(i)!;
    });
    // cap (new face)
    newFaceIndices.push(mesh.addFace(newIndices[0], newIndices[1], newIndices[2]));

    // side walls
    for (let j = 0; j < 3; j++) {
      const a = face[j];
      const b = face[(j + 1) % 3];
      const a2 = oldToNewVertex.get(a)!;
      const b2 = oldToNewVertex.get(b)!;

      newFaceIndices.push(mesh.addFace(a, b, b2));
      newFaceIndices.push(mesh.addFace(b2, a2, a));
    }
  }

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();
  return newFaceIndices;
}
export function extrudeEdges(mesh:EditableMesh) {

}

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