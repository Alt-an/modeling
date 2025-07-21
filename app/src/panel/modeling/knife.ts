import { EditableMesh, Edge, Face } from "./mesh";
import * as THREE from "three";
import { projectTo2D } from "./utils";

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
  return [];
}