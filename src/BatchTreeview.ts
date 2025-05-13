import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, commands } from 'vscode'
import Converter from './Converter'
import { MediaFileType } from './interfaces'

export default class BatchTreeViewProvider implements TreeDataProvider<TreeItem> {

  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

  private queue: Uri[] = []

  constructor() { }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  private updateBatchItemCount(): void {
    commands.executeCommand('setContext', 'emcBatchItemCount', this.queue.length)
  }

  private updateBatchConvertibleStatus(): void {
    const isConvertible = this.isQueueConvertible();
    commands.executeCommand('setContext', 'emcBatchConvertible', isConvertible);
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return Promise.resolve(
        this.queue.map((file) => {
          const item = new TreeItem(file, TreeItemCollapsibleState.None)
          item.command = { command: 'emc.removeFromQueue', title: 'Remove from Queue', arguments: [file] }
          return item
        })
      )
    }
    return Promise.resolve([])
  }

  addToQueue(file: Uri): void {
    this.queue.push(file)
    this.queue.sort((a, b) => a.fsPath.localeCompare(b.fsPath))
    console.log(`Added to queue: ${file}`)
    this.updateBatchItemCount()
    this.updateBatchConvertibleStatus()
    this.refresh()
  }

  removeFromQueue(file: Uri): void {
    this.queue = this.queue.filter((item) => item !== file)
    this.updateBatchItemCount()
    this.refresh()
  }

  clearQueue(): void {
    this.queue = []
    this.updateBatchItemCount()
    this.refresh()
  }

  getConvertFormatOptions(): string[] {
    const options = []
    const isImageConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
    })
    if (isImageConvertible) options.push('JPG')

    const vFormat = ['avi', 'flv', 'mkv', 'mp4', 'ts', 'webm', 'wmv']
    const isVideoConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && vFormat.includes(ext)
    })
    if (isVideoConvertible) options.push('MP4')

    const aFormat = ['ape', 'flac', 'mp3', 'wav', 'wma'].concat(vFormat)
    const isAudioConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && aFormat.includes(ext)
    })
    if (isAudioConvertible) options.push('MP3')
    return options
  }

  isQueueConvertible(): boolean {
    if (this.getConvertFormatOptions().length === 0) {
      console.log('Queue is not convertible')
      return false
    }
    return true
  }

  async startConvert(): Promise<void> {
    for (const file of this.queue) {
      try {
        console.log(`Converting: ${file.fsPath}`)
        await Converter.convert(file, MediaFileType.MP4) // Replace with desired format
        console.log(`Successfully converted: ${file.fsPath}`)
      } catch (error) {
        console.error(`Failed to convert: ${file.fsPath}`, error)
      }
    }

    console.log('Batch conversion completed')
    this.clearQueue()
  }
}
