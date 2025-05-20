import { commands, window } from 'vscode'
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'
import { MediaFileType } from './interfaces'
import Converter from './Converter'

const { showInformationMessage } = window

export default class TreeViewProvider implements TreeDataProvider<TreeItem> {

  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

  public queue: Uri[] = []

  constructor() { }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  private updateItemCount(): void {
    commands.executeCommand('setContext', 'emcItemCount', this.queue.length)
  }

  private updateBatchConvertibleStatus(): void {
    const isConvertible = this.isQueueConvertible()
    commands.executeCommand('setContext', 'emcQueueConvertible', isConvertible)
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) return Promise.resolve([])

    // If no element is provided == root element
    return Promise.resolve(
      this.queue.map((file) => {
        const item = new TreeItem(file, TreeItemCollapsibleState.None)
        item.contextValue = 'emcTreeviewItem'
        return item
      })
    )
  }

  addToQueue(files: Uri[]): void {
    const dup: Uri[] = []
    files.forEach(item => {
      if (this.queue.length && this.queue.some(queueItem => queueItem.fsPath === item.fsPath)) dup.push(item)
      else this.queue.push(item)
    })
    if (dup.length) {
      const dupNames = dup.map(item => item.path.split('/').pop()).join(', ')
      showInformationMessage(`${dup.length} file(s) already in queue: ${dupNames}`)
    }
    this.queue.sort((a, b) => a.fsPath.localeCompare(b.fsPath))
    this.updateItemCount()
    this.updateBatchConvertibleStatus()
    this.refresh()
  }

  removeFromQueue(targetItem: TreeItem): void {
    this.queue = this.queue.filter((item) => item !== targetItem.resourceUri)
    this.updateItemCount()
    this.updateBatchConvertibleStatus()
    this.refresh()
  }

  clearQueue(): void {
    this.queue = []
    this.updateItemCount()
    this.updateBatchConvertibleStatus()
    this.refresh()
  }

  getConvertFormatOptions(): string[] {
    const options = []
    const isImageConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
    })
    if (isImageConvertible) options.push(MediaFileType.JPG)

    const vFormat = ['avi', 'flv', 'mkv', 'mp4', 'ts', 'webm', 'wmv']
    const isVideoConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && vFormat.includes(ext)
    })
    if (isVideoConvertible) options.push(MediaFileType.MP4)

    const aFormat = ['ape', 'flac', 'mp3', 'wav', 'wma'].concat(vFormat)
    const isAudioConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && aFormat.includes(ext)
    })
    if (isAudioConvertible) options.push(MediaFileType.MP3)
    return options
  }

  isQueueConvertible(): boolean {
    if (this.queue.length === 0) return false
    if (this.getConvertFormatOptions().length === 0) return false
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
