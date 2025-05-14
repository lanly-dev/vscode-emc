import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'

export default class TreeViewProvider implements TreeDataProvider<TreeItem> {

  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

  private queue: Uri[] = []; // Queue to store media files

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return Promise.resolve(
        this.queue.map((file) => {
          const item = new TreeItem(file, TreeItemCollapsibleState.None);
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
    this.refresh()
  }

  removeFromQueue(file: Uri): void {
    this.queue = this.queue.filter((item) => item !== file)
    this.refresh()
  }
}
