import { createWriteStream } from 'fs'
import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, window } from 'vscode'
import { promisify } from 'util'
import { resolve } from 'path'

import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import * as os from 'os'
import * as stream from 'stream'

import axios from 'axios'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { createOutputChannel, showErrorMessage, showInformationMessage } = window
const pkg = require('ffmpeg-static/package.json')
const channel = createOutputChannel('Easy Media Converter')
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

export default class Converter {

  static async init() {
    if (!fs.existsSync(pathToFfmpeg!)) {
      showInformationMessage(MSG)
      this.printToChannel(MSG)
    }
    this.printToChannel('Easy Media Converter activate successfully!')
  }

  static async download() {
    channel.show()
    if (!pathToFfmpeg) {
      showErrorMessage('No binary found for the current OS architecture')
      return
    }

    if (fs.existsSync(pathToFfmpeg)) {
      const msg = 'The ffmpeg binary is already downloaded, located at: ' + pathToFfmpeg
      showInformationMessage(msg)
      this.printToChannel(msg)
      return
    }

    const { 'ffmpeg-static': { 'binary-release-tag': rTag } } = pkg
    const arch = os.arch()
    const platform = os.platform()
    const release = rTag
    const baseUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${release}`
    // b6.0 is the latest release
    // https://github.com/eugeneware/ffmpeg-static/releases
    const url = `${baseUrl}/ffmpeg-${platform}-${arch}`

    // Check if URL is valid
    try {
      await axios.head(url)
    } catch (e) {
      const msg = `Could not download ffmpeg binary, attempted to download from ${url} failed`
      this.printToChannel(msg)
      showErrorMessage(msg)
      return
    }

    const t0 = perf.now()
    this.printToChannel(`Downloading ffmpeg from ${url}`)
    await this.downloadStream(url)
    const t1 = perf.now()
    const ms = Math.round(t1 - t0)

    const fileSize = pb(fs.statSync(pathToFfmpeg).size)
    const msg = `ffmpeg - ${fileSize} - ${ms} ms downloaded successfully! 🚀🚀`
    const msg2 = 'ffmpeg binary is at: ' + pathToFfmpeg
    this.printToChannel(msg)
    showInformationMessage(msg)
    showInformationMessage(msg2)
  }

  static async convert({ fsPath, path }: Uri, type: 'mp3' | 'mp4') {
    channel.show()
    if (!fs.existsSync(pathToFfmpeg!)) {
      const abortMsg = 'Converting action aborted'
      showInformationMessage(MSG)
      showInformationMessage(abortMsg)
      this.printToChannel(MSG)
      this.printToChannel(abortMsg)
      return
    }
    try {
      const inputSize = fs.statSync(fsPath).size
      this.printToChannel(`File input: ${fsPath} - size: ${pb(inputSize)}`)
      const fileName = path.split('/').pop()
      const name = fileName?.split('.')[0]
      const dir = fsPath.replace(fileName!, '')
      const { outFile: oPath, fileName: oFName } = this.getOutFile(dir, name!, type)

      const t0 = perf.now()
      await this.ffmpegConvert(type, fsPath, oPath)
      const t1 = perf.now()
      const ms = Math.round(t1 - t0)

      const msg = `${fileName} => ${oFName} completed!`
      this.printToChannel(`${msg}\nTotal time: ${this.fmtMSS(ms)}`)
      const size = fs.statSync(oPath).size
      this.printToChannel(`File output: ${oPath} - size: ${pb(size)}\n`)
      showInformationMessage(msg)
    } catch (error) {
      this.showErrorMsg(error)
    }
  }

  private static ffmpegConvert(type: string, input: string, output: string) {
    return window.withProgress({
      location: ProgressLocation.Window,
      title: 'Converting'
    }, (progress) => {
      return new Promise<void>((resolve, reject) => {
        let avgFps = 0
        let avgKbps = 0
        let totalFps = 0
        let totalKbps = 0
        let count1 = 0
        let count2 = 0
        let totalTime = 0

        ffmpeg(input).format(type).save(output)
          .on('codecData', ({ duration }) => totalTime = this.durationToSec(duration))
          .on('progress', (prog) => {
            const { frames, currentFps: fps, currentKbps: kbps, targetSize: s, timemark } = prog
            const time = this.durationToSec(timemark)
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
            // this.printToChannel(`[ffmpeg] ${msg}`)
            progress.report({ message: `${this.round(percent)}%` })
          })
          .on('error', (err) => {
            this.printToChannel(`[ffmpeg] error: ${err.message}`)
            reject(err)
          })
          .on('end', () => {
            avgFps = avgFps && totalFps ? this.round((avgFps + totalFps / count1) / 2) : -1
            avgKbps = avgKbps && totalKbps ? this.round((avgKbps + totalKbps / count2) / 2) : -1
            this.printToChannel('[ffmpeg] finished')
            this.printToChannel(`Average fps: ${avgFps}, average kbps: ${avgKbps}`)
            resolve()
          })
      })
    })
  }

  private static downloadStream(url: string) {
    const writer = createWriteStream(pathToFfmpeg!)
    return window.withProgress({
      location: ProgressLocation.Window,
      title: 'Downloading ffmpeg'
    }, (progress) => {
      return axios.get(url, { responseType: 'stream' }).then((response) => {
        const { data: steam } = response
        const total = response.headers['content-length']
        const totalMb = pb(parseInt(total))
        let dlTotal = 0
        steam.on('data', (chunk: Buffer) => {
          const tmp = pb(dlTotal)
          dlTotal += chunk.length
          const dlTotalMb = pb(dlTotal)
          if (tmp === dlTotalMb) return
          progress.report({ message: `${dlTotalMb}/${totalMb}` })
        })
        steam.pipe(writer)
        return promisify(stream.finished)(writer)
      })
    })
  }

  private static printToChannel(text: string) {
    channel.append(`${text}\n`)
  }

  private static round(num: number) {
    return Math.round((num + Number.EPSILON) * 100) / 100
  }

  // M:SS
  private static fmtMSS(ms: number) {
    let s = Math.round(ms / 1000)
    if (s < 60) return `${s} sec`
    return (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s
  }

  private static durationToSec(duration: string) {
    const [hours, minutes, seconds] = duration.split(':')
    return Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)
  }

  //@ts-ignore
  private static getOutFile(dir: string, name: string, type: 'mp3' | 'mp4', num?: number) {
    const fileName = `${name}${!num ? '' : `-${num}`}.${type}`
    const outFile = resolve(dir, fileName)
    if (fs.existsSync(outFile)) return this.getOutFile(dir, name, type, !num ? 1 : ++num)
    return { outFile, fileName }
  }

  //@ts-ignore
  private static showErrorMsg(error) {
    const msg = 'Error: conversion failed!'
    this.printToChannel(`${msg} - ${error.message ?? JSON.stringify(error, null, 2)}\n`)
    showErrorMessage(msg)
  }
}
