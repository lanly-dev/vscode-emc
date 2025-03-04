import { ExtensionContext, commands, Uri } from 'vscode'
import Converter from './converter'

export function activate(context: ExtensionContext) {
  const rc = commands.registerCommand
  Converter.init()
  context.subscriptions.concat([
    rc('emc.convertMp3', (uri: Uri) => Converter.convert(uri, 'mp3')),
    rc('emc.convertWav', (uri: Uri) => Converter.convert(uri, 'wav')),
    rc('emc.convertMp4', (uri: Uri) => Converter.convert(uri, 'mp4')),
    rc('emc.download', () => Converter.download())
  ])
}

export function deactivate() { }
