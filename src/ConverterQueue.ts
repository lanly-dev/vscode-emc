import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, workspace, window } from 'vscode'
import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import * as path from 'path'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'
import { channel, durationToSec, fmtMSS, getWorkspacePath, printToChannel, round, showPrintErrorMsg } from './utils'
import { MediaFileType, ConversionResult, ConversionProgress, CodecData } from './interfaces'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showInformationMessage } = window
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

export default class ConverterQueue {
  private static readonly MAX_CONCURRENT = 3
  private static isProcessing = false

  static async convert(files: Uri[], type: MediaFileType): Promise<void> {
    channel.show()
    if (this.isProcessing) {
      // Need to do context
      showInformationMessage('A batch conversion is already in progress')
      return
    }

    if (!fs.existsSync(pathToFfmpeg!)) {
      const abortMsg = 'Converting action aborted'
      showInformationMessage(MSG)
      showInformationMessage(abortMsg)
      printToChannel(MSG)
      printToChannel(abortMsg)
      return
    }

    this.isProcessing = true
    const total = files.length
    let completed = 0
    const outputDir = getWorkspacePath()
    if (!outputDir) {
      showInformationMessage('No workspace folder found. Please open a workspace folder to save the converted files.')
      this.isProcessing = false
      return
    }

    const conversions: ConversionResult[] = []
    try {
      await window.withProgress({
        location: ProgressLocation.Notification,
        title: 'Batch Converting',
        cancellable: true
      }, async (progress, token) => {
        for (let i = 0; i < files.length; i += this.MAX_CONCURRENT) {
          if (token.isCancellationRequested) {
            showInformationMessage('Batch conversion canceled')
            return
          }
          let p: Promise<void>[] = []
          const subBatch = files.slice(i, i + this.MAX_CONCURRENT)
          for (const file of subBatch) {
            try {
              const inputSize = fs.statSync(file.fsPath).size
              printToChannel(`Processing file ${++completed}/${total}: ${file.fsPath} - size: ${pb(inputSize)}`)

              const fileName = file.path.split('/').pop()
              const name = fileName?.split('.')[0]
              const oPath = path.join(outputDir, `${name}.${type}`)
              const oFName = path.basename(oPath)

              const t0 = perf.now()
              p.push(this.convertFile(type, file.fsPath, oPath, progress, token, completed, total))

              const t1 = perf.now()
              const ms = Math.round(t1 - t0)
              const msg = `${fileName} => ${oFName} completed!`
              printToChannel(`${msg}\nTotal time: ${fmtMSS(ms)}`)
              const outputSize = fs.statSync(oPath).size
              printToChannel(`File output: ${oPath} - size: ${pb(outputSize)}\n`)

              conversions.push({
                input: file.fsPath,
                output: oPath,
                time: ms,
                inputSize,
                outputSize
              })

            } catch (error: any) {
              if (error.message === 'ffmpeg was killed with signal SIGKILL') printToChannel('Conversion was canceled')
              else showPrintErrorMsg(error)
            }
          }
          await Promise.all(p)
        }
      })
      this.writeSummary(conversions, outputDir)

      showInformationMessage(`Batch conversion completed: ${completed}/${total} files. Output directory: ${outputDir}`)
    } catch (error) {
      printToChannel(`Batch conversion failed: ${error}`)
      showInformationMessage('Batch conversion failed. Check the output panel for details.')
    } finally {
      this.isProcessing = false
    }
  }

  private static convertFile(
    type: string,
    input: string,
    output: string,
    progress: any,
    token: any,
    current: number,
    total: number
  ): Promise<void> {
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
      if (enableGpu && type === 'mp4') command = command.videoCodec('h264_nvenc')

      command = command.save(output)
        .on('codecData', ({ duration }: CodecData) => totalTime = durationToSec(duration))
        .on('progress', (prog: ConversionProgress) => {
          const { currentFps: fps, currentKbps: kbps, timemark } = prog
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

          // Calculate time estimation
          const elapsedTime = (Date.now() - startTime) / 1000
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
            message: `File ${current}/${total}: ${round(percent)}% - ${timeLeftMessage}${fps > 0 ? ` (${round(fps)} fps)` : ''}`
          })

          if (token.isCancellationRequested) {
            command.kill('SIGKILL')
            return resolve()
          }
        })
        .on('error', (err) => {
          printToChannel(`[ffmpeg] error: ${err.message}`)
          reject(err)
        })
        .on('end', () => {
          avgFps = avgFps && totalFps ? round((avgFps + totalFps / count1) / 2) : -1
          avgKbps = avgKbps && totalKbps ? round((avgKbps + totalKbps / count2) / 2) : -1
          printToChannel('[ffmpeg] finished')
          printToChannel(`Average fps: ${avgFps}, average kbps: ${avgKbps}`)
          resolve()
        })

      token.onCancellationRequested(() => {
        command.kill('SIGKILL')
      })
    })
  }

  private static writeSummary(files: ConversionResult[], outputDir: string): void {
    const summary = [`Batch Conversion Summary (${new Date().toLocaleString()})`, '']

    let totalInputSize = 0
    let totalOutputSize = 0
    let totalTime = 0

    files.forEach((file, index) => {
      totalInputSize += file.inputSize
      totalOutputSize += file.outputSize
      totalTime += file.time

      summary.push(`File ${index + 1}:`)
      summary.push(`Input: ${file.input}`)
      summary.push(`Output: ${file.output}`)
      summary.push(`Time: ${fmtMSS(file.time)}`)
      summary.push(`Input Size: ${pb(file.inputSize)}`)
      summary.push(`Output Size: ${pb(file.outputSize)}`)
      summary.push('')
    })

    summary.push('Summary:')
    summary.push(`Total Files: ${files.length}`)
    summary.push(`Total Input Size: ${pb(totalInputSize)}`)
    summary.push(`Total Output Size: ${pb(totalOutputSize)}`)
    summary.push(`Total Processing Time: ${fmtMSS(totalTime)}`)
    summary.push(`Size Reduction: ${((1 - totalOutputSize / totalInputSize) * 100).toFixed(2)}%`)

    const summaryPath = path.join(outputDir, `conversion_summary_${Date.now()}.txt`)
    fs.writeFileSync(summaryPath, summary.join('\n'))
    printToChannel(`Summary written to: ${summaryPath}`)
  }
}
