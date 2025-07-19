import { EditableMesh, Face } from "./mesh";
import * as THREE from 'three';
// ==== Util ====

export function getFaceNormal(mesh: EditableMesh, face: [number, number, number]): THREE.Vector3 {
  const [a, b, c] = face;
  const va = mesh.getVertexWorld(a);
  const vb = mesh.getVertexWorld(b);
  const vc = mesh.getVertexWorld(c);
  return new THREE.Triangle(va, vb, vc).getNormal(new THREE.Vector3());
}

export function projectTo2D(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const normal = ab.clone().cross(ac).normalize();

  const tangent = ab.clone().normalize();
  const bitangent = normal.clone().cross(tangent);

  const basis = [tangent, bitangent, normal];

  function to2D(p: THREE.Vector3): THREE.Vector2 {
    const local = p.clone().sub(a);
    return new THREE.Vector2(
      local.dot(tangent),
      local.dot(bitangent)
    );
  }

  function to3D(p: THREE.Vector2): THREE.Vector3 {
    return a.clone()
      .add(basis[0].clone().multiplyScalar(p.x))
      .add(basis[1].clone().multiplyScalar(p.y));
  }

  return { to2D, to3D };
}

export function intersectSegment2D(
  p0: THREE.Vector2, d: THREE.Vector2,
  a: THREE.Vector2, b: THREE.Vector2
): THREE.Vector2 | null {
  const v1 = p0.clone().sub(a);
  const v2 = b.clone().sub(a);
  const v3 = new THREE.Vector2(-d.y, d.x); // perpendicular

  const denom = v2.dot(v3);
  if (Math.abs(denom) < 1e-8) return null;

  const t1 = v2.clone().cross(v1) / denom;
  const intersect = p0.clone().add(d.clone().multiplyScalar(t1));
  const t2 = intersect.clone().sub(a).dot(v2) / v2.lengthSq();

  if (t2 >= 0 && t2 <= 1) return intersect;
  return null;
}
export function triangulateWithCut(
  original: Face,
  iA: number,
  iB: number,
  mesh: EditableMesh
): Face[] {
  // For now: simple and always return 3 triangles
  const [a, b, c] = original;

  // Try every edge to find one cut per edge
  const edges: [number, number][] = [[a, b], [b, c], [c, a]];
  const onEdge = (v: number, x: number, y: number) => mesh.isPointOnEdge(v, x, y);

  for (let i = 0; i < 3; i++) {
    const [v1, v2] = edges[i];
    const [v3, v4] = edges[(i + 1) % 3];
    if (
      (onEdge(iA, v1, v2) && onEdge(iB, v3, v4)) ||
      (onEdge(iB, v1, v2) && onEdge(iA, v3, v4))
    ) {
      const vOther = original[(i + 2) % 3];
      return [
        [v1, iA, iB],
        [iB, v2, vOther],
        [vOther, iA, v1],
      ];
    }
  }

  // Fallback
  return [
    [a, iA, iB],
    [b, iA, iB],
    [c, iB, iA],
  ];
}