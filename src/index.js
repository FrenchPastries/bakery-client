const fetch = require('node-fetch')

const register = (hostname, port, service) => {

  return fetch('http://' + hostname + ':' + port + '/register', {
    method: 'post',
    body: JSON.stringify(service),
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(res => res.json())
}

module.exports = {
  register
}
