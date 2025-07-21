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