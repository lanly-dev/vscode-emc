import { ExtensionContext, commands, Uri } from 'vscode'

import { download } from './downloadFn'
import { MediaFileType } from './interfaces'
import Converter from './Converter'

const { MP3, MP4, WAV } = MediaFileType

export function activate(context: ExtensionContext) {
  const rc = commands.registerCommand
  Converter.init()
  context.subscriptions.concat([
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(uri, MP3)),
    rc('emc.convertWav', (uri: Uri) => Converter.convert(uri, WAV)),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(uri, MP4)),
    rc('emc.download', () => download())
  ])
}

export function deactivate() { }
