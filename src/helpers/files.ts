import * as path from 'path'
import * as fs from 'fs'

export const findPackageJson = (filePath = process.cwd()): any => {
  const pjsonPath = path.resolve(filePath, 'package.json')
  const existingPjson = fs.existsSync(pjsonPath)
  if (existingPjson) {
    const pjsonContent = fs.readFileSync(pjsonPath, 'utf-8')
    return JSON.parse(pjsonContent)
  } else {
    if (filePath === '/') throw new Error('No package.json found in file tree.')
    const parentDirectory = path.resolve(filePath, '..')
    return findPackageJson(parentDirectory)
  }
}
