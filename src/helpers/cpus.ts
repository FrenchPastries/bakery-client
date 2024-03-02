import * as os from 'os'

export const computeLoad = () => {
  const cpus = os.cpus()
  return cpus.map((cpu) => {
    const noIdle = Object.entries(cpu.times)
      .filter(([key]) => key !== 'idle')
      .reduce((acc, [_, val]) => acc + val, 0)
    const total = noIdle + cpu.times.idle
    return (noIdle * 100) / total
  })
}
