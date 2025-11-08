import { commands, TreeItem, window, workspace } from 'vscode'
import { ExtensionContext, Uri } from 'vscode'
import * as fs from 'fs'

import { download } from './ffmpegFn'
import { MediaFileType } from './interfaces'
import { getFfmpegBinPath, printToChannel } from './utils'
import Converter from './Converter'
import ConverterGif from './ConverterGif'
import ConverterImg from './ConverterImg'
import ConverterQueue from './ConverterQueue'
import TreeViewProvider from './Treeview'
const { showErrorMessage, showInformationMessage } = window
const { MP3, MP4, JPG, WAV, GIF } = MediaFileType

export function activate(context: ExtensionContext) {
  const pathToFfmpeg = getFfmpegBinPath(context.extensionPath)
  init(pathToFfmpeg)
  const treeViewProvider = new TreeViewProvider()
  setupTreeview(treeViewProvider)
  const rc = commands.registerCommand

  context.subscriptions.concat([
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(pathToFfmpeg, uri, MP3)),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(pathToFfmpeg, uri, MP4)),
    rc('emc.convertJpg', (uri: Uri) => ConverterImg.convert(pathToFfmpeg, uri, JPG)),
    rc('emc.convertGif', (uri: Uri) => ConverterGif.convert(pathToFfmpeg, uri, GIF)),
    rc('emc.convertWav', (uri: Uri) => Converter.convert(pathToFfmpeg, uri, WAV)),
    rc('emc.download', () => download(pathToFfmpeg)),
    rc('emc.revealFfmpegBin', () => revealFfmpegBin(pathToFfmpeg)),
    rc('emc.clearQueue', () => treeViewProvider.clearQueue()),
    rc('emc.addToQueue', (file: Uri, files: Uri[]) => treeViewProvider.addToQueue(files)),
    rc('emc.removeFromQueue', (targetItem: TreeItem) => treeViewProvider.removeFromQueue(targetItem)),
    rc('emc.startConversion', async () => {
      const options = treeViewProvider.getConvertFormatOptions()
      const selected = await window.showQuickPick(options, { placeHolder: 'Select an option' })
      if (!selected) {
        showErrorMessage('EMC: No option selected')
        return
      }
      ConverterQueue.convert(pathToFfmpeg, treeViewProvider.queue, selected.label as MediaFileType)
    }),
    rc('emc.showQueueInfo', () => treeViewProvider.showQueueInfo()),
    rc('emc.changeVideoQuality', async () => {
      const config = workspace.getConfiguration('emc')
      const currentValue = config.get('videoQuality', 23)
      const input = await window.showInputBox({
        prompt: 'Enter video quality (CRF/VBR: 0=best, 51=worst)',
        value: currentValue.toString(),
        validateInput: (value) => {
          const num = parseInt(value)
          if (isNaN(num) || num < 0 || num > 51) return 'Please enter a number between 0 and 51'
          return null
        }
      })
      if (input) {
        await config.update('videoQuality', parseInt(input), true)
        treeViewProvider.refresh()
        showInformationMessage(`Video quality set to ${input}`)
      }
    }),
    rc('emc.changeAudioQuality', async () => {
      const config = workspace.getConfiguration('emc')
      const currentValue = config.get('audioQuality', 4)
      const input = await window.showInputBox({
        prompt: 'Enter audio quality (VBR: 0=best, 9=worst)',
        value: currentValue.toString(),
        validateInput: (value) => {
          const num = parseInt(value)
          if (isNaN(num) || num < 0 || num > 9) return 'Please enter a number between 0 and 9'
          return null
        }
      })
      if (input) {
        await config.update('audioQuality', parseInt(input), true)
        treeViewProvider.refresh()
        showInformationMessage(`Audio quality set to ${input}`)
      }
    }),
    rc('emc.toggleGpu', async () => {
      const config = workspace.getConfiguration('emc')
      const currentValue = config.get('enableGpuAcceleration', false)
      await config.update('enableGpuAcceleration', !currentValue, true)
      treeViewProvider.refresh()
      showInformationMessage(`GPU acceleration ${!currentValue ? 'enabled' : 'disabled'}`)
    }),
    rc('emc.toggleBinCheck', async () => {
      const config = workspace.getConfiguration('emc')
      const currentValue = config.get('checkBinary', true)
      await config.update('checkBinary', !currentValue, true)
      treeViewProvider.refresh()
      showInformationMessage(`Binary check ${!currentValue ? 'enabled' : 'disabled'}`)
    })
  ])

  // TODO: this is for the batch convert file chooser
  // context.subscriptions.push(
  //   commands.registerCommand('emc.addToBatchConvert', async () => {
  //     const files = await window.showOpenDialog({
  //       canSelectMany: true,
  //       openLabel: 'Add to Batch Convert',
  //       filters: {
  //         'Media Files': ['ape', 'flac', 'mp3', 'wav', 'wma', 'avi', 'flv', 'mkv', 'mp4', 'ts', 'webm', 'wmv']
  //       }
  //     })

  //     if (files) {
  //       files.forEach(file => {
  //         treeViewProvider.addToQueue(file.fsPath)
  //         printToChannel(`Added to batch: ${file.fsPath}`)
  //       })
  //     } else {
  //       window.showInformationMessage('No files selected for batch conversion.')
  //     }
  //   })
  // )
}

function init(pathToFfmpeg: string) {
  if (!fs.existsSync(pathToFfmpeg!)) {
    const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'
    showInformationMessage(MSG)
    printToChannel(MSG)
  }
  printToChannel('Easy Media Converter activate successfully!')
}

function setupTreeview(treeViewProvider: TreeViewProvider) {
  const treeview = window.createTreeView('emcTreeView', { treeDataProvider: treeViewProvider })
  treeViewProvider.onDidChangeTreeData(e => {
    const itemCount = treeViewProvider.queue.length
    treeview.badge = itemCount
      ? { value: itemCount, tooltip: `${itemCount} item(s) in queue` }
      : undefined
  })
}

function revealFfmpegBin(pathToFfmpeg: string) {
  if (!pathToFfmpeg) {
    showErrorMessage('No binary found for the current OS architecture')
    return
  }
  if (!fs.existsSync(pathToFfmpeg)) {
    const msg = `The ffmpeg binary is unavailable at path: ${pathToFfmpeg}`
    showInformationMessage(msg)
    printToChannel(msg)
    return
  }
  console.log(`Revealing ffmpeg binary at: ${pathToFfmpeg}`)
  commands.executeCommand('revealFileInOS', Uri.file(pathToFfmpeg))
}

export function deactivate() { }
