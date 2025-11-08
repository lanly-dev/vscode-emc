import { commands, QuickPickItem, window, workspace, ThemeIcon } from 'vscode'
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'
import { MediaFileType } from './interfaces'
import pb from 'pretty-bytes'

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
    if (element) {
      // If it's the Settings item, return its children
      if (element.contextValue === 'emcSettingsItem') return Promise.resolve(this.getSettingsChildren())
      return Promise.resolve([])
    }

    // Root level: Settings + Queue items
    const items: TreeItem[] = []

    // Add Settings item at the top
    const settingsItem = new TreeItem('Settings', TreeItemCollapsibleState.Collapsed)
    settingsItem.contextValue = 'emcSettingsItem'
    settingsItem.iconPath = new ThemeIcon('settings-gear')
    items.push(settingsItem)

    // Add queue items
    const queueItems = this.queue.map((file) => {
      const item = new TreeItem(file, TreeItemCollapsibleState.None)
      item.contextValue = 'emcTreeviewItem'
      return item
    })
    items.push(...queueItems)

    return Promise.resolve(items)
  }

  private getSettingsChildren(): TreeItem[] {
    const config = workspace.getConfiguration('emc')
    const items: TreeItem[] = []

    // Bin check setting
    const binCheckEnabled = config.get('checkBinary', true)
    const binCheckItem = new TreeItem(`Bin Check: ${binCheckEnabled ? 'On' : 'Off'}`, TreeItemCollapsibleState.None)
    binCheckItem.contextValue = 'emcSettingBinCheck'
    binCheckItem.iconPath = new ThemeIcon(binCheckEnabled ? 'check' : 'close')
    binCheckItem.command = {
      command: 'emc.toggleBinCheck',
      title: 'Toggle Bin Check'
    }
    items.push(binCheckItem)

    // Video quality setting
    const videoQuality = config.get('videoQuality', 23)
    const videoQualityItem = new TreeItem(`Video Quality: ${videoQuality}`, TreeItemCollapsibleState.None)
    videoQualityItem.contextValue = 'emcSettingVideoQuality'
    videoQualityItem.iconPath = new ThemeIcon('device-camera-video')
    videoQualityItem.command = {
      command: 'emc.changeVideoQuality',
      title: 'Change Video Quality'
    }
    items.push(videoQualityItem)

    // Audio quality setting
    const audioQuality = config.get('audioQuality', 4)
    const audioQualityItem = new TreeItem(`Audio Quality: ${audioQuality}`, TreeItemCollapsibleState.None)
    audioQualityItem.contextValue = 'emcSettingAudioQuality'
    audioQualityItem.iconPath = new ThemeIcon('unmute')
    audioQualityItem.command = {
      command: 'emc.changeAudioQuality',
      title: 'Change Audio Quality'
    }
    items.push(audioQualityItem)

    // GPU setting
    const gpuEnabled = config.get('enableGpuAcceleration', false)
    const gpuItem = new TreeItem(`GPU: ${gpuEnabled ? 'On' : 'Off'}`, TreeItemCollapsibleState.None)
    gpuItem.contextValue = 'emcSettingGpu'
    gpuItem.iconPath = new ThemeIcon(gpuEnabled ? 'vm-active' : 'vm-outline')
    gpuItem.command = {
      command: 'emc.toggleGpu',
      title: 'Toggle GPU'
    }
    items.push(gpuItem)

    return items
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

  // QuickPickItem can have icon
  getConvertFormatOptions(): QuickPickItem[] {
    const options = []
    const isImageConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
    })
    if (isImageConvertible) options.push({ label: MediaFileType.JPG, description: 'Convert to JPG' })

    const vFormat = ['avi', 'flv', 'mkv', 'mp4', 'ts', 'webm', 'wmv']
    const isVideoConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && vFormat.includes(ext)
    })
    if (isVideoConvertible) options.push({ label: MediaFileType.MP4, description: 'Convert to MP4' })

    const aFormat = ['ape', 'flac', 'mp3', 'wav', 'wma'].concat(vFormat)
    const isAudioConvertible = this.queue.every((file) => {
      const ext = file.fsPath.split('.').pop()?.toLowerCase()
      return ext && aFormat.includes(ext)
    })
    if (isAudioConvertible) {
      options.push({ label: MediaFileType.MP3, description: 'Convert to MP3' })
      options.push({ label: MediaFileType.WAV, description: 'Convert to WAV' })
    }
    return options
  }

  isQueueConvertible(): boolean {
    if (this.queue.length === 0) return false
    if (this.getConvertFormatOptions().length === 0) return false
    return true
  }

  async showQueueInfo(): Promise<void> {
    if (this.queue.length === 0) {
      showInformationMessage('Queue is empty.')
      return
    }

    // Define type categories
    const imageExts = ['jpg', 'jpeg', 'png', 'webp']
    const videoExts = ['avi', 'flv', 'mkv', 'mp4', 'ts', 'webm', 'wmv']
    const audioExts = ['ape', 'flac', 'mp3', 'wav', 'wma']

    // Categorize files and count types per category
    type Category = 'image' | 'video' | 'audio' | 'other'
    const categoryTypeCount: Record<Category, Record<string, number>> = {
      image: {},
      video: {},
      audio: {},
      other: {}
    }
    const categoryCount: Record<Category, number> = {
      image: 0,
      video: 0,
      audio: 0,
      other: 0
    }
    let totalSize = 0

    for (const file of this.queue) {
      const ext = file.fsPath.split('.').pop()?.toLowerCase() || 'unknown'
      let cat: Category
      if (imageExts.includes(ext)) cat = 'image'
      else if (videoExts.includes(ext)) cat = 'video'
      else if (audioExts.includes(ext)) cat = 'audio'
      else cat = 'other'

      categoryCount[cat]++
      categoryTypeCount[cat][ext] = (categoryTypeCount[cat][ext] || 0) + 1

      const stat = await (await import('fs/promises')).stat(file.fsPath)
      totalSize += stat.size
    }

    // Build summary per category
    const categorySummary = Object.entries(categoryCount)
      .filter(([, count]) => count > 0)
      .map(([cat, count]) => {
        const types = Object.entries(categoryTypeCount[cat as Category])
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ext, cnt]) => `${ext}-${cnt}`)
          .join(', ')
        return `  ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${count} (${types})`
      })
      .join('\n')

    const availableFormats = this.getConvertFormatOptions().map(option => option.label).join(', ')

    showInformationMessage(
      `Queue: ${this.queue.length} file(s)\n` +
      `Categories:\n${categorySummary}\n` +
      `Total size: ${pb(totalSize)}\n` +
      `Available conversion: ${availableFormats}`,
      { modal: true }
    )
  }
}
