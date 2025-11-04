
import { createWriteStream } from 'fs'
import { performance as perf } from 'perf_hooks'
import { ProgressLocation, window } from 'vscode'
import { promisify } from 'util'
import * as fs from 'fs'
import * as os from 'os'
import * as stream from 'stream'
import * as path from 'path'

import * as AdmZip from 'adm-zip'
import * as tar from 'tar'

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

  // BtbN FFmpeg-Builds - always use latest release
  const BASE_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download'
  const platformKey = `${platform}-${arch}`
  let archiveType: 'zip' | 'tar.xz' = 'zip'

  switch (platformKey) {
  case 'win32-x64':
    url = `${BASE_URL}/ffmpeg-master-latest-win64-gpl.zip`
    archiveType = 'zip'
    break
  case 'linux-x64':
    url = `${BASE_URL}/ffmpeg-master-latest-linux64-gpl.tar.xz`
    archiveType = 'tar.xz'
    break
  case 'darwin-x64':
    url = `${BASE_URL}/ffmpeg-master-latest-macos64-gpl.zip`
    archiveType = 'zip'
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
  const archivePath = path.join(outDir, `ffmpeg_download.${archiveType === 'zip' ? 'zip' : 'tar.xz'}`)
  await downloadStream(url, archivePath)

  printToChannel('Extracting ffmpeg binary...')
  if (archiveType === 'zip') {
    const zip = new AdmZip(archivePath)
    const entries = zip.getEntries()
    let found = false
    for (const entry of entries) {
      if (entry.entryName.includes('bin/ffmpeg')) {
        const data = entry.getData()
        fs.writeFileSync(outPath, data)
        found = true
        break
      }
    }
    if (!found) {
      showErrorMessage('ffmpeg binary not found in the downloaded archive')
      fs.unlinkSync(archivePath)
      return
    }
  } else if (archiveType === 'tar.xz') {
    await tar.x({
      file: archivePath,
      cwd: outDir,
      filter: (p: string) => p.includes('bin/ffmpeg') && !p.endsWith('/'),
      strip: 1
    })
    const extractedPath = findFileRecursive(outDir, binName)
    if (extractedPath && extractedPath !== outPath) fs.renameSync(extractedPath, outPath)
  }

  // Set executable permissions on Unix-like systems
  if (platform !== 'win32') fs.chmodSync(outPath, 0o755)

  // Clean up archive
  fs.unlinkSync(archivePath)

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

function findFileRecursive(dir: string, fileName: string): string | undefined {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      const found = findFileRecursive(fullPath, fileName)
      if (found) return found
    } else if (file === fileName) return fullPath
  }
  return undefined
}


