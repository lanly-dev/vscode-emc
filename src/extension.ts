import { commands, window } from 'vscode'
import { ExtensionContext, Uri } from 'vscode'
import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import pathToFfmpeg from 'ffmpeg-static'

import { download } from './ffmpegFn'
import { MediaFileType } from './interfaces'
import { printToChannel} from './utils'
import Converter from './Converter'
import ConverterImg from './ConverterImg'
import BatchTreeViewProvider from './BatchTreeview'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showErrorMessage, showInformationMessage } = window
const { MP3, MP4, JPG, WAV } = MediaFileType

export function activate(context: ExtensionContext) {
  init()
  const treeViewProvider = new BatchTreeViewProvider()
  window.registerTreeDataProvider('emcTreeView', treeViewProvider)
  const rc = commands.registerCommand
  context.subscriptions.concat([
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(uri, MP3)),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(uri, MP4)),
    rc('emc.convertJpg', (uri: Uri) => ConverterImg.convert(uri, JPG)),
    rc('emc.convertWav', (uri: Uri) => Converter.convert(uri, WAV)),
    rc('emc.download', download),
    rc('emc.revealFfmpegBin', revealFfmpegBin),
    rc('emc.addToBatchConvert', (file: string) => treeViewProvider.addToQueue(file)),
    rc('emc.removeFromBatchConvert', (file: string) => treeViewProvider.removeFromQueue(file))
  ])
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
