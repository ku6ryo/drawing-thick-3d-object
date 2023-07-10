import { Vector2 } from "./Vector2"

declare global {
  interface Window {
    cv: any
  }
}

const cv = window.cv

export type Piece = {
  x: number,
  y: number,
  width: number,
  height: number,
  points: { x: number, y: number }[],
  image: ImageData,
  canvas: HTMLCanvasElement,
}

export class PiecesDetector {
  #contourComplexityThreshold = 20
  #minBoxSize = 50

  detect (image: HTMLImageElement | HTMLCanvasElement) {
    const src = cv.imread(image);
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0)
    cv.threshold(src, src, 0, 255, cv.THRESH_OTSU + cv.THRESH_BINARY)
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(src, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE)

    const pieces: Piece[] = []

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      if (contour.size().height >= this.#contourComplexityThreshold) {
        let minX = Infinity
        let maxX = 0
        let minY = Infinity
        let maxY = 0
        for (let j = 0; j < contour.size().height; j++) {
          const x = contour.data32S[j * 2]
          const y = contour.data32S[j * 2 + 1]
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }

        const x = minX
        const y = minY
        const width = (maxX - minX)
        const height = (maxY - minY)

        if (width > this.#minBoxSize && height > this.#minBoxSize) {
          const tmpCanvas = document.createElement("canvas")
          const tmpContext = tmpCanvas.getContext("2d")!
          tmpCanvas.width = width
          tmpCanvas.height = height
          tmpContext.drawImage(
            image, x, y, width, height,
            0, 0, tmpCanvas.width, tmpCanvas.height
          )
          tmpContext.globalCompositeOperation = "destination-in"
          tmpContext.filter = "blur(3px)"
          tmpContext.beginPath();
          const points = [] as Vector2[]
          for (let j = 0; j < contour.size().height; j++) {
            const px = contour.data32S[j * 2] - x
            const py = contour.data32S[j * 2 + 1] - y
            const point = new Vector2(px, py)
            points.push(point)
            if (j == 0) {
              tmpContext.moveTo(px, py);
            } else {
              tmpContext.lineTo(px, py);
            }
          }
          tmpContext.fillStyle = "red"
          tmpContext.closePath();
          tmpContext.fill();
          // Detect clockwise or counter-clockwise and reverse if needed.
          const direction = points.reduce((sum, c, i) => {
            const n = points[(i + 1) % points.length]
            sum += (n.x - c.x) * (n.y + c.y)
            return sum
          }, 0)
          if (direction > 0) {
            points.reverse()
          }

          pieces.push({
            x,
            y,
            points,
            width,
            height,
            image: tmpContext.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height),
            canvas: tmpCanvas,
          })
        }
      }
    }
    src.delete();
    return pieces
  }
}