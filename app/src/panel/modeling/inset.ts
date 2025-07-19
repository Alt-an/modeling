import * as THREE from "three";
import { EditableMesh, Face } from "./mesh";
import { getFaceNormal } from "./utils";

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function findConnectedRegions(faces: Face[]): Face[][] {
  const edgeToFaces = new Map<string, Face[]>();

  for (const face of faces) {
    for (let i = 0; i < 3; i++) {
      const a = face[i];
      const b = face[(i + 1) % 3];
      const key = edgeKey(a, b);
      if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
      edgeToFaces.get(key)!.push(face);
    }
  }

  const visited = new Set<Face>();
  const regions: Face[][] = [];

  for (const face of faces) {
    if (visited.has(face)) continue;

    const region: Face[] = [];
    const stack = [face];

    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      region.push(current);

      for (let i = 0; i < 3; i++) {
        const a = current[i];
        const b = current[(i + 1) % 3];
        const key = edgeKey(a, b);
        for (const neighbor of edgeToFaces.get(key) || []) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }
    }

    regions.push(region);
  }

  return regions;
}

export function insetFaces(mesh: EditableMesh, selectedFaces: Face[], insetAmount = 0.1, removeOriginal = false): number[] {
  if (selectedFaces.length === 0) return [];

  const newFaceIndices: number[] = [];
  const regions = findConnectedRegions(selectedFaces);

  for (const region of regions) {
    // Get unique vertex indices
    const vertexSet = new Set<number>();
    for (const face of region) {
      for (const i of face) vertexSet.add(i);
    }

    const originalVertices = [...vertexSet];
    const center = new THREE.Vector3();
    for (const i of originalVertices) {
      center.add(mesh.vertices[i]);
    }
    center.divideScalar(originalVertices.length);

    const newVertexMap = new Map<number, number>();
    for (const i of originalVertices) {
      const dir = mesh.vertices[i].clone().sub(center).normalize();
      const newPos = mesh.vertices[i].clone().sub(dir.multiplyScalar(insetAmount));
      const newIndex = mesh.addVertex(newPos);
      newVertexMap.set(i, newIndex);
    }

    if (removeOriginal) {
      mesh.faces = mesh.faces.filter(f => !region.includes(f));
    }

    for (const face of region) {
      const [a, b, c] = face;
      const na = newVertexMap.get(a)!;
      const nb = newVertexMap.get(b)!;
      const nc = newVertexMap.get(c)!;

      // Inner face
      newFaceIndices.push(mesh.addFace(na, nb, nc));

      // Bridge edges (side walls)
      newFaceIndices.push(mesh.addFace(a, b, nb));
      newFaceIndices.push(mesh.addFace(nb, na, a));

      newFaceIndices.push(mesh.addFace(b, c, nc));
      newFaceIndices.push(mesh.addFace(nc, nb, b));

      newFaceIndices.push(mesh.addFace(c, a, na));
      newFaceIndices.push(mesh.addFace(na, nc, c));
    }
  }

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();

  return newFaceIndices;
}