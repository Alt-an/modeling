import * as THREE from 'three';
import { EditableMesh, Edge, Face } from './mesh';

export function bevelEdges(
  mesh: EditableMesh,
  selectedEdges: Edge[],
  width = 0.1,
  segments = 2
): Edge[] {
  if (segments < 2) return [];

  const anchorEdges: number[] = [];
  const anchorPoints: number[][] = [];
  const fillingEdges: number[][] = [];
  const bevelEdgesResult: Edge[] = [];

  for (const edge of selectedEdges) {
    const [a, b] = edge;
    const connectedFaces = mesh.getFacesUsingEdge(a, b);

    for (const face of connectedFaces) {
      const dir = getDirection(edge, face, mesh).multiplyScalar(width);

      const anchor1 = mesh.getVertex(a).clone().add(dir);
      const anchor2 = mesh.getVertex(b).clone().add(dir);
      const anchor1Index = mesh.addVertex(anchor1);
      const anchor2Index = mesh.addVertex(anchor2);

      const edge1 = mesh.getEdgePointOn(anchor1);
      const edge2 = mesh.getEdgePointOn(anchor2);
      if (edge1 === null || edge2 === null) throw new Error('Failed to find supporting edge');

      const newEdgeIndex = mesh.addEdge(anchor1Index, anchor2Index);
      anchorEdges.push(newEdgeIndex);
      anchorPoints.push([anchor1Index, anchor2Index]);

      for (const edgeIndex of [edge1, edge2]) {
        const [v0, v1] = mesh.getEdge(edgeIndex);
        const connected = mesh.getFacesUsingEdge(v0, v1).filter(f => f.includes(a) || f.includes(b));
        for (const f of connected) {
          const ia = f.indexOf(a);
          const ib = f.indexOf(b);
          if (ia >= 0) f[ia] = anchor1Index;
          if (ib >= 0) f[ib] = anchor2Index;
        }
      }

      const point1 = mesh.getEdge(edge1).find(v => v !== a)!;
      const point2 = mesh.getEdge(edge2).find(v => v !== b)!;

      fillingEdges.push([
        mesh.addEdge(anchor1Index, point1),
        mesh.addEdge(anchor2Index, point2)
      ]);
    }
  }

  // Remove original faces
  for (const [a, b] of selectedEdges) {
    for (const f of mesh.getFacesUsingVertex(a)) {
      const i = mesh.faces.indexOf(f);
      if (i !== -1) mesh.faces.splice(i, 1);
    }
    for (const f of mesh.getFacesUsingVertex(b)) {
      const i = mesh.faces.indexOf(f);
      if (i !== -1) mesh.faces.splice(i, 1);
    }
  }

  // Fill edge ring
  const bridgeEdges = (segments > 2)
    ? fillBetweenEdges(mesh, mesh.getEdge(anchorEdges[0]), mesh.getEdge(anchorEdges[1]), segments - 2)
    : [];

  const edgeRing = [
    anchorEdges[0],
    ...bridgeEdges.map(([v0, v1]) => mesh.addEdge(v0, v1)),
    anchorEdges[1]
  ];

  for (let i = 0; i < edgeRing.length - 1; i++) {
    const e1 = mesh.getEdge(edgeRing[i]);
    const e2 = mesh.getEdge(edgeRing[i + 1]);
    mesh.addFace(e1[1], e1[0], e2[0]);
    mesh.addFace(e2[0], e2[1], e1[1]);
  }

  // Fill corner gaps using overlapping shared vertex method
  const cornerX = findOverlappingPoint(mesh, mesh.getEdge(fillingEdges[0][0]), mesh.getEdge(fillingEdges[1][0]));
  const cornerY = findOverlappingPoint(mesh, mesh.getEdge(fillingEdges[0][1]), mesh.getEdge(fillingEdges[1][1]));

  if (cornerX === null || cornerY === null) throw new Error('Corner join failed');

  for (let i = 0; i < edgeRing.length - 1; i++) {
    const e1 = mesh.getEdge(edgeRing[i]);
    const e2 = mesh.getEdge(edgeRing[i + 1]);
    mesh.addFace(e2[0], e1[0], cornerX);
    mesh.addFace(e1[1], e2[1], cornerY);
  }

  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.commit();

  return bevelEdgesResult;
}

function getDirection(edge: Edge, face: Face, mesh: EditableMesh): THREE.Vector3 {
  const third = mesh.getVertex(face.find(v => !edge.includes(v))!);
  const dir1 = third.clone().sub(mesh.getVertex(edge[0]));
  const dir2 = third.clone().sub(mesh.getVertex(edge[1]));
  return dir1.lengthSq() > dir2.lengthSq() ? dir2.normalize() : dir1.normalize();
}

function findOverlappingPoint(mesh: EditableMesh, edge1: Edge, edge2: Edge): number | null {
  const faces1 = mesh.getFacesUsingEdge(edge1[0], edge1[1]);
  const faces2 = mesh.getFacesUsingEdge(edge2[0], edge2[1]);

  for (const f1 of faces1) {
    for (const f2 of faces2) {
      const v = findSharedVertex(f1, f2);
      if (v !== null) return v;
    }
  }
  return null;
}

function findSharedVertex(f1: Face, f2: Face): number | null {
  return f1.find(v => f2.includes(v)) ?? null;
}

function fillBetweenEdges(mesh: EditableMesh, e1: Edge, e2: Edge, amount: number): Edge[] {
  const [a1, a2] = [mesh.getVertex(e1[0]), mesh.getVertex(e1[1])];
  const [b1, b2] = [mesh.getVertex(e2[0]), mesh.getVertex(e2[1])];

  const dir = a1.clone().sub(b1);
  const cross = a1.clone().sub(a2);
  const normal = new THREE.Vector3().crossVectors(dir, cross).normalize();

  const p1 = createPointsBetweenEdges(a1, b1, normal, amount);
  const p2 = createPointsBetweenEdges(a2, b2, normal, amount);

  const edges: Edge[] = [];
  for (let i = 0; i < p1.length; i++) {
    const i1 = mesh.addVertex(p1[i]);
    const i2 = mesh.addVertex(p2[i]);
    edges.push([i1, i2]);
  }
  return edges;
}

function createPointsBetweenEdges(
  a: THREE.Vector3,
  b: THREE.Vector3,
  normal: THREE.Vector3,
  amount: number,
  profile = 0.5
): THREE.Vector3[] {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const control = mid.clone().add(normal.clone().multiplyScalar(profile * a.distanceTo(b)));

  const points: THREE.Vector3[] = [];
  for (let i = 1; i <= amount; i++) {
    const t = i / (amount + 1);
    const p1 = new THREE.Vector3().lerpVectors(a, control, t);
    const p2 = new THREE.Vector3().lerpVectors(control, b, t);
    points.push(new THREE.Vector3().lerpVectors(p1, p2, t));
  }
  return points;
}