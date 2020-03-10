const fetch = require('node-fetch')
const path = require('path')
const fs = require('fs')

const { HOSTNAME, PORT } = process.env

const lastPart = name => {
  return name.split('/').pop()
}

const correctServiceInfos = serviceInfos => {
  const { name, version } = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), 'package.json'),
    'utf8'
  ))
  return {
    name: serviceInfos.name || lastPart(name),
    version: serviceInfos.version || version,
    state: serviceInfos.state || 'Not defined',
    address: serviceInfos.address || `${HOSTNAME}:${PORT}`,
    interface: serviceInfos.interface,
  }
}

class RegisterService {
  constructor({ hostname, port, serviceInfos }) {
    this.state = 'disconnected'
    this.serviceInfos = JSON.stringify(correctServiceInfos(serviceInfos))
    this.bakeryURL = `http://${hostname}:${port}/register`
    this.connect()
  }

  async connect() {
    try {
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.serviceInfos,
      }
      const response = await fetch(this.bakeryURL, options)
      this.value = await response.json()
      this.state = 'connected'
    } catch (error) {
      console.error(error)
      console.error('Unable to connect to Bakery. Will retry in 5s.')
      setTimeout(() => this.connect(), 5000)
    }
  }

  isConnected() {
    return this.state === 'connected'
  }

  uuid() {
    return this.value
  }
}

module.exports = RegisterService
