import { ExtensionContext, commands, Uri } from 'vscode'
import Converter from './converter'

export function activate(context: ExtensionContext) {
  const rc = commands.registerCommand
  Converter.init()
  context.subscriptions.concat([
    // rc('emc.convertLocalMp3', (uri: Uri) => Converter.convertLocal(uri, 'mp3')),
    // rc('emc.convertLocalMp4', (uri: Uri) => Converter.convertLocal(uri, 'mp4')),
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(uri, 'mp3')),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(uri, 'mp4')),
    // rc('emc.download', () => Converter.download())
  ])
}

export function deactivate() { }
