import { create3dObject } from "./create3dObject"
import { PiecesDetector, Piece } from "./PiecesDetector"
import { triangulate } from "./triangulate"
import { Vector2 } from "./Vector2"
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  Group,
} from "three"
import styles from "./style.module.scss"

const inputImage = document.createElement("img")
inputImage.className = styles.inputImage
document.body.appendChild(inputImage)

const textureCanvas = document.createElement("canvas")
document.body.appendChild(textureCanvas)

const threeCanvas = document.createElement("canvas")
threeCanvas.width = 512
threeCanvas.height = 512
document.body.appendChild(threeCanvas)

const fileInput = document.createElement("input")
fileInput.type = "file"
fileInput.onchange = (e) => {
  const file = (<HTMLInputElement>e.target).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const img = new Image()
      img.onload = async () => {
        container.children.forEach(c => container.remove(c))
        processImage(img)
        inputImage.src = img.src
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}
document.body.appendChild(fileInput)

const scene = new Scene()
const camera = new PerspectiveCamera(45, threeCanvas.width / threeCanvas.height, 0.1, 1000)
camera.position.set(0, 1, 1)
camera.lookAt(scene.position)

const renderer = new WebGLRenderer({ antialias: true, canvas: threeCanvas })
renderer.setClearColor(0xffffff, 1.0)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(threeCanvas.width, threeCanvas.height)

const numLights = 3
for (let i = 0; i < numLights; i++) {
  const light = new DirectionalLight(0xffffff)
  const phase = Math.PI * 2 / numLights * i
  light.position.set(Math.cos(phase) * 10, Math.sin(phase) * 10, 10)
  light.intensity = 0.5
  light.lookAt(scene.position)
  scene.add(light)
}

const container = new Group()
scene.add(container)

renderer.setAnimationLoop(() => {
  container.rotateY(0.01)
  renderer.render(scene, camera)
})

function processImage(img: HTMLImageElement) {
  const detector = new PiecesDetector()
  const pieces = detector.detect(img)
  const { maxAreaPiece } = pieces.reduce((prev, p) => {
    if (Math.abs(p.x - img.width / 2) > 0.95 * img.width / 2) {
      return prev
    }
    if (Math.abs(p.y - img.height / 2) > 0.95 * img.width / 2) {
      return prev
    }
    const area = p.width * p.height
    if (area > prev.maxArea) {
      return {
        maxAreaPiece: p,
        maxArea: area,
      }
    } else {
      return prev
    }
  }, { maxAreaPiece: null as null | Piece, maxArea: 0 })
  if (!maxAreaPiece) {
    throw new Error("No piece found")
  }
  const pieceCanvas = maxAreaPiece.canvas
  textureCanvas.width = 512
  textureCanvas.height = 512
  const ctx = textureCanvas.getContext('2d')!
  ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height)
  const margin = 0.0
  const scalingFactorByMargin = 1 - margin * 2
  const scalingFactor = (() => {
    if (pieceCanvas.width > pieceCanvas.height) {
      return textureCanvas.width / pieceCanvas.width * scalingFactorByMargin
    } else {
      return textureCanvas.height / pieceCanvas.height * scalingFactorByMargin
    }
  })()
  const w = pieceCanvas.width * scalingFactor
  const h = pieceCanvas.height * scalingFactor
  ctx.drawImage(pieceCanvas, (textureCanvas.width - w) / 2, (textureCanvas.height - h) / 2, w, h)
  const originalPoints = maxAreaPiece.points
  const filteredPoints = originalPoints.filter((_, i) => i % 32 === 0)

  const normalizingFactor = 1 / Math.max(maxAreaPiece.width, maxAreaPiece.height)
  const normalizedPoints = filteredPoints.map((p) => {
    return new Vector2(
      (p.x - maxAreaPiece.width / 2) * normalizingFactor,
      - (p.y - maxAreaPiece.height / 2) * normalizingFactor,
    )
  }).reverse()

  console.log("original points:", originalPoints.length)
  console.log("filtered:", filteredPoints)
  console.log("normalized:", normalizedPoints)
  console.log("width:", maxAreaPiece.width)
  console.log("height:", maxAreaPiece.height)
  const { triangles } = triangulate(normalizedPoints)
  const mesh = create3dObject(normalizedPoints, triangles, textureCanvas)
  container.add(mesh)
}
