import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, commands } from 'vscode'

export default class BatchTreeViewProvider implements TreeDataProvider<TreeItem> {

  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

  private queue: Uri[] = []

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  private updateBatchItemCount(): void {
    commands.executeCommand('setContext', 'emcBatchItemCount', this.queue.length)
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
    console.log(`Added to queue: ${file}`)
    this.updateBatchItemCount()
    this.refresh()
  }

  removeFromQueue(file: Uri): void {
    this.queue = this.queue.filter((item) => item !== file)
    this.updateBatchItemCount()
    this.refresh()
  }

  clearQueue(): void {
    this.queue = []
    console.log('Queue cleared')
    this.updateBatchItemCount()
    this.refresh()
  }
}
