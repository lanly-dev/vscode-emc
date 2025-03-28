import { vectorize, ColorMode, Hierarchical, PathSimplifyMode } from '@neplex/vectorizer';
import { readFile, writeFile } from 'node:fs/promises'
// import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, window } from 'vscode'

import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'

import { channel, durationToSec, fmtMSS, getOutFile, printToChannel, round, showPrintErrorMsg } from './utils'
import { MediaFileType } from './interfaces'

export default class ConverterImgSvg {

  static async convert({ fsPath, path }: Uri) {
    try {
      const inputSize = fs.statSync(fsPath).size
      printToChannel(`File input: ${fsPath} - size: ${pb(inputSize)}`)
      const fileName = path.split('/').pop()
      const name = fileName?.split('.')[0]
      const dir = fsPath.replace(fileName!, '')
      const { outFile: oPath, fileName: oFName } = getOutFile(dir, name!, MediaFileType.SVG)

      const src = await readFile(fsPath)
      console.debug(src, fsPath)
      const svg = await vectorize(src, {
        colorMode: ColorMode.Color,
        colorPrecision: 6,
        filterSpeckle: 4,
        spliceThreshold: 45,
        cornerThreshold: 60,
        hierarchical: Hierarchical.Stacked,
        mode: PathSimplifyMode.Spline,
        layerDifference: 5,
        lengthThreshold: 5,
        maxIterations: 2,
        pathPrecision: 5,
      })

      console.debug(svg)
      console.debug(oPath)
      await writeFile(oPath, svg)
    } catch (error: any) {
      console.debug(error)
    }
  }
}