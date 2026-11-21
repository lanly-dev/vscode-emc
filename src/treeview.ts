import { commands, QuickPickItem, window, workspace, ThemeIcon } from 'vscode'
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'
import { MediaFileType } from './interfaces'
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import pb from 'pretty-bytes'

const { showInformationMessage } = window

export default class TreeViewProvider implements TreeDataProvider<TreeItem> {

  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

  public queue: Uri[] = []
  public isBinExisting: boolean = false
  public ffmpegVersion: string | null = null

  constructor(public ffmpegPath: string) {
    this.isBinExisting = fs.existsSync(this.ffmpegPath)
    this.getFfmpegVersion()
    this.updateBinStatus()
  }

  refresh(): void {
    this.isBinExisting = fs.existsSync(this.ffmpegPath)
    this.getFfmpegVersion()
    this.updateBinStatus()
    this._onDidChangeTreeData.fire()
  }

  private getFfmpegVersion(): void {
    if (!fs.existsSync(this.ffmpegPath)) {
      this.ffmpegVersion = null
      return
    }
    try {
      const result = spawnSync(this.ffmpegPath, ['-version'], { encoding: 'utf8', maxBuffer: 1024 * 1024 })
      if (result.status === 0 && result.stdout) {
        const firstLine = result.stdout.split('\n')[0]
        // Example: "ffmpeg version 7.0.1 Copyright (c) ..."
        // Example: "ffmpeg version N-125907-ga7e72069f1-20260802 Copyright ..."
        const match = firstLine.match(/ffmpeg version (\S+)/)
        if (match) {
          let ver = match[1]
          // Strip build metadata after the version for snapshot builds:
          // "N-125907-ga7e72069f1-20260802" -> keep "N-125907"
          const snap = ver.match(/^(N-\d+)/)
          if (snap) ver = snap[1]
          this.ffmpegVersion = ver
        } else this.ffmpegVersion = 'unknown'
      } else this.ffmpegVersion = 'unknown'
    } catch {
      this.ffmpegVersion = null
    }
  }

  private updateItemCount(): void {
    commands.executeCommand('setContext', 'EMC_ITEM_COUNT', this.queue.length)
  }

  private updateBatchConvertibleStatus(): void {
    const isConvertible = this.isQueueConvertible()
    commands.executeCommand('setContext', 'EMC_QUEUE_CONVERTIBLE', isConvertible)
  }

  private updateBinStatus(): void {
    commands.executeCommand('setContext', 'EMC_BIN_MISSING', !this.isBinExisting)
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      // If it's the Settings item, return its children
      if (element.contextValue === 'EMC_SETTINGS_ITEM') return Promise.resolve(this.getSettingsChildren())
      // If it's the Custom Quality item, return its children
      if (element.contextValue === 'EMC_SETTING_QUALITY') return Promise.resolve(this.getCustomQualityChildren())
      if (element.contextValue === 'EMC_QUEUE_LABEL_ITEM') return Promise.resolve(this.getQueueChildren())
      return Promise.resolve([])
    }

    // Root level: Settings + Queue label ⬇️
    const items: TreeItem[] = []

    // Add Settings item at the top
    const settingsItem = new TreeItem('Settings', TreeItemCollapsibleState.Collapsed)
    settingsItem.contextValue = 'EMC_SETTINGS_ITEM'
    settingsItem.iconPath = new ThemeIcon('settings-gear')
    items.push(settingsItem)

    const queueLabel = `Queue (${this.queue.length})`
    const queueItem = new TreeItem(queueLabel, TreeItemCollapsibleState.Expanded)
    queueItem.contextValue = 'EMC_QUEUE_LABEL_ITEM'
    queueItem.iconPath = new ThemeIcon('list-selection')
    items.push(queueItem)

    return Promise.resolve(items)
  }

  private getSettingsChildren(): TreeItem[] {
    const config = workspace.getConfiguration('emc')
    const items: TreeItem[] = []

    // Bin check setting
    const binLabel = this.ffmpegVersion
      ? `Bin version: ${this.ffmpegVersion}`
      : `Bin: ${this.isBinExisting ? 'present ✔️' : 'missing ❌'}`
    const binCheckItem = new TreeItem(binLabel, TreeItemCollapsibleState.None)
    binCheckItem.contextValue = 'EMC_SETTING_BIN_CHECK'
    binCheckItem.iconPath = new ThemeIcon(this.isBinExisting ? 'check' : 'warning')
    // Add download command when binary is missing
    items.push(binCheckItem)

    // GPU setting
    const gpuEnabled = config.get('enableGpuAcceleration', false)
    const gpuItem = new TreeItem(`GPU enabled: ${gpuEnabled ? '✔️' : '❌'}`, TreeItemCollapsibleState.None)
    gpuItem.contextValue = 'EMC_SETTING_GPU'
    gpuItem.iconPath = new ThemeIcon(gpuEnabled ? 'vm-active' : 'vm-outline')
    items.push(gpuItem)

    // Custom Quality setting (parent with collapsible children)
    const useCustomQuality = config.get('useCustomQuality', false)
    const customQualityLabel = `Custom Quality: ${useCustomQuality ? '✔️' : '❌'}`
    const state = useCustomQuality ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
    const customQualityItem = new TreeItem(customQualityLabel, state)
    customQualityItem.contextValue = 'EMC_SETTING_QUALITY'
    customQualityItem.iconPath = new ThemeIcon('dashboard')
    items.push(customQualityItem)

    return items
  }

  private getCustomQualityChildren(): TreeItem[] {
    const config = workspace.getConfiguration('emc')
    const items: TreeItem[] = []

    // Audio quality setting
    const audioQuality = config.get('audioQuality', 4)
    const audioQualityItem = new TreeItem(`Audio Quality: ${audioQuality}`, TreeItemCollapsibleState.None)
    audioQualityItem.contextValue = 'EMC_SETTING_AUDIO_QUALITY'
    audioQualityItem.iconPath = new ThemeIcon('unmute')
    items.push(audioQualityItem)

    // Video quality setting
    const videoQuality = config.get('videoQuality', 23)
    const videoQualityItem = new TreeItem(`Video Quality: ${videoQuality}`, TreeItemCollapsibleState.None)
    videoQualityItem.contextValue = 'EMC_SETTING_VIDEO_QUALITY'
    videoQualityItem.iconPath = new ThemeIcon('device-camera-video')
    items.push(videoQualityItem)

    return items
  }

  private getQueueChildren(): TreeItem[] {
    if (this.queue.length === 0) {
      const emptyItem = new TreeItem('Queue is empty', TreeItemCollapsibleState.None)
      emptyItem.contextValue = 'EMC_QUEUE_EMPTY'
      emptyItem.iconPath = new ThemeIcon('circle-slash')
      return [emptyItem]
    }
    return this.queue.map((file) => {
      const item = new TreeItem(file, TreeItemCollapsibleState.None)
      item.contextValue = 'EMC_TREEVIEW_ITEM'
      return item
    })
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
