<template>
  <div class="main">
    <canvas ref="canvas" />
    <div class="controls">
      <button @click="toggleAudio" class="audio-btn">
        {{ isPlaying ? 'Pause' : 'Play' }} Music
      </button>

      <button @click="toggleRings" class="audio-btn ml-10">
        {{ showRings ? 'Hide' : 'Show' }} rings
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const canvas = ref<HTMLCanvasElement | null>(null)
const isPlaying = ref(false)
let audio: HTMLAudioElement
let audioContext: AudioContext

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let clock: THREE.Clock
let analyser: AnalyserNode
let dataArray: Uint8Array
let controls: OrbitControls

let skyboxGeo: THREE.BoxGeometry
let skybox: THREE.Mesh

// Ring animation variables
const ringPoolLeft: ReturnType<typeof createPulseRing>[] = []
const ringPoolRight: ReturnType<typeof createPulseRing>[] = []

let speakerLeftPos = new THREE.Vector3(-0.45, 0, 0)
let speakerRightPos = new THREE.Vector3(0.45, 0, 0)
// let headPos = new THREE.Vector3(0, 0, 0)

let numPoints = 10;


// State
let showRings = true

onMounted(() => {
  initScene()
  setupAudio()
  animate()
})

function initScene() {
  scene = new THREE.Scene()
  clock = new THREE.Clock()

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 30000)
  camera.position.set(0, 0.4, 1)

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.rotateSpeed = 0.5

  // const ambient = new THREE.AmbientLight(0xffffff, 0.5)
  // const point = new THREE.PointLight(0xffffff, 100)
  // point.position.set(0, 5, 5)
  // scene.add(ambient, point)

  const loader = new GLTFLoader()

  function createPathStrings(filename: string) {
    const basePath = "";
    const baseFilename = basePath + filename;
    const fileType = ".png";
    const sides = ["ft", "bk", "up", "dn", "rt", "lf"];
    const pathStings = sides.map(side => {
      return baseFilename + "_" + side + fileType;
    });

    return pathStings;
  }


  let skyboxImage = "corona";
  function createMaterialArray(filename: string) {
    const skyboxImagepaths = createPathStrings(filename);

    const materialArray = skyboxImagepaths.map(image => {
      let texture = new THREE.TextureLoader().load(image);


      return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }); // <---
    });
    return materialArray;
  }

  skyboxGeo = new THREE.BoxGeometry(10000, 10000, 10000)
  skybox = new THREE.Mesh(skyboxGeo)


  loader.load('/model.glb', (gltf) => {
    const model = gltf.scene
    scene.add(model)
    const hdrLoader = new RGBELoader()
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    hdrLoader.load('/bloem_train_track_clear_1k.hdr', function (texture) {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      scene.environment = envMap
      scene.environmentRotation = new THREE.Euler(0, 10, 45)
    })


    const materialArray = createMaterialArray(skyboxImage);
    skyboxGeo = new THREE.BoxGeometry(1000, 1000, 1000);
    skybox = new THREE.Mesh(skyboxGeo, materialArray);
    scene.add(skybox);

    if (showRings) {
      ringPoolLeft.length = 0
      ringPoolRight.length = 0

      for (let i = 0; i < numPoints; i++) {
        const newRing = createPulseRing(speakerLeftPos.x)
        ringPoolLeft.push(newRing);
        scene.add(newRing)
      }

      for (let i = 0; i < numPoints; i++) {
        const newRing = createPulseRing(speakerRightPos.x)
        ringPoolRight.push(newRing);
        scene.add(newRing)
      }
    }
  })
}

function createPulseRing(xPos: number) {
  const geometry = new THREE.TorusGeometry(0.1, 0.01, 32, 128);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ffff, opacity: 0 });

  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.y = Math.PI / 2
  ring.position.set(xPos, ring.position.y, ring.position.z)

  ring.userData = {
    baseScale: 1,
    speed: 0.01,
    scale: 1,
    indexOffset: Math.floor(Math.random() * 20)
  };

  return ring;
}


function setupAudio() {
  audio = new Audio('/audio.m4a')
  audio.loop = true
  audio.crossOrigin = 'anonymous'
  audio.load()

  audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const src = audioContext.createMediaElementSource(audio)

  analyser = audioContext.createAnalyser()
  analyser.fftSize = 128

  src.connect(analyser)
  analyser.connect(audioContext.destination)

  dataArray = new Uint8Array(analyser.frequencyBinCount)

}

function toggleAudio() {
  if (!audio) return
  if (!isPlaying.value) {
    audioContext.resume()
    audio.play().catch(console.warn)
  } else {
    audio.pause()
  }
  isPlaying.value = !isPlaying.value
}

function toggleRings() {
  showRings = !showRings
  initScene()
}

function animate() {
  requestAnimationFrame(animate)
  clock.getElapsedTime()

  if (analyser) {
    analyser.getByteFrequencyData(dataArray)

    if (showRings) {
      // const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      const trebleBins = dataArray.slice(16);
      const avgTreble = trebleBins.reduce((a, b) => a + b, 0) / trebleBins.length;
      // const intensity = avg / 255
      ringPoolLeft.forEach((ring, i) => {


        // Normalize and amplify for better visual
        const scale = (((avgTreble / 255) * 1.5 + 0.5) * i) / 10;
        // const index = (i * 5 + ring.userData.indexOffset) % dataArray.length;
        // const value = dataArray[index] / 256; // normalize 0–1
        // const scale = (i + intensity * 5 * i) / 50; // pulse size
        ring.scale.set(scale, scale, scale);

        ring.position.x = speakerLeftPos.x + 0.05 + (scale / 20) + i / 40; // move left with size
        ring.material.opacity = 0.3 + avgTreble * 0.7;
      });

      ringPoolRight.forEach((ring, i) => {


        // Normalize and amplify for better visual
        const scale = (((avgTreble / 255) * 1.5 + 0.5) * i) / 10;
        // const index = (i * 5 + ring.userData.indexOffset) % dataArray.length;
        // const value = dataArray[index] / 256; // normalize 0–1
        // const scale = (i + intensity * 5 * i) / 50; // pulse size
        ring.scale.set(scale, scale, scale);

        ring.position.x = speakerRightPos.x - 0.05 - (scale / 20) - i / 40; // move left with size
        ring.material.opacity = 0.3 + avgTreble * 0.7;
      });
    }


  }
  controls.update()
  renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
</script>

<style scoped>
.main {
  position: relative;
}

canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  background: black;
}

.audio-btn {
  padding: 10px 20px;
  background: #00ffff;
  border: none;
  color: black;
  font-weight: bold;
  cursor: pointer;
  border-radius: 5px;
}

.controls {
  position: fixed;
  bottom: 0;
  left: 50%;
}
</style>
