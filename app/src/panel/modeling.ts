import * as Vertex from './modeling/vertex';
import * as Face from './modeling/face';
import * as Edge from './modeling/edge';
import { fixTransformControls, getButtons } from './util';
import { Viewport } from './viewport';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import * as THREE from 'three';
import { Mode } from './mode';
import { ModelingTool } from './modeling/tools';
import { Notification } from './notif';
import * as CREATE from '../component/create';

let transform!: TransformControls;
let currentMode: 'vertex' | 'edge' | 'face' = 'vertex';
let modelModes!:Function[];
let modelTools!:Function[];
let modelControls!:Function[];
let selected:THREE.Mesh|null;
let tool:ModelingTool = Vertex.tool;

function initOptions() {
  const panel = document.getElementById("modeling-option")!;
  const section = (title:string) => {
    const el = document.createElement("div");
    el.className = "section";
    el.innerText = title;
    return el;
  };
  [
    section("Control"),
    CREATE.slider("Snap", 0, 0, 1, 0.125, (val) => { transform.translationSnap = val }),
    CREATE.toggle("Along Face Normal", true, (val) => {}),
    section("Extrude"),
    CREATE.number("Displacement", 0.1, 0, (val) => { Modeling.options.extrude.displacement = val }),
    CREATE.toggle("Along Normal", true, (val) => {}),
    CREATE.toggle("Keep Face Together", true, (val) => {}),
    section("Inset"),
    CREATE.number("Displacement", 0.1, 0, (val) => {}),
    CREATE.toggle("Remove Original", true, (val) => {}),
    CREATE.toggle("Use Region", true, (val) => {}),
    CREATE.toggle("Boundary Only", true, (val) => {}),
    section("Bevel"),
    CREATE.number("Widths", 0.1, 0, (val) => { Modeling.options.bevel.width = val }),
    CREATE.number("Segments", 7, 1, (val) => { Modeling.options.bevel.segments = val }),
    CREATE.number("Profile", 0.5, 0, (val) => { Modeling.options.bevel.profile = val }),
    CREATE.toggle("Clamp Overlap", true, (val) => {}),
    CREATE.dropdown("Method", ["Offset", "Width"], "Offset", (val) => {}),
    section("Knife"),
    CREATE.toggle("Show Cut Plane", false, (val) => {}),
    CREATE.toggle("Cut Through", true, (val) => {}),
    section("Merge"),
    CREATE.dropdown("Mode", ["Center", "Fisrt", "Last", "Collapse"], "Center", (val) => {}),
  ].forEach(e => {
    panel.appendChild(e);
  });
}
export const Modeling = {
  vertexPositions: [] as THREE.Vector3[],
  dummy: new THREE.Object3D(),
  control: {
    inwardScaling: false
  },
  options: {
    extrude: {
      displacement: 0.1
    },
    bevel: {
      segments: 7,
      profile: 0.5,
      width: 0.1
    }
  },
  init(container: HTMLElement) {
    transform = new TransformControls(Viewport.camera, Viewport.renderer.domElement);
    initOptions();
    fixTransformControls(transform);
    document.addEventListener("modechange", () => {
      if(Mode.current === "modeling") {
        Viewport.devScene.add(transform.getHelper());
        transform.enabled = true;
        this.setMode(currentMode);
      }
      else {
        Viewport.devScene.remove(transform.getHelper());
        transform.enabled = false;
        Vertex.enable(false);
        Face.enable(false);
        Edge.enable(false);
      }
    });
    this.transform = transform;

    Vertex.init(this.dummy, transform, container);
    Face.init(this.dummy, transform, container); // TODO
    Edge.init(this.dummy, transform, container);

    Viewport.addDev(this.dummy);

    modelModes = getButtons(".model-mode button", [
      () => vertex(),
      () => edge(),
      () => face(),
    ]);

    modelTools = getButtons(".model-tool button", [
      () => extrude(),
      () => inset(),
      () => bevel(),
      () => knife(),
      () => merge(),
    ]);
    modelControls = getButtons(".model-control button", [
      () => inwardScaling()
    ]);
  },

  transform,

  setMode(mode: 'vertex' | 'edge' | 'face') {
    currentMode = mode;
    transform.detach();
    switch (currentMode) {
      case 'vertex': Vertex.enable(true); Edge.enable(false); Face.enable(false); tool = Vertex.tool; break;
      case 'edge': Vertex.enable(false); Edge.enable(true); Face.enable(false); tool = Edge.tool; break;
      case 'face': Vertex.enable(false); Edge.enable(false); Face.enable(true); tool = Face.tool; break;
    }
    const select = selected;
    this.drop();
    if(select) this.select(select);
  },

  select(obj: THREE.Object3D) {
    if(!(obj instanceof THREE.Mesh)) return;
    if(obj !== selected) this.drop();
    selected = obj;
    switch (currentMode) {
      case 'vertex': Vertex.select(obj); break;
      case 'edge': Edge.select(obj); break;
      case 'face': Face.select(obj); break;
    }
  },

  drop() {
    selected = null;
    Vertex.drop();
    Face.drop();
    Edge.drop();
  },

  // === Tool shortcuts (for Keybinds) ===
  vertex() { modelModes[0]() },
  edge() { modelModes[1]() },
  face() { modelModes[2]() },

  extrude() { modelTools[0]() },
  inset() { modelTools[1]() },
  bevel() { modelTools[2]() },
  knife() { modelTools[3]() },
  merge() { modelTools[4]() },

  inwardScaling() { modelControls[0]() },
};

function vertex() { Modeling.setMode('vertex'); }
function edge() { Modeling.setMode('edge'); }
function face() { Modeling.setMode('face'); }

function invoke(func?:Function) {
  if(!func) return Notification.warn("Unsupported use of tool", "The tool you are using is not compatible with this mode");
  func();
}
function extrude() { if(tool) invoke(tool.extrude) }
function inset() { if(tool) invoke(tool.inset) }
function bevel() { if(tool) invoke(tool.bevel) }
function knife() { if(tool) invoke(tool.knife) }
function merge() { if(tool) invoke(tool.merge) }
function inwardScaling() { 
  Modeling.control.inwardScaling = !Modeling.control.inwardScaling;
  if(Modeling.control.inwardScaling) {
    transform.showX = false;
    transform.showZ = false;
  } else {
    transform.showX = true;
    transform.showZ = true;
  }
}