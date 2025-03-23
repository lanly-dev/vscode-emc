import { createWriteStream } from 'fs'
import { performance as perf } from 'perf_hooks'
import { ProgressLocation, window } from 'vscode'
import { promisify } from 'util'

import * as fs from 'fs'
import * as os from 'os'
import * as stream from 'stream'

import axios from 'axios'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'

import { channel, printToChannel } from './utils'

const pkg = require('ffmpeg-static/package.json')
const { showErrorMessage, showInformationMessage } = window

export async function download() {
  channel.show()
  if (!pathToFfmpeg) {
    showErrorMessage('No binary found for the current OS architecture')
    return
  }

  if (fs.existsSync(pathToFfmpeg)) {
    const msg = 'The ffmpeg binary is already downloaded, located at: ' + pathToFfmpeg
    showInformationMessage(msg)
    printToChannel(msg)
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
    printToChannel(msg)
    showErrorMessage(msg)
    return
  }

  const t0 = perf.now()
  printToChannel(`Downloading ffmpeg from ${url}`)
  await downloadStream(url)
  const t1 = perf.now()
  const ms = Math.round(t1 - t0)

  const fileSize = pb(fs.statSync(pathToFfmpeg).size)
  const msg = `ffmpeg - ${fileSize} - ${ms} ms downloaded successfully! 🚀🚀`
  const msg2 = 'ffmpeg binary is at: ' + pathToFfmpeg
  printToChannel(msg)
  showInformationMessage(msg)
  showInformationMessage(msg2)
}

function downloadStream(url: string) {
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