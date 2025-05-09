import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode'

export default class BatchTreeViewProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>()
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

  private queue: string[] = []; // Queue to store media files

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      // Display the queue as tree items
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

  addToQueue(file: string): void {
    this.queue.push(file)
    this.refresh()
  }

  removeFromQueue(file: string): void {
    this.queue = this.queue.filter((item) => item !== file)
    this.refresh()
  }
}
