import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, workspace, window } from 'vscode'

import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'

import { channel, durationToSec, fmtMSS, getOutFile, printToChannel, round, showPrintErrorMsg } from './utils'
import { MediaFileType } from './interfaces'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showInformationMessage } = window
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

export default class Converter {

  static async convert({ fsPath, path }: Uri, type: MediaFileType) {
    channel.show()
    if (!fs.existsSync(pathToFfmpeg!)) {
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
      await this.ffmpegConvert(type, fsPath, oPath)
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

  private static ffmpegConvert(type: string, input: string, output: string) {
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
        let command = ffmpeg(input).format(type)
        if (enableGpu && type === 'mp4') command = command.videoCodec('h264_nvenc') // NVIDIA GPU acceleration
        command = command.save(output)
          .on('codecData', ({ duration }) => totalTime = durationToSec(duration))
          .on('progress', (prog) => {
            const { frames, currentFps: fps, currentKbps: kbps, targetSize: s, timemark } = prog
            const time = durationToSec(timemark)
            const percent = (time / totalTime) * 100
            if (!isNaN(fps) && fps > 0) {
              totalFps += fps
              avgFps = avgFps === 0 ? avgFps + fps : (avgFps + fps) / 2
              count1++
            }

            if (!isNaN(kbps) && kbps > 0) {
              avgKbps = avgKbps === 0 ? avgKbps + kbps : (avgKbps + kbps) / 2
              totalKbps += isNaN(kbps) ? 0 : kbps
              count2++
            }
            if (!totalFps) totalFps = -1
            if (!totalKbps) totalKbps = -1

            // const msg = `${frames}frame|${fps}fps|${kbps}kbps|${s}size|${timemark}timemark`
            // const message = `${frames}|${fps}|${kbps}|${s}|${timemark}`
            // printToChannel(`[ffmpeg] ${msg}`)

            // Calculate time estimation based on current progress and elapsed time
            const elapsedTime = (Date.now() - startTime) / 1000 // in seconds
            const estimatedTotalTime = (elapsedTime * 100) / percent
            const estimatedTimeLeft = Math.max(0, estimatedTotalTime - elapsedTime)

            const hours = Math.floor(estimatedTimeLeft / 3600)
            const minutes = Math.floor((estimatedTimeLeft % 3600) / 60)
            const seconds = Math.floor(estimatedTimeLeft % 60)
            const timeLeftMessage = hours > 0
              ? `${hours}h ${minutes}m ${seconds}s left`
              : minutes > 0
                ? `${minutes}m ${seconds}s left`
                : `${seconds}s left`

            progress.report({
              message: `${round(percent)}% - ${timeLeftMessage}${fps > 0 ? ` (${round(fps)} fps)` : ''}`
            })

            if (token.isCancellationRequested) {
              command.kill('SIGKILL')
              return Promise.reject('User cancelled the operation')
            }
          })
          .on('error', (err) => {
            printToChannel(`[ffmpeg] error: ${err.message}`)
            reject(err)
          })
          .on('end', () => {
            avgFps = avgFps && totalFps ? round((avgFps + totalFps / count1) / 2) : -1
            avgKbps = avgKbps && totalKbps ? round((avgKbps + totalKbps / count2) / 2) : -1
            // console.debug('[ffmpeg] finished')
            printToChannel(`Average fps: ${avgFps}, average kbps: ${avgKbps}`)
            resolve()
          })
      })
    })
  }
}
