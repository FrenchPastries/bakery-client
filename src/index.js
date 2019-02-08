const http = require('http')

const register = (hostname, port, service) => {

  const options = {
    hostname,
    port,
    path: '/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': JSON.stringify(service).length
    },
    body: JSON.stringify(service)
  }

  const req = http.request(options, (res) => {
    console.log('res', res)
    console.log(`statusCode: ${res.statusCode}`)
    let data = ''
    res.on('data', (d) => {
      data += d
    })

    res.on('end', () => {
      serviceUuid = JSON.parse(data)
      console.log(serviceUuid)
    })
  })

  req.on('error', (error) => {
    console.error(error)
  })

  req.write(JSON.stringify(service))
  req.end()

}
exports.default = {
  register
}
