import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, window, workspace } from 'vscode'
import { spawn } from 'child_process'
import * as fs from 'fs'
import pb from 'pretty-bytes'

import { channel, fmtMSS, getOutFile, printToChannel, showPrintErrorMsg } from './utils'
import { MediaFileType } from './interfaces'

const { showInformationMessage } = window
// Due to output format *** is not available
// https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1282
export default class ConverterImg {

  static async convert(pathToFfmpeg: string, { fsPath, path }: Uri, type: MediaFileType) {
    channel.show()
    try {
      const inputSize = fs.statSync(fsPath).size
      printToChannel(`File input: ${fsPath} - size: ${pb(inputSize)}`)
      const fileName = path.split('/').pop()
      const name = fileName!.substring(0, fileName!.lastIndexOf('.'))
      const dir = fsPath.replace(fileName!, '')
      const { outFile: oPath, fileName: oFName } = getOutFile(dir, name!, type)

      const t0 = perf.now()
      await this.ffmpegConvert(pathToFfmpeg, fsPath, oPath)
      const t1 = perf.now()
      const ms = Math.round(t1 - t0)

      const msg = `${fileName} => ${oFName} completed!`
      printToChannel(`${msg}\nTotal time: ${fmtMSS(ms)}`)
      const size = fs.statSync(oPath).size
      printToChannel(`File output: ${oPath} - size: ${pb(size)}\n`)
      showInformationMessage(msg)
    } catch (error: any) {
      if (error.message === 'ffmpeg was killed with signal SIGKILL') {
        showInformationMessage('Conversion was canceled')
        printToChannel('Conversion was canceled')
        return
      }
      showPrintErrorMsg(error)
    }
  }

  private static ffmpegConvert(pathToFfmpeg: string, input: string, output: string) {
    return window.withProgress({
      location: ProgressLocation.Window,
      title: 'Converting',
      cancellable: false
      // There is no progress
    }, () => {
      return new Promise<void>((resolve, reject) => {
        const config = workspace.getConfiguration('emc')
        const useCustomQuality = config.get('useCustomQuality', false)
        const videoQuality = config.get('videoQuality', 23)

        // JPEG quality: convert CRF (0-51) to JPEG quality (2-31), inverted scale
        // CRF 0 (best) -> q:v 2 (best), CRF 51 (worst) -> q:v 31 (worst)
        const jpegQuality = Math.round((videoQuality / 51) * 29 + 2)

        // Log settings
        printToChannel(
          `Settings: CustomQuality=${useCustomQuality}, ` +
          `JPEGQuality=${jpegQuality} (from CRF ${videoQuality})`
        )

        const args = ['-i', input]
        if (useCustomQuality) args.push('-q:v', jpegQuality.toString())
        args.push('-f', 'image2', '-y', output)

        // Log the full ffmpeg command for debugging
        printToChannel(`Executing: ${pathToFfmpeg} ${args.join(' ')}`)

        const ffmpegProcess = spawn(pathToFfmpeg, args)
        let stderrOutput = ''

        ffmpegProcess.stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString()
        })

        ffmpegProcess.on('close', (code) => {
          if (code === 0) resolve()
          else {
            printToChannel(`[ffmpeg] error: Process exited with code ${code}`)
            printToChannel(stderrOutput)
            reject(new Error(`ffmpeg exited with code ${code}`))
          }
        })

        ffmpegProcess.on('error', (err) => {
          printToChannel(`[ffmpeg] error: ${err.message}`)
          reject(err)
        })
      })
    })
  }
}
