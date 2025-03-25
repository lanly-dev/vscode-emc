import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, window } from 'vscode'

import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'

import { channel, durationToSec, fmtMSS, getOutFile, printToChannel, round, showPrintErrorMsg } from './utils'
import { MediaFileType } from './interfaces'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showInformationMessage } = window
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

// Due to output format *** is not available
// https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1282
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
      const name = fileName?.split('.')[0]
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
        const command = ffmpeg(input)
          .output(output)
          .format('image2') // Specify the format for images
          .on('progress', (prog) => {
            if (token.isCancellationRequested) {
              command.kill('SIGKILL')
              return Promise.reject('User cancelled the operation')
            }
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err.message);
            reject(err)
          })
          .on('end', () => {
            console.log('Conversion completed successfully.');
            resolve()
          })
        command.run()
      })
    })
  }
}
