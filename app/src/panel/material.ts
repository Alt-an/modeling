import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mode } from './mode';
import { Viewport } from './viewport';
import { OBJLoader } from 'three/examples/jsm/Addons.js';
import * as CREATE from '../component/create';

let container: HTMLElement = document.body;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(95, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
let ball = new THREE.Object3D();
let material = new THREE.MeshPhysicalMaterial();

const orbit = new OrbitControls(camera, renderer.domElement);

function setupRenderer() {
  renderer.setClearColor("#132324");
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);
}

function setupCamera() {
  camera.position.set(0, 3, 10);
  camera.updateProjectionMatrix();
}

function setupControls() {
  orbit.connect(renderer.domElement);
  orbit.update();
  orbit.panSpeed = 0;
}

function setupScene() {
  const light1 = new THREE.DirectionalLight();
  light1.position.set(2, 1, 0.5);
  light1.intensity = 3.2;
  scene.add(light1);
  const light2 = new THREE.DirectionalLight();
  light2.position.set(-1, -0.5, -2);
  light2.intensity = 2.2;
  scene.add(light2);
  const ambient = new THREE.AmbientLight();
  ambient.intensity = 0.2;
  scene.add(ambient);
  new OBJLoader().load(
    "assets/shader-ball.obj",
    (obj) => {
      if(!obj) return console.error("Shader ball load is null or undefined")
      scene.add(obj);
      obj.position.y = 2;
      const s = 0.05;
      obj.scale.set(s, s, s);
      ball = obj;
      change(material);
    },
    () => {},
    (err) => { console.error("Shader ball load failed: "+err) }
  );
}

function onResize() {
  const bounds = container.getBoundingClientRect();
  camera.aspect = bounds.width / bounds.height;
  camera.updateProjectionMatrix();
  renderer.setSize(bounds.width, bounds.height);
  renderer.setPixelRatio(window.devicePixelRatio);
}

function startRenderLoop() {
  function render() {
    if(!enabled) return;
    requestAnimationFrame(render);
    renderer.clear();
    renderer.render(scene, camera);
  }
  render();
}

function updateOptions() {
  const panel = document.getElementById("material")!;
  panel.innerHTML = `
  <div class="header">Material</div>
  <div class="break"></div>
  `;
  const section = (title:string) => {
    const el = document.createElement("div");
    el.className = "section";
    el.innerText = title;
    return el;
  };
  [
    CREATE.input("Color", "#ffffff", (val) => { try { material.color = new THREE.Color(val) } catch (e) { material.color = new THREE.Color("#ffffff") } }),
    CREATE.input("Emissive", "#ffffff", (val) => { try { material.emissive = new THREE.Color(val) } catch (e) { material.emissive = new THREE.Color("#ffffff") } }),
    CREATE.slider("Emissive Intensity", 0, 0, 1, 0.01, (val) => { material.emissiveIntensity = val}),
    CREATE.slider("Roughness", 0, 0, 1, 0.01, (val) => { material.roughness = val }),
    CREATE.slider("Metalness", 0, 0, 1, 0.01, (val) => { material.metalness = val }),
    CREATE.slider("Bump Scale", 0, 0, 1, 0.01, (val) => { material.bumpScale = val }),
    CREATE.slider("Displacement Scale", 0, 0, 1, 0.01, (val) => { material.displacementScale = val }),
    CREATE.slider("Displacement Bias", 0, 0, 1, 0.01, (val) => { material.displacementBias = val }),
    CREATE.toggle("Transparent", false, (val) => { material.transparent = val }),
    CREATE.slider("Opacity", 1, 0, 1, 0.01, (val) => { material.opacity = val }),
    CREATE.toggle("Depth Write", false, (val) => { material.depthWrite = val }),
    CREATE.toggle("Depth Write", false, (val) => { material.depthTest = val }),
  ].forEach(e => {
    panel.appendChild(e);
  });
}

let enabled = false;
export const Material = {
  frame: 0,
  set enabled(value:boolean) {
    if(enabled === value) return;
    enabled = value;
    if(enabled) {
      startRenderLoop();
      renderer.domElement.style.display = "";
    } else {
      renderer.domElement.style.display = "none";
    }
  },
  init(containerElement: HTMLElement) {
    container = containerElement;
    setupRenderer();
    setupCamera();
    setupControls();
    setupScene();
    onResize();

    window.addEventListener("resize", onResize);
    document.addEventListener("modechange", () => {
      if(Mode.current === "material") {
        Viewport.enabled = false;
        this.enabled = true;
      }
      else {
        this.enabled = false;
        Viewport.enabled = true;
      }
    });
  },
};
function change(material:THREE.Material) {
  ball.traverse(obj => {
    if("material" in obj) {
      obj.material = material;
    }
  });
  updateOptions();
}