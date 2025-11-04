import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, workspace, window } from 'vscode'
import { spawn } from 'child_process'
import * as fs from 'fs'
import pb from 'pretty-bytes'

import {
  channel, durationToSec, fmtMSS, fmtTimeLeft,
  getOutFile, printToChannel, round, showPrintErrorMsg
} from './utils'
import { MediaFileType } from './interfaces'

const { showInformationMessage } = window
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

export default class Converter {

  static async convert(pathToFfmpeg: string, { fsPath, path }: Uri, type: MediaFileType) {
    channel.show()
    if (!fs.existsSync(pathToFfmpeg)) {
      const abortMsg = 'Converting action aborted'
      showInformationMessage(MSG)
      showInformationMessage(abortMsg)
      printToChannel(MSG)
      printToChannel(abortMsg)
      return
    }
    try {
      const inputSize = fs.statSync(fsPath).size
      printToChannel(`File input: ${fsPath} - size: ${pb(inputSize)}`)
      const fileName = path.split('/').pop()
      const name = fileName!.substring(0, fileName!.lastIndexOf('.'))
      const dir = fsPath.replace(fileName!, '')
      const { outFile: oPath, fileName: oFName } = getOutFile(dir, name!, type)

      const t0 = perf.now()
      await this.ffmpegConvert(pathToFfmpeg, type, fsPath, oPath)
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

  private static ffmpegConvert(pathToFfmpeg: string, type: string, input: string, output: string) {
    return window.withProgress({
      location: ProgressLocation.Window,
      title: 'Converting',
      cancellable: true
    }, (progress, token) => {
      return new Promise<void>((resolve, reject) => {
        let avgFps = 0
        let avgKbps = 0
        let totalFps = 0
        let totalKbps = 0
        let count1 = 0
        let count2 = 0
        let totalTime = 0
        let startTime = Date.now()

        const enableGpu = workspace.getConfiguration('emc').get('enableGpuAcceleration', false)

        // Build ffmpeg arguments
        const args = ['-i', input, '-f', type]
        if (enableGpu && type === 'mp4') args.push('-c:v', 'h264_nvenc')
        args.push('-progress', 'pipe:1', '-y', output)

        const ffmpegProcess = spawn(pathToFfmpeg, args)
        let stderrOutput = ''

        ffmpegProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          const lines = output.split('\n')

          for (const line of lines) {
            if (line.startsWith('out_time_ms=')) {
              const timeMs = parseInt(line.split('=')[1])
              if (!isNaN(timeMs) && totalTime > 0) {
                const timeSec = timeMs / 1000000
                const percent = (timeSec / totalTime) * 100

                const elapsedTime = (Date.now() - startTime) / 1000
                const estimatedTotalTime = (elapsedTime * 100) / percent
                const estimatedTimeLeft = Math.max(0, estimatedTotalTime - elapsedTime)
                const timeLeftMessage = fmtTimeLeft(estimatedTimeLeft)

                progress.report({
                  message: `${round(percent)}% - ${timeLeftMessage}`
                })
              }
            } else if (line.startsWith('fps=')) {
              const fps = parseFloat(line.split('=')[1])
              if (!isNaN(fps) && fps > 0) {
                totalFps += fps
                avgFps = avgFps === 0 ? avgFps + fps : (avgFps + fps) / 2
                count1++
              }
            } else if (line.startsWith('bitrate=')) {
              const bitrateStr = line.split('=')[1]
              const kbps = parseFloat(bitrateStr)
              if (!isNaN(kbps) && kbps > 0) {
                avgKbps = avgKbps === 0 ? avgKbps + kbps : (avgKbps + kbps) / 2
                totalKbps += kbps
                count2++
              }
            }
          }
        })

        ffmpegProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString()
          stderrOutput += text

          // Parse duration from stderr
          if (totalTime === 0) {
            const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
            if (durationMatch) {
              const hours = parseInt(durationMatch[1])
              const minutes = parseInt(durationMatch[2])
              const seconds = parseFloat(durationMatch[3])
              totalTime = hours * 3600 + minutes * 60 + seconds
            }
          }
        })

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            avgFps = avgFps && totalFps && count1 > 0 ? round((avgFps + totalFps / count1) / 2) : -1
            avgKbps = avgKbps && totalKbps && count2 > 0 ? round((avgKbps + totalKbps / count2) / 2) : -1
            printToChannel(`Average fps: ${avgFps}, average kbps: ${avgKbps}`)
            resolve()
          } else {
            printToChannel(`[ffmpeg] error: Process exited with code ${code}`)
            printToChannel(stderrOutput)
            reject(new Error(`ffmpeg exited with code ${code}`))
          }
        })

        ffmpegProcess.on('error', (err) => {
          printToChannel(`[ffmpeg] error: ${err.message}`)
          reject(err)
        })

        token.onCancellationRequested(() => {
          ffmpegProcess.kill('SIGKILL')
          reject(new Error('ffmpeg was killed with signal SIGKILL'))
        })
      })
    })
  }
}
