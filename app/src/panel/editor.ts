import * as THREE from 'three';
import { Viewport } from './viewport';
import { Inspector } from './inspect';
import { Hierarchy } from './hierarchy';
import { Modeling } from './modeling';
import { Tool } from './tool';
import { Keybinds } from './keybinds';
import { Mode } from './mode';
import { fixTransformControls } from './util';
import { Helper } from './helper';
import { Material } from './material';
import { AssetManager } from './asset';
import { TimelineManager } from './timeline';

export const Editor = {
  init(container: HTMLDivElement) {
    Viewport.init(container);
    Modeling.init(container);
    Material.init(container);
    Tool.init();
    Keybinds.init();

    AssetManager.init();
    AssetManager.render();

    TimelineManager.init();
    
    this.setupPicking();
    this.setupTransformSync();
  },

  setupPicking() {
    Viewport.enablePicking(obj => {
      obj ? this.select(obj) : this.drop();
    });
  },

  setupTransformSync() {
    const dom = Viewport.renderer.domElement;
    const tf = Viewport.transform;

    tf.addEventListener("mouseDown", () => {
      dom.addEventListener("pointermove", this.updateBox);
      Viewport.orbit.enabled = false;
    });

    tf.addEventListener("mouseUp", () => {
      dom.removeEventListener("pointermove", this.updateBox);
      Viewport.orbit.enabled = true;
    });

    fixTransformControls(tf);
  },

  updateBox() {
    Inspector.refresh();
    Helper.updateAll();
    if (Viewport.transform.object) {
      Viewport.boundingBoxOutline.setFromObject(Viewport.transform.object);
      Viewport.boundingBoxOutline.update();
    }
  },

  select(object: THREE.Object3D) {
    Viewport.select(object);
    Modeling.select(object);
    Inspector.inspect(object);
  },

  drop() {
    if (Mode.current !== "layout" && Mode.current !== "animation") return;
    Viewport.drop();
    Modeling.drop();
    Inspector.clear();
  },

  delete() {
    const obj = Viewport.transform.object;
    if (!obj) return;
    Viewport.removeObject(obj);
    this.drop();
    Hierarchy.render(Viewport.scene);
  },

  addObject(obj: THREE.Object3D) {
    Viewport.addObject(obj);
    Hierarchy.render(Viewport.scene);
  },

  get scene() { return Viewport.scene; },
  get selected(): THREE.Object3D | null { return Viewport.selected; },
  clock: new THREE.Clock()
};