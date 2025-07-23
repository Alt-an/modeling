import * as THREE from 'three';
import { EditableMesh, Edge, Face } from './mesh';
import { Viewport } from '../viewport';

export function bevelEdges(
  mesh: EditableMesh,
  selectedEdges: Edge[],
  width = 0.1,
  segments = 2
): Edge[] {
  const edges:Edge[] = [];
  selectedEdges.forEach(edge => {
    edges.push(...bevelSingleEdge(mesh, [edge], width, segments));
  });
  return edges;
}
export function bevelSingleEdge(
  mesh: EditableMesh,
  selectedEdges: Edge[],
  width = 0.1,
  segments = 2
): Edge[] {
  if (segments < 2) return [];

  const bevelAnchors: Edge[] = [];
  const fillingEdges: Edge[] = [];

  for (const edge of selectedEdges) {
    const [a, b] = edge;
    const connectedFaces = mesh.getFacesUsingEdge(a, b);

    for (const face of connectedFaces) {
      const dir = computeBevelDirection(edge, face, mesh).multiplyScalar(width);

      const anchorA = mesh.getVertex(a).clone().add(dir);
      const anchorB = mesh.getVertex(b).clone().add(dir);

      const anchorAIndex = mesh.addVertex(anchorA);
      const anchorBIndex = mesh.addVertex(anchorB);
      bevelAnchors.push([anchorAIndex, anchorBIndex]);

      const supportAIndex = findSupportingEdge(mesh, anchorA);
      const supportBIndex = findSupportingEdge(mesh, anchorB);
      if (supportAIndex === null) {
        throw new Error('Failed to find supporting edge A');
      }
      if (supportBIndex === null) {
        throw new Error('Failed to find supporting edge B');
      }

      // Replace original vertices in face
      for (const edgeIndex of [supportAIndex, supportBIndex]) {
        const [v0, v1] = mesh.getEdge(edgeIndex);
        const touchingFaces = mesh.getFacesUsingEdge(v0, v1).filter(f => f.includes(a) || f.includes(b));
        for (const f of touchingFaces) {
          const ia = f.indexOf(a);
          const ib = f.indexOf(b);
          if (ia >= 0) f[ia] = anchorAIndex;
          if (ib >= 0) f[ib] = anchorBIndex;
        }
      }

      const sideA = mesh.getEdge(supportAIndex).find(v => v !== a)!;
      const sideB = mesh.getEdge(supportBIndex).find(v => v !== b)!;

      fillingEdges.push([
        mesh.addEdge(anchorAIndex, sideA),
        mesh.addEdge(anchorBIndex, sideB)
      ]);
    }
  }

  // Remove original faces touching selected edges
  for (const [a, b] of selectedEdges) {
    removeFacesTouchingVertex(mesh, a);
    removeFacesTouchingVertex(mesh, b);
  }

  // Fill between anchor edges
  const [anchorEdge1, anchorEdge2] = bevelAnchors;
  const bridgeSegmentEdges = (segments > 2)
    ? fillBetweenEdges(mesh, anchorEdge1, anchorEdge2, segments - 2)
    : [];

  const spanEdges = [
    anchorEdge1,
    ...bridgeSegmentEdges,
    anchorEdge2
  ];

  // Reconstruct bridging faces
  for (let i = 0; i < spanEdges.length - 1; i++) {
    const [v0a, v0b] = spanEdges[i];
    const [v1a, v1b] = spanEdges[i + 1];
    mesh.addFace(v0b, v0a, v1a); // bottom triangle
    mesh.addFace(v1a, v1b, v0b); // top triangle
  }

  // Fill corner gaps using shared vertex method
  const [fillA1, fillA2] = fillingEdges[0];
  const [fillB1, fillB2] = fillingEdges[1];

  const cornerA = findOverlappingCorner(mesh, mesh.getEdge(fillA1), mesh.getEdge(fillB1));
  const cornerB = findOverlappingCorner(mesh, mesh.getEdge(fillA2), mesh.getEdge(fillB2));

  if (cornerA === null || cornerB === null) {
    throw new Error('Corner fill failed due to missing overlap');
  }

  for (let i = 0; i < spanEdges.length - 1; i++) {
    const [v0a, v0b] = spanEdges[i];
    const [v1a, v1b] = spanEdges[i + 1];
    mesh.addFace(v1a, v0a, cornerA);
    mesh.addFace(v0b, v1b, cornerB);
  }

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.commit();

  return []; // No new edge tracking required per logic
}

// ---- Utility functions (same logic, cleaner form) ----

function computeBevelDirection(edge: Edge, face: Face, mesh: EditableMesh): THREE.Vector3 {
  const third = mesh.getVertex(face.find(v => !edge.includes(v))!);
  const dir1 = third.clone().sub(mesh.getVertex(edge[0]));
  const dir2 = third.clone().sub(mesh.getVertex(edge[1]));
  return dir1.lengthSq() > dir2.lengthSq() ? dir2.normalize() : dir1.normalize();
}

function findSupportingEdge(mesh: EditableMesh, point: THREE.Vector3): number | null {
  for (let i = 0; i < mesh.edges.length; i++) {
    const [a, b] = mesh.getEdge(i);
    const va = mesh.getVertex(a), vb = mesh.getVertex(b);
    const closest = closestPointOnSegment(va, vb, point);
    if (closest.distanceToSquared(point) < 1e-6) return i;
  }
  return null;
}

function closestPointOnSegment(a: THREE.Vector3, b: THREE.Vector3, p: THREE.Vector3): THREE.Vector3 {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.clone().add(ab.multiplyScalar(t));
}

function removeFacesTouchingVertex(mesh: EditableMesh, v: number) {
  const faces = mesh.getFacesUsingVertex(v);
  for (const face of faces) {
    const i = mesh.faces.indexOf(face);
    if (i !== -1) mesh.faces.splice(i, 1);
  }
}

function findOverlappingCorner(mesh: EditableMesh, edge1: Edge, edge2: Edge): number | null {
  const faces1 = mesh.getFacesUsingEdge(edge1[0], edge1[1]);
  const faces2 = mesh.getFacesUsingEdge(edge2[0], edge2[1]);

  for (const f1 of faces1) {
    for (const f2 of faces2) {
      const shared = f1.find(v => f2.includes(v));
      if (shared !== undefined) return shared;
    }
  }
  return null;
}

function fillBetweenEdges(
  mesh: EditableMesh,
  [a1, a2]: Edge,
  [b1, b2]: Edge,
  amount: number
): Edge[] {
  const pa1 = mesh.getVertex(a1);
  const pa2 = mesh.getVertex(a2);
  const pb1 = mesh.getVertex(b1);
  const pb2 = mesh.getVertex(b2);

  const normal = new THREE.Vector3()
    .crossVectors(pa1.clone().sub(pb1), pa1.clone().sub(pa2))
    .normalize();

  const row1 = bezierCurvePoints(pa1, pb1, normal, amount);
  const row2 = bezierCurvePoints(pa2, pb2, normal, amount);

  const result: Edge[] = [];
  for (let i = 0; i < amount; i++) {
    const v1 = mesh.addVertex(row1[i]);
    const v2 = mesh.addVertex(row2[i]);
    result.push([v1, v2]);
  }

  return result;
}

function bezierCurvePoints(
  a: THREE.Vector3,
  b: THREE.Vector3,
  normal: THREE.Vector3,
  segments: number,
  profile = 0.5
): THREE.Vector3[] {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const control = mid.clone().add(normal.clone().multiplyScalar(profile * a.distanceTo(b)));

  const points: THREE.Vector3[] = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / (segments + 1);
    const p1 = a.clone().lerp(control, t);
    const p2 = control.clone().lerp(b, t);
    points.push(p1.clone().lerp(p2, t));
  }
  return points;
}
