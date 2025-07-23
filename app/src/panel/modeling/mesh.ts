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
  edges: Edge[] = []; // key = sorted "a:b", internal only


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
    this.edges.length = 0;
    this.vertMap.clear();
  }


  rebuildFromGeometry() {
    this.dispose();

    const posAttr = this.geometry.getAttribute('position');
    let indexAttr = this.geometry.getIndex();
    if (!indexAttr) {
      toIndexed(this.mesh);
      Notification.warn("Unindexed Geometry", "Can't find index for this geometry, auto indexing...");
      this.geometry = this.mesh.geometry as THREE.BufferGeometry;
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
  getConnectedVertices(index: number): Set<number> {
    const connected = new Set<number>();
    for (const [a, b, c] of this.faces) {
      if (a === index) { connected.add(b); connected.add(c); }
      else if (b === index) { connected.add(a); connected.add(c); }
      else if (c === index) { connected.add(a); connected.add(b); }
    }
    return connected;
  }
  // ======== Egde ========
  edgeExists(a: number, b: number): boolean {
    return this.getEdgeIndex(a, b) !== -1;
  }
  addEdge(a: number, b: number): number {
    if (this.edgeExists(a, b)) return this.getEdgeIndex(a, b);
    this.edges.push([a, b]);
    return this.edges.length - 1;
  }
  getEdge(index:number) {
    return this.edges[index];
  }
  getEdgeIndex(a: number, b: number) {
    return this.edges.findIndex(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
  }
  getEdgesUsingVertex(v: number):Edge[] {
    return this.edges.filter(e => e.includes(v));
  }
  getFacesUsingVertex(v:number): Face[] {
    return this.faces.filter(f => f.includes(v));
  }
  getFacesUsingEdge(a: number, b: number): Face[] {
    const faces: Face[] = [];
    for (const face of this.faces) {
      if (face.includes(a) && face.includes(b)) {
        faces.push(face);
      }
    }
    return faces;
  }
  getConnectedFaces(f:Face):Face[] {
    return [
      ...this.getFacesUsingEdge(f[0], f[1]),
      ...this.getFacesUsingEdge(f[1], f[2]),
      ...this.getFacesUsingEdge(f[2], f[0]),
    ].filter(face => face !== f);
  }
  getEdgePointOn(p: THREE.Vector3, threshold = 1e-4): number | null {
    for(let i = 0; i < this.edges.length; i++) {
      const edge = this.edges[i];
      const v0 = this.getVertex(edge[0]);
      const v1 = this.getVertex(edge[1]);
      const edgeDir = new THREE.Vector3().subVectors(v1, v0);
      const edgeLengthSq = edgeDir.lengthSq();
      if (edgeLengthSq === 0) continue;
      const toP = new THREE.Vector3().subVectors(p, v0);
      const t = THREE.MathUtils.clamp(toP.dot(edgeDir) / edgeLengthSq, 0, 1);
      const closest = new THREE.Vector3().copy(v0).addScaledVector(edgeDir, t);
      const distSq = closest.distanceToSquared(p);
      if (distSq < threshold * threshold) { return i; }
    }
    return null;
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
      const index = this.getEdgeIndex(i, j);
      this.edges.splice(index, 1);
    };

    removeEdge(a, b);
    removeEdge(b, c);
    removeEdge(c, a);
  }
  getFaceVertexIndices(index: number): Face {
    return this.faces[index];
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