
import { createWriteStream } from 'fs'
import { performance as perf } from 'perf_hooks'
import { ProgressLocation, window } from 'vscode'
import { promisify } from 'util'
import * as fs from 'fs'
import * as os from 'os'
import * as stream from 'stream'
import * as path from 'path'
import axios from 'axios'
import pb from 'pretty-bytes'
import { channel, printToChannel } from './utils'

const { showErrorMessage, showInformationMessage } = window

export async function download(ffmpegPath: string) {
  channel.show()
  const arch = os.arch()
  const platform = os.platform()
  let url = ''
  const binName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const outDir = path.dirname(ffmpegPath)
  const outPath = path.join(outDir, binName)

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  if (fs.existsSync(outPath)) {
    const msg = 'The ffmpeg binary is already downloaded, located at: ' + outPath
    showInformationMessage(msg)
    printToChannel(msg)
    return
  }

  // Custom ffmpeg-build URLs - always use latest release
  const BASE_URL = 'https://github.com/lanly-dev/ffmpeg-build/releases/latest/download'
  const platformKey = `${platform}-${arch}`

  switch (platformKey) {
  case 'win32-x64':
    url = `${BASE_URL}/ffmpeg-windows.exe`
    break
  case 'linux-x64':
    url = `${BASE_URL}/ffmpeg-linux`
    break
  case 'darwin-x64':
    url = `${BASE_URL}/ffmpeg-macos`
    break
  default:
    showErrorMessage('Unsupported platform or architecture for ffmpeg builds')
    return
  }  // Check if URL is valid
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
  await downloadStream(url, outPath)

  // Set executable permissions on Unix-like systems
  if (platform !== 'win32') fs.chmodSync(outPath, 0o755)

  const t1 = perf.now()
  const ms = Math.round(t1 - t0)
  const fileSize = pb(fs.statSync(outPath).size)
  const msg = `ffmpeg - ${fileSize} - ${ms} ms downloaded and extracted successfully! 🚀🚀`
  const msg2 = 'ffmpeg binary is at: ' + outPath
  printToChannel(msg)
  showInformationMessage(msg)
  showInformationMessage(msg2)
}

function downloadStream(url: string, dest: string) {
  const writer = createWriteStream(dest)
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


