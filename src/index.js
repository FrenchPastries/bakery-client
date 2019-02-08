const fetch = require('node-fetch')

const registerService = ({ hostname, port, api }) => {
  return fetch(`http://${hostname}:${port}/register`, {
    method: 'post',
    body: JSON.stringify(api),
    headers: {
      'Content-Type': 'application/json'
    }
  }).then((res) => res.json())
}

const pingResponse = (uuid) => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(uuid)
})

const pingOrHandle = (handler, request) => (uuid) => {
  if (request.url.pathname === '/ping') {
    return pingResponse(uuid)
  } else {
    return handler(request)
  }
}

const responseError = (error) => {
  console.error(error)
  return {
    statusCode: 500,
    body: 'Unable to register to Registry.'
  }
}

const responsePingOrHandle = (registering) => (handler) => (request) => {
  return registering
    .then(pingOrHandle(handler, request))
    .catch(responseError)
}

const register = (options) => {
  const registering = registerService(options)
  return responsePingOrHandle(registering)
}

module.exports = {
  register
}
