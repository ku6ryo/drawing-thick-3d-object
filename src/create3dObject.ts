import {
  Mesh,
  MeshPhysicalMaterial,
  BufferAttribute,
  BufferGeometry,
  Texture
} from "three"
import { Vector2 } from "./Vector2"

function genMeshesBtwTwoPathes(path1: number[], path2: number[]) {
  if (path1.length !== path2.length) {
    throw new Error("Pathes must have the same length")
  }
  const triangles: number[][] = []
  for (let i = 0; i < path1.length; i++) {
    const p11 = path1[i]
    const p12 = path1[(i + 1) % path1.length]
    const p21 = path2[i]
    const p22 = path2[(i + 1) % path1.length]
    triangles.push([p11, p12, p22])
    triangles.push([p11, p22, p21])
  }
  return triangles
}

/**
 * Calculate the position of a point on an oval.
 * @param a Half of the width of the oval.
 * @param b Half of the height of the oval.
 * @param phase Clockwise from the positive x-axis.
 * @returns 
 */
function calcOval(a: number, b: number, phase: number) {
  return {
    x: a * Math.cos(phase),
    y: b * Math.sin(phase),
  }
}

export function create3dObject (points: Vector2[], triangles: number[][], textureCanvas: HTMLCanvasElement) {
  const texture = new Texture(textureCanvas)
  texture.needsUpdate = true
  const drawingMat = new MeshPhysicalMaterial({ metalness: 0.5, roughness: 0.5, map: texture })
  const edgeMat = new MeshPhysicalMaterial({ metalness: 0.6, roughness: 0.3, color: 0xaaaaaa })
  const numPoints = points.length
  const thickness = 0.05

  const frontPoints = points.map((v) => [v.x, v.y, -thickness / 2])
  const frontIndices = Array.from({ length: numPoints }).map((_, i) => i)
  const frontTris = triangles.map(t => [t[0], t[2], t[1]])
  const backPoints = points.map((v) => [v.x, v.y, thickness / 2])
  const backIndices = Array.from({ length: numPoints }).map((_, i) => i + numPoints)
  const backTris = triangles.map(t => [t[0] + numPoints, t[1] + numPoints, t[2] + numPoints])
  const edgeDivisions = 3
  const edgePoints = [] as number[][][]
  const edgeIndices = [frontIndices] as number[][]
  for (let i = 0; i < edgeDivisions - 1; i++) {
    const simplePoints = points.map((c, j) => {
      const p = j === 0 ? points[points.length - 1] : points[j - 1]
      const n = points[(j + 1) % points.length]
      const vCP = p.sub(c).normalize()
      const vCN = n.sub(c).normalize()
      const sin = vCP.cross(vCN)
      const o = vCP.add(vCN).normalize().multiply(sin / Math.abs(sin))
      const phase = Math.PI / edgeDivisions * (i + 1)
      const { x, y } = calcOval(thickness / 2, thickness / 4, phase)
      const ot = o.multiply(y)
      return [c.x + ot.x, c.y + ot.y, -x]
    })
    const indices = Array.from({ length: numPoints }).map((_, j) => j + numPoints * 2 + i * numPoints)
    edgePoints.push(simplePoints)
    edgeIndices.push(indices)
  }
  edgeIndices.push(backIndices)
  const edgeTris = [] as number[][]
  for (let i = 0; i < edgeDivisions; i++) {
    const triangles = genMeshesBtwTwoPathes(edgeIndices[i], edgeIndices[i + 1])
    edgeTris.push(...triangles)
  }

  const allPoints = frontPoints.concat(backPoints).concat(edgePoints.flat())
  const allIndices = frontTris.concat(backTris).concat(edgeTris)
  const allUvs = [] as number[][]
  for (let i = 0; i < edgeDivisions + 1; i++) {
    allUvs.push(...points.map((v) => [v.x + 0.5, v.y + 0.5]))
  }

  const geometry = new BufferGeometry()
  const vertices = new Float32Array(allPoints.flat())
  const indices = new Uint32Array(allIndices.flat())
  const uvs = new Float32Array(allUvs.flat())
  geometry.setAttribute("position", new BufferAttribute(vertices, 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()

  geometry.addGroup(0, (numPoints - 2) * 3 * 2, 0)
  geometry.addGroup((numPoints - 2) * 3 * 2, numPoints * edgeDivisions * 3 * 2, 1)

  const mesh = new Mesh(geometry, [drawingMat, edgeMat])
  return mesh
}