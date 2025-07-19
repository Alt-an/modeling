import { EditableMesh, Edge, Face } from "./mesh";
import { getFaceNormal } from "./utils";
import * as THREE from "three";

type BevelVertex = {
  orig: number;
  offset: number;
  face: number;
};

export function bevelEdges(mesh: EditableMesh, edges: Edge[], amount = 0.1) {
  const edgeToFaces = new Map<string, number[]>();
  const faceNormals = new Map<number, THREE.Vector3>();

  // Step 1: Build edge -> face adjacency
  mesh.faces.forEach((face, faceIndex) => {
    for (const pair of [[0, 1], [1, 2], [2, 0]]) {
      const a = face[pair[0]], b = face[pair[1]];
      const key = [Math.min(a, b), Math.max(a, b)].join(":");
      if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
      edgeToFaces.get(key)!.push(faceIndex);
    }
    faceNormals.set(faceIndex, getFaceNormal(mesh, face));
  });

  const deletedFaces = new Set<number>();
  const newFaces: Face[] = [];

  // Step 2: For each bevel edge
  for (const [vA, vB] of edges) {
    const key = [Math.min(vA, vB), Math.max(vA, vB)].join(":");
    const faces = edgeToFaces.get(key);
    if (!faces || faces.length < 1) continue;

    const bevelVerts: { a: BevelVertex, b: BevelVertex }[] = [];

    // Step 3: For each face sharing this edge
    for (const faceIndex of faces) {
      const face = mesh.faces[faceIndex];
      const normal = faceNormals.get(faceIndex)!;
      const indices = new Set(face);
      if (!indices.has(vA) || !indices.has(vB)) continue;

      const third = [...indices].find(i => i !== vA && i !== vB)!;

      // Get direction perpendicular to edge in plane of face
      const dir = mesh.vertices[vB].clone().sub(mesh.vertices[vA]).normalize();
      const perp = dir.clone().cross(normal).normalize().multiplyScalar(amount);

      // Offset A and B into the face
      const aOffset = mesh.vertices[vA].clone().add(perp);
      const bOffset = mesh.vertices[vB].clone().add(perp);

      const a1 = mesh.addVertex(aOffset);
      const b1 = mesh.addVertex(bOffset);

      bevelVerts.push({
        a: { orig: vA, offset: a1, face: faceIndex },
        b: { orig: vB, offset: b1, face: faceIndex },
      });

      // Replace triangle [vA, vB, third] with [third, a1, b1]
      const newTri = [third, a1, b1] as Face;
      newFaces.push(newTri);
      deletedFaces.add(faceIndex);
    }

    // Step 4: Stitch all bevel edge segments into ring
    for (let i = 0; i < bevelVerts.length; i++) {
      const curr = bevelVerts[i];
      const next = bevelVerts[(i + 1) % bevelVerts.length];

      // Two triangles to connect curr to next
      newFaces.push([curr.a.offset, next.a.offset, next.b.offset]);
      newFaces.push([next.b.offset, curr.b.offset, curr.a.offset]);
    }
  }

  // Step 5: Replace old faces and commit
  mesh.faces = mesh.faces.filter((_, i) => !deletedFaces.has(i));
  for (const f of newFaces) mesh.addFace(f[0], f[1], f[2]);

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();
}