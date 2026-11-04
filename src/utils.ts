import { join, resolve } from 'path'
import { Uri, window, workspace } from 'vscode'
import { existsSync } from 'fs'
import { MediaFileType } from './interfaces'
const { createOutputChannel, showErrorMessage } = window

export const channel = createOutputChannel('Easy Media Converter')

export function printToChannel(text: string) {
  channel.append(`${text}\n`)
}

export function round(num: number) {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

// Format seconds into H:MM:SS or M:SS
export function fmtMSS(ms: number) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} sec`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// Format seconds into "Xh Ym Zs left" format
export function fmtTimeLeft(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s left`
  if (m > 0) return `${m}m ${s}s left`
  return `${s}s left`
}

export function durationToSec(duration: string) {
  const [hours, minutes, seconds] = duration.split(':')
  return Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)
}

export function getOutFile(dir: string, name: string, type: MediaFileType, num?: number) {
  const fileName = `${name}${!num ? '' : `-${num}`}.${type}`
  const outFile = resolve(dir, fileName)
  if (existsSync(outFile)) return getOutFile(dir, name, type, !num ? 1 : ++num)
  return { outFile, fileName }
}

export function getWorkspacePath(): string | undefined {
  const workspaceFolder = workspace.workspaceFolders?.[0]
  return workspaceFolder?.uri.fsPath
}

export function getOutDirName() {
  return 'emc' + getFormattedDate()
}

export async function createDir(path: Uri): Promise<void> {
  await workspace.fs.createDirectory(path)
}

export function showPrintErrorMsg(error: Error) {
  const msg = 'Error: conversion failed!'
  printToChannel(`${msg} - ${error.message ?? JSON.stringify(error, null, 2)}\n`)
  showErrorMessage(msg)
}

export function getFfmpegBinPath(extensionPath: string): string {
  const pathToFfmpeg = join(extensionPath, 'bin', 'ffmpeg')
  if (process.platform === 'win32') return pathToFfmpeg + '.exe'
  return pathToFfmpeg
}

export function getFormattedDate(date: Date = new Date()): string {
  return date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0')
}

// Parse a time like "80", "1:20", "1:20:30" or "1:20.5" into seconds
export function parseTimeToSec(time: string): number | null {
  const t = time.trim()
  if (!t) return null
  // Plain seconds (e.g. 80 or 80.5)
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
  const parts = t.split(':')
  if (parts.length === 2 || parts.length === 3) {
    if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return null
    const [a, b, c] = parts.map(Number)
    if (parts.length === 2) {
      // M:SS
      if (b >= 60) return null
      return a * 60 + b
    }
    // H:MM:SS
    if (b >= 60 || c >= 60) return null
    return a * 3600 + b * 60 + c
  }
  return null
}

// Parse a range input like "1:20 - 2:10" into { startSec, endSec }
export function parseTimeRange(input: string): { startSec: number, endSec: number } | null {
  const parts = input.trim().split(/\s*-\s*/)
  if (parts.length !== 2) return null
  const startSec = parseTimeToSec(parts[0])
  const endSec = parseTimeToSec(parts[1])
  if (startSec === null || endSec === null) return null
  return { startSec, endSec }
}
