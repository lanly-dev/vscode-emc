import { commands, TreeItem, window } from 'vscode'
import { ExtensionContext, Uri } from 'vscode'
import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import pathToFfmpeg from 'ffmpeg-static'

import { download } from './ffmpegFn'
import { MediaFileType } from './interfaces'
import { printToChannel } from './utils'
import Converter from './Converter'
import ConverterImg from './ConverterImg'
import ConverterQueue from './ConverterQueue'
import TreeViewProvider from './Treeview'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showErrorMessage, showInformationMessage } = window
const { MP3, MP4, JPG, WAV } = MediaFileType

export function activate(context: ExtensionContext) {
  init()
  const treeViewProvider = new TreeViewProvider()
  window.registerTreeDataProvider('emcTreeView', treeViewProvider)
  const rc = commands.registerCommand
  context.subscriptions.concat([
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(uri, MP3)),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(uri, MP4)),
    rc('emc.convertJpg', (uri: Uri) => ConverterImg.convert(uri, JPG)),
    rc('emc.convertWav', (uri: Uri) => Converter.convert(uri, WAV)),
    rc('emc.download', download),
    rc('emc.revealFfmpegBin', revealFfmpegBin),
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
      Object.values(MediaFileType).includes(selected as MediaFileType)
      ConverterQueue.convert(treeViewProvider.queue, selected as MediaFileType)
    }),
    rc('emc.showQueueInfo', () => treeViewProvider.showQueueInfo())
  ])

  // this is for the batch convert file chooser
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

function init() {
  if (!fs.existsSync(pathToFfmpeg!)) {
    const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'
    showInformationMessage(MSG)
    printToChannel(MSG)
  }
  printToChannel('Easy Media Converter activate successfully!')
}

function revealFfmpegBin() {
  if (!pathToFfmpeg) {
    showErrorMessage('No binary found for the current OS architecture')
    return
  }
  if (!fs.existsSync(pathToFfmpeg)) {
    const msg = 'The ffmpeg binary is unavailable 😐'
    showInformationMessage(msg)
    printToChannel(msg)
    return
  }
  commands.executeCommand('revealFileInOS', Uri.file(pathToFfmpeg))
}

export function deactivate() { }
