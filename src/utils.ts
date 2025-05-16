import { resolve } from 'path'
import { window, workspace } from 'vscode'
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

// M:SS
export function fmtMSS(ms: number) {
  let s = Math.round(ms / 1000)
  if (s < 60) return `${s} sec`
  return (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s
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

// TODO: could combine with getOutDirectory, add default config later
export function getWorkspacePath(): string | undefined {
  const workspaceFolder = workspace.workspaceFolders?.[0]
  return workspaceFolder?.uri.fsPath
}

export function getOutDirectory(dir: string) {
  const dirName = 'emc' + Math.floor(Date.now() / 1000)
  return resolve(dir, dirName)
}

export function showPrintErrorMsg(error: Error) {
  const msg = 'Error: conversion failed!'
  printToChannel(`${msg} - ${error.message ?? JSON.stringify(error, null, 2)}\n`)
  showErrorMessage(msg)
}
