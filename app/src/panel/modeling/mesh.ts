import * as THREE from 'three';
import { toIndexed } from '../util';
import { Notification } from '../notif';

export type Edge = [number, number];
export type Face = [number, number, number];

export class EditableMesh {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;

  vertices: THREE.Vector3[] = [];
  faces: Face[] = [];
  edges: Set<string> = new Set(); // key = sorted "a:b", internal only

  selectedVertices = new Set<number>();
  selectedEdges = new Set<string>();
  vertMap: Map<number, number> = new Map(); // Add this field in the class

  constructor(mesh: THREE.Mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry as THREE.BufferGeometry;
    this.rebuildFromGeometry();
    this.commit();
  }

  dispose() {
    this.vertices.length = 0;
    this.faces.length = 0;
    this.edges.clear();
    this.selectedVertices.clear();
    this.selectedEdges.clear();
    this.vertMap.clear();
  }


  rebuildFromGeometry() {
    this.dispose();

    const posAttr = this.geometry.getAttribute('position');
    let indexAttr = this.geometry.getIndex();
    if (!indexAttr) {
      toIndexed(this.mesh);
      Notification.warn("Unindexed Geometry", "Can't find index for this geometry, auto indexing...");
      indexAttr = this.geometry.getIndex()!;
      if(!indexAttr) Notification.warn("Auto-indexing Failed", "Can't automatically index for this geometry");
    }

    const uniqueVerts: THREE.Vector3[] = [];
    const toleranceSq = 1e-10;

    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      let found = -1;
      for (let j = 0; j < uniqueVerts.length; j++) {
        if (uniqueVerts[j].distanceToSquared(v) < toleranceSq) {
          found = j;
          break;
        }
      }
      if (found === -1) {
        found = uniqueVerts.length;
        uniqueVerts.push(v);
      }
      this.vertMap.set(i, found);
    }

    this.vertices = uniqueVerts;

    for (let i = 0; i < indexAttr.count; i += 3) {
      const ia = indexAttr.getX(i);
      const ib = indexAttr.getX(i + 1);
      const ic = indexAttr.getX(i + 2);

      const a = this.vertMap.get(ia)!;
      const b = this.vertMap.get(ib)!;
      const c = this.vertMap.get(ic)!;

      this.faces.push([a, b, c]);
      this.addEdge(a, b);
      this.addEdge(b, c);
      this.addEdge(c, a);
    }
  }

  // --- Vertex Accessors ---

  setVertex(index: number, position: THREE.Vector3) {
    this.vertices[index].copy(position);
    this.commit();
  }

  getVertex(index: number): THREE.Vector3 {
    return this.vertices[index];
  }

  getVertexWorld(index: number): THREE.Vector3 {
    return this.mesh.localToWorld(this.vertices[index].clone());
  }

  setVertexWorld(index: number, worldPos: THREE.Vector3): void {
    const local = this.mesh.worldToLocal(worldPos.clone());
    this.setVertex(index, local);
  }

  getVertexPositions(): THREE.Vector3[] {
    return this.vertices;
  }

  getVertexWorldPositions(): THREE.Vector3[] {
    return this.vertices.map(v => this.mesh.localToWorld(v.clone()));
  }

  getSelectedVertexIndices(): number[] {
    return Array.from(this.selectedVertices);
  }

  getSelectedVertexPositions(): THREE.Vector3[] {
    return Array.from(this.selectedVertices).map(i => this.vertices[i]);
  }
  addVertex(position: THREE.Vector3): number {
    const logicalIndex = this.vertices.length;
    this.vertices.push(position.clone());

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const newCount = posAttr.count + 1;

    const newPos = new Float32Array(newCount * 3);
    newPos.set(posAttr.array);
    newPos.set([position.x, position.y, position.z], posAttr.count * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    this.vertMap.set(newCount - 1, logicalIndex);

    return logicalIndex;
  }
  moveVertices(indices: number[], delta: THREE.Vector3): void {
    for (const i of indices) {
      this.vertices[i].add(delta);
    }
    this.commit();
  }
  clearVertexSelection(): void {
    this.selectedVertices.clear();
  }
  // ======== Egde ========


  clearEdgeSelection(): void {
    this.selectedEdges.clear();
  }

  addEdge(a: number, b: number) {
    const [min, max] = a < b ? [a, b] : [b, a];
    this.edges.add(`${min}:${max}`);
  }

  getEdgeVertices(key: string): [THREE.Vector3, THREE.Vector3] {
    const [a, b] = key.split(':').map(Number);
    return [this.vertices[a], this.vertices[b]];
  }

  selectVertex(index: number) {
    this.selectedVertices.add(index);
  }

  selectEdge(a: number, b: number) {
    const [min, max] = a < b ? [a, b] : [b, a];
    this.selectedEdges.add(`${min}:${max}`);
  }

  commit(): void {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr || !this.vertMap) return;

    for (let i = 0; i < posAttr.count; i++) {
      const mappedIndex = this.vertMap.get(i);
      if (mappedIndex === undefined) continue;
      const v = this.vertices[mappedIndex];
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }

    posAttr.needsUpdate = true;
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }
  rebuild() {
    const geometry = this.geometry;
    const mesh = this;

    const position = new Float32Array(mesh.vertices.length * 3);
    for (let i = 0; i < mesh.vertices.length; i++) {
      const v = mesh.vertices[i];
      position[i * 3 + 0] = v.x;
      position[i * 3 + 1] = v.y;
      position[i * 3 + 2] = v.z;
    }

    const indices: number[] = [];
    for (const [a, b, c] of mesh.faces) {
      indices.push(a, b, c);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;
    geometry.index!.needsUpdate = true;
  }

  getSelectedEdges(): [THREE.Vector3, THREE.Vector3][] {
    return Array.from(this.selectedEdges).map(k => this.getEdgeVertices(k));
  }

  // ==== Face ========
  addFace(a: number, b: number, c: number): number {
    this.faces.push([a, b, c]);

    this.addEdge(a, b);
    this.addEdge(b, c);
    this.addEdge(c, a);

    let indexAttr = this.geometry.getIndex()!;
    const oldCount = indexAttr.count || 0;
    const newIndices = new Uint32Array(oldCount + 3);

    newIndices.set(indexAttr.array);
    newIndices.set([a, b, c], oldCount);

    this.geometry.setIndex(new THREE.BufferAttribute(newIndices, 1));
    return this.faces.length - 1;
  }
  deleteFace(index: number) {
    const face = this.faces[index];
    if (!face) return;

    // Remove edges if no other face uses them
    const [a, b, c] = face;
    this.faces.splice(index, 1);

    const removeEdge = (i: number, j: number) => {
      const key = [Math.min(i, j), Math.max(i, j)].join(":");
      this.edges.delete(key);
    };

    removeEdge(a, b);
    removeEdge(b, c);
    removeEdge(c, a);
  }
  getFaceVertexIndices(index: number): Face {
    return this.faces[index];
  }

  clearSelection() {
    this.selectedVertices.clear();
    this.selectedEdges.clear();
  }
  computeFlatNormals() {
    const normals: THREE.Vector3[] = this.vertices.map(() => new THREE.Vector3());

    for (const [a, b, c] of this.faces) {
      const v0 = this.vertices[a];
      const v1 = this.vertices[b];
      const v2 = this.vertices[c];

      const normal = new THREE.Vector3()
        .crossVectors(v1.clone().sub(v0), v2.clone().sub(v0))
        .normalize();

      normals[a].add(normal);
      normals[b].add(normal);
      normals[c].add(normal);
    }

    return normals.map(n => n.normalize());
  }
}