import { Edge, EditableMesh, Face } from "./mesh";
import { getFaceNormal } from "./utils";
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
export function extrudeEdges(mesh: EditableMesh, edges: Edge[], displacement = 1.0): Edge[] {
  const oldToNewVertex = new Map<number, number>();
  const newEdges: Edge[] = [];
  
  // Step 1: duplicate edge vertices and displace
  for (const [a, b] of edges) {
    for (const i of [a, b]) {
      if (!oldToNewVertex.has(i)) {
        const pos = mesh.getVertex(i).clone();
        
        const avgDir = pos.clone().normalize().multiplyScalar(displacement);
        
        const newIndex = mesh.addVertex(pos.add(avgDir));
        oldToNewVertex.set(i, newIndex);
      }
    }
  }
  
  // Step 2: build side quads and collect new edges
  for (const [a, b] of edges) {
    const a2 = oldToNewVertex.get(a)!;
    const b2 = oldToNewVertex.get(b)!;
    
    // Side wall (quad = 2 triangles)
    mesh.addFace(b2, b, a);
    mesh.addFace(a, a2, b2);
    
    // Record new edges
    newEdges.push([a, a2], [b, b2], [a2, b2], [b2, a]);
  }

  // Final sync
  mesh.rebuild();
  mesh.rebuildFromGeometry();
  mesh.computeFlatNormals();
  mesh.commit();

  return newEdges;
}