import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, workspace, window, commands } from 'vscode'
import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import * as path from 'path'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'
import {
  channel, createDir, durationToSec, fmtMSS, fmtTimeLeft, getFormattedDate,
  getOutDirName, getWorkspacePath, printToChannel, round, showPrintErrorMsg
} from './utils'
import { MediaFileType, ConversionResult, ConversionProgress, CodecData } from './interfaces'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showInformationMessage } = window
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

export default class ConverterQueue {
  private static readonly MAX_CONCURRENT = 3

  static async convert(files: Uri[], type: MediaFileType): Promise<void> {
    channel.show()

    if (!fs.existsSync(pathToFfmpeg!)) {
      const abortMsg = 'Converting action aborted'
      showInformationMessage(MSG)
      showInformationMessage(abortMsg)
      printToChannel(MSG)
      printToChannel(abortMsg)
      return
    }

    const wsPath = getWorkspacePath()
    if (!wsPath) {
      showInformationMessage('No workspace folder found. Please open a workspace folder to save the converted files.')
      return
    }

    await commands.executeCommand('setContext', 'emcQueueRunning', true)

    const totalFiles = files.length
    let completed = 0

    const batchStartTime = perf.now()
    const outputDir = path.join(wsPath, getOutDirName())
    try {
      await createDir(Uri.file(outputDir))
      printToChannel(`📁Output directory created: ${outputDir}`)
    } catch (error: any) {
      showPrintErrorMsg(error)
      await commands.executeCommand('setContext', 'emcQueueRunning', false)
      return
    }

    const conversions: ConversionResult[] = []
    try {
      await window.withProgress({
        location: ProgressLocation.Notification,
        title: 'Batch Converting',
        cancellable: true
      }, async (progress, token) => {
        const namesTemp: (string)[] = []
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
              printToChannel(`Processing file ${++completed}/${totalFiles}: ${file.fsPath} - size: ${pb(inputSize)}`)

              const fileName = file.path.split('/').pop()
              let name = fileName!.substring(0, fileName!.lastIndexOf('.'))
              // If the name already exists, replace . with _
              if (namesTemp.includes(name!)) name = fileName!.replace('.', '_')
              else namesTemp.push(name!)

              const oType = type
              const oPath = path.join(outputDir, `${name}.${oType}`)
              const oName = path.basename(oPath)

              const t0 = perf.now()
              const theP = this.convertFiles(type, file.fsPath, oPath, progress, token, completed, totalFiles)
              p.push(theP)
              theP.then(() => {
                const t1 = perf.now()
                const ms = Math.round(t1 - t0)
                const msg = `${fileName} => ${oName} completed!`
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
              })
            } catch (error: any) {
              if (error.message === 'ffmpeg was killed with signal SIGKILL') printToChannel('Conversion was canceled')
              else showPrintErrorMsg(error)
            }
          }
          await Promise.all(p)
        }
      })
      const batchEndTime = perf.now()
      const totalElapsedTime = Math.round(batchEndTime - batchStartTime)
      this.writeSummary(conversions, outputDir, totalElapsedTime)
      showInformationMessage(
        `Batch conversion completed: ${completed}/${totalFiles} files.\nOutput directory: ${outputDir}`
      )
    } catch (error) {
      printToChannel(`Batch conversion error: ${error}`)
      showInformationMessage('Batch conversion error. Check the output panel for details.')
    } finally {
      await commands.executeCommand('setContext', 'emcQueueRunning', false)
    }
  }

  private static convertFiles(
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
      let command = ffmpeg(input)

      command = command.format(type)
      if (enableGpu && type === MediaFileType.MP4) command = command.videoCodec('h264_nvenc')

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

          const elapsedTime = (Date.now() - startTime) / 1000
          const estimatedTotalTime = (elapsedTime * 100) / percent
          const estimatedTimeLeft = Math.max(0, estimatedTotalTime - elapsedTime)
          const timeLeftMessage = fmtTimeLeft(estimatedTimeLeft)

          progress.report({
            message: `File ${current}/${total}: ${round(percent)}% - ${timeLeftMessage}` +
              `${fps > 0 ? ` (${round(fps)} fps)` : ''}`
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
          // console.debug('[ffmpeg] finished')
          printToChannel(`Average fps: ${avgFps}, average kbps: ${avgKbps}`)
          resolve()
        })

      token.onCancellationRequested(() => {
        command.kill('SIGKILL')
      })
    })
  }

  private static writeSummary(files: ConversionResult[], outputDir: string, totalElapsedTime: number): void {
    const summary = [`Batch Conversion Summary (${new Date().toLocaleString()})`, '']

    let totalInputSize = 0
    let totalOutputSize = 0
    let totalProcessingTime = 0

    let reducedCount = 0
    let increasedCount = 0
    let sameCount = 0

    files.forEach((file) => {
      totalInputSize += file.inputSize
      totalOutputSize += file.outputSize
      totalProcessingTime += file.time

      if (file.outputSize < file.inputSize) reducedCount++
      else if (file.outputSize > file.inputSize) increasedCount++
      else sameCount++
    })

    // List file numbers for each category
    const reducedFiles = files
      .map((file, idx) => file.outputSize < file.inputSize ? idx + 1 : null)
      .filter((n) => n !== null)
      .join(', ')
    const increasedFiles = files
      .map((file, idx) => file.outputSize > file.inputSize ? idx + 1 : null)
      .filter((n) => n !== null)
      .join(', ')

    summary.push(`Total Files: ${files.length}`)
    if (reducedCount > 0) summary.push(`Files Reduced in Size: ${reducedCount} - [${reducedFiles}]`)
    else summary.push(`Files Reduced in Size: ${reducedCount}`)
    if (increasedCount > 0) summary.push(`Files Increased in Size: ${increasedCount} - [${increasedFiles}]`)
    else summary.push(`Files Increased in Size: ${increasedCount}`)
    summary.push(`Files with Same Size: ${sameCount}`)

    summary.push(`Total Input Size: ${pb(totalInputSize)}`)
    summary.push(`Total Output Size: ${pb(totalOutputSize)}`)
    summary.push(`Total Processing Time: ${fmtMSS(totalProcessingTime)}`)
    summary.push(`Total Elapsed Time: ${fmtMSS(totalElapsedTime)}`)
    summary.push(`Size Reduction: ${((1 - totalOutputSize / totalInputSize) * 100).toFixed(2)}%`)
    summary.push('')

    files.forEach((file, index) => {
      summary.push(`File ${index + 1}:`)
      summary.push(`Input: ${file.input}`)
      summary.push(`Output: ${file.output}`)
      summary.push(`Time: ${fmtMSS(file.time)}`)
      summary.push(`Input Size: ${pb(file.inputSize)}`)
      summary.push(`Output Size: ${pb(file.outputSize)}`)
      summary.push('')
    })

    const summaryPath = path.join(outputDir, `summary${getFormattedDate()}-${files.length}.txt`)
    fs.writeFileSync(summaryPath, summary.join('\n'))
    printToChannel(`🗒️Summary written to: ${summaryPath}`)
  }
}
