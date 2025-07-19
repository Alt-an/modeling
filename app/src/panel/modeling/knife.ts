import { EditableMesh, Edge, Face } from "./mesh";
import * as THREE from "three";
import { projectTo2D, intersectSegment2D, triangulateWithCut } from "./utils";

export function knifeEdges(mesh: EditableMesh, edges: Edge[], factor = 0.5): Edge[] {
  const newEdges: Edge[] = [];
  const edgeToMidpoint = new Map<string, number>();

  const newFaces: [number, number, number][] = [];
  const replacedFaceIndices = new Set<number>();

  // Step 1: Insert midpoint vertices for all edges
  for (const [a, b] of edges) {
    const key = [a, b].sort((x, y) => x - y).join(":");
    if (edgeToMidpoint.has(key)) continue;

    const posA = mesh.getVertex(a);
    const posB = mesh.getVertex(b);
    const midPos = posA.clone().lerp(posB, factor);
    const midIndex = mesh.addVertex(midPos);
    edgeToMidpoint.set(key, midIndex);

    newEdges.push([a, midIndex], [midIndex, b]);
  }

  // Step 2: Replace affected faces
  for (let i = 0; i < mesh.faces.length; i++) {
    const [v0, v1, v2] = mesh.faces[i];
    const faceEdges: [number, number][] = [
      [v0, v1],
      [v1, v2],
      [v2, v0],
    ];

    const mids: (number | null)[] = faceEdges.map(([a, b]) => {
      const key = [a, b].sort((x, y) => x - y).join(":");
      return edgeToMidpoint.get(key) ?? null;
    });

    const midCount = mids.filter(m => m !== null).length;
    if (midCount === 0) continue;

    replacedFaceIndices.add(i);

    if (midCount === 1) {
      const ei = mids.findIndex(m => m !== null);
      const mi = mids[ei]!;
      const [a, b] = faceEdges[ei];
      const c = [v0, v1, v2].filter(v => v !== a && v !== b)[0];

      newFaces.push([a, mi, c], [mi, b, c]);
      newEdges.push([a, mi], [mi, b], [mi, c]);
    } else if (midCount === 2) {
      const ei = mids.map((m, idx) => m !== null ? idx : -1).filter(i => i !== -1);
      const mi0 = mids[ei[0]]!;
      const mi1 = mids[ei[1]]!;
      const untouched = [v0, v1, v2].filter(v => !faceEdges.some(([a, b], j) => mids[j] !== null && (a === v || b === v)))[0];

      newFaces.push([mi0, mi1, untouched]);
      const edge1 = faceEdges[ei[0]];
      const edge2 = faceEdges[ei[1]];
      const a1 = edge1[0] === untouched ? edge1[1] : edge1[0];
      const a2 = edge2[0] === untouched ? edge2[1] : edge2[0];

      newFaces.push([a1, mi0, untouched]);
      newFaces.push([mi1, a2, untouched]);

      newEdges.push([mi0, mi1], [a1, mi0], [mi1, a2], [mi0, untouched], [mi1, untouched]);
    } else if (midCount === 3) {
      const [m0, m1, m2] = mids as [number, number, number];
      newFaces.push([v0, m0, m2], [m0, v1, m1], [m2, m1, v2], [m0, m1, m2]);

      newEdges.push([v0, m0], [m0, v1], [v1, m1], [m1, v2], [v2, m2], [m2, v0]);
      newEdges.push([m0, m1], [m1, m2], [m2, m0]);
    }
  }

  // Step 3: Replace faces
  mesh.faces = mesh.faces.filter((_, i) => !replacedFaceIndices.has(i));
  mesh.faces.push(...newFaces);

  // Finalize
  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();

  return newEdges;
}
// Returns indices of newly added faces
export function knifeCutFace(
  mesh: EditableMesh,
  faceIndex: number,
  origin: THREE.Vector3,
  direction: THREE.Vector3
): number[] {
  const face = mesh.faces[faceIndex];
  const [i0, i1, i2] = face;
  const v0 = mesh.getVertex(i0);
  const v1 = mesh.getVertex(i1);
  const v2 = mesh.getVertex(i2);

  // Flatten triangle and ray into 2D
  const { to2D, to3D } = projectTo2D(v0, v1, v2);
  const v0_2d = to2D(v0), v1_2d = to2D(v1), v2_2d = to2D(v2);
  const rayOrigin2d = to2D(origin);
  const rayDir2d = to2D(origin.clone().add(direction)).sub(rayOrigin2d).normalize();

  const edges = [[v0_2d, v1_2d], [v1_2d, v2_2d], [v2_2d, v0_2d]];
  const hits: THREE.Vector2[] = [];

  for (const [a, b] of edges) {
    const hit = intersectSegment2D(rayOrigin2d, rayDir2d, a, b);
    if (hit) hits.push(hit);
  }

  if (hits.length !== 2) return []; // No valid cut

  // Convert back to 3D positions
  const p3d0 = to3D(hits[0]);
  const p3d1 = to3D(hits[1]);
  const iA = mesh.addVertex(p3d0);
  const iB = mesh.addVertex(p3d1);

  // Remove original face
  mesh.faces.splice(faceIndex, 1);

  // Build 3 new faces that correctly triangulate the cut triangle
  const newFaces: Face[] = [
    [i0, iA, iB],
    [i1, iA, iB],
    [i2, iB, iA],
  ];

  // Use point-in-triangle test to figure out correct face topology
  const triangles = triangulateWithCut([i0, i1, i2], iA, iB, mesh);

  const originalNormal = new THREE.Triangle(v0, v1, v2).getNormal(new THREE.Vector3());
  const addedFaceIndices: number[] = [];

  for (const f of triangles) {
    const va = mesh.getVertex(f[0]);
    const vb = mesh.getVertex(f[1]);
    const vc = mesh.getVertex(f[2]);

    const normal = new THREE.Triangle(va, vb, vc).getNormal(new THREE.Vector3());
    const aligned = normal.dot(originalNormal) > 0;
    const finalFace = aligned ? f : [f[0], f[2], f[1]];

    addedFaceIndices.push(mesh.addFace(finalFace[0],finalFace[1],finalFace[2]));
  }

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();

  return addedFaceIndices;
}