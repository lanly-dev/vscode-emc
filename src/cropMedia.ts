import { ProgressLocation, Uri, window } from 'vscode'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { channel, parseTimeRange, printToChannel, showPrintErrorMsg } from './utils'

const { showErrorMessage, showInformationMessage } = window

// Media extensions supported for cropping/trimming
const MEDIA_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|wma|ape|mp4|mkv|avi|mov|webm|wmv|flv|ts)$/i

export default class CropMedia {

  static async crop(pathToFfmpeg: string, uri?: Uri) {
    channel.show()
    let fsPath: string
    // FileChooser not ncp
    if (uri?.fsPath) fsPath = uri.fsPath
    else {
      const files = await window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Select media to crop',
        filters: {
          'Audio/Video': [
            'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma', 'ape',
            'mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', 'ts'
          ]
        }
      })
      if (!files?.[0]) return
      fsPath = files[0].fsPath
    }

    if (!fs.existsSync(fsPath)) {
      showErrorMessage('File not found')
      return
    }
    if (!MEDIA_EXT.test(fsPath)) {
      showErrorMessage('Selected file is not an audio or video file')
      return
    }

    // Probe media duration via ffmpeg
    const durationSec = await this.getDuration(pathToFfmpeg, fsPath)
    if (durationSec === null) {
      showErrorMessage('Could not read media duration')
      return
    }

    // Ask user for the crop range
    const hint = `0:00 - ${this.formatDuration(durationSec)}`
    const input = await window.showInputBox({
      prompt: 'Enter crop range (e.g. 1:20 - 2:10)',
      value: hint,
      validateInput: (value) => {
        const range = parseTimeRange(value)
        if (!range) return 'Use format MM:SS - MM:SS (e.g. 1:20 - 2:10)'
        if (range.startSec >= range.endSec) return 'Start time must be before end time'
        if (range.startSec < 0 || range.endSec > durationSec) {
          return `Range is outside media duration (0 - ${this.formatDuration(durationSec)})`
        }
        return null
      }
    })
    if (!input) return

    const range = parseTimeRange(input)!
    if (range.startSec < 0 || range.endSec > durationSec || range.startSec >= range.endSec) {
      showErrorMessage(`Range must be within 0 - ${this.formatDuration(durationSec)} and start < end`)
      return
    }

    // Output file keeps the same extension, with a -cropped suffix
    const ext = path.extname(fsPath)
    const base = path.basename(fsPath, ext)
    const dir = path.dirname(fsPath)
    const outFile = path.join(dir, `${base}-cropped${ext}`)

    await this.runCrop(pathToFfmpeg, fsPath, outFile, range.startSec, range.endSec)

    const msg = `Cropped: ${path.basename(outFile)}`
    printToChannel(msg)
    showInformationMessage(msg)
  }

  // Read duration (seconds) from ffmpeg -i stderr
  private static async getDuration(pathToFfmpeg: string, input: string): Promise<number | null> {
    return new Promise((resolve) => {
      const proc = spawn(pathToFfmpeg, ['-i', input, '-hide_banner'])
      let stderr = ''
      proc.stderr.on('data', (d: Buffer) => stderr += d.toString())
      proc.on('close', () => {
        const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/)
        if (!m) return resolve(null)
        const h = Number(m[1])
        const min = Number(m[2])
        const s = Number(m[3])
        resolve(h * 3600 + min * 60 + s)
      })
      proc.on('error', () => resolve(null))
    })
  }

  // Stream-copy trim: fast, lossless, keeps original format/codec
  private static runCrop(pathToFfmpeg: string, input: string, output: string, startSec: number, endSec: number) {
    return window.withProgress({ location: ProgressLocation.Window, title: 'Cropping media', cancellable: true },
      (progress, token) => {
        return new Promise<void>((resolve, reject) => {
          const duration = endSec - startSec
          const args = ['-ss', String(startSec), '-i', input, '-t', String(duration), '-c', 'copy', '-y', output]
          printToChannel(`Executing: ${pathToFfmpeg} ${args.join(' ')}`)
          const proc = spawn(pathToFfmpeg, args)
          let stderr = ''
          proc.stderr.on('data', (d: Buffer) => {
            stderr += d.toString()
          })
          proc.on('close', (code: number) => {
            if (code === 0) resolve()
            else {
              printToChannel(stderr)
              reject(new Error(`ffmpeg exited with code ${code}`))
            }
          })
          proc.on('error', reject)
          token.onCancellationRequested(() => {
            proc.kill('SIGKILL')
            reject(new Error('Cropping was canceled'))
          })
        })
      })
  }

  private static formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }
}
