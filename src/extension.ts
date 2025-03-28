import { commands, window } from 'vscode'
import { ExtensionContext, Uri } from 'vscode'
import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import pathToFfmpeg from 'ffmpeg-static'

import { download } from './downloadFn'
import { MediaFileType } from './interfaces'
import { printToChannel} from './utils'
import Converter from './Converter'
import ConverterImg from './ConverterImg'
import ConverterImgSvg from './ConverterImgSvg'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showInformationMessage } = window
const { MP3, MP4, JPG, SVG, WAV } = MediaFileType

export function activate(context: ExtensionContext) {
  const rc = commands.registerCommand
  init()

  context.subscriptions.concat([
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(uri, MP3)),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(uri, MP4)),
    rc('emc.convertJpg', (uri: Uri) => ConverterImg.convert(uri, JPG)),
    rc('emc.convertSvg', (uri: Uri) => ConverterImgSvg.convert(uri)),
    rc('emc.convertWav', (uri: Uri) => Converter.convert(uri, WAV)),
    rc('emc.download', () => download())
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

export function deactivate() { }
