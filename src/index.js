const fetch = require('node-fetch')

const registerService = ({ hostname, port, serviceInfos }) => {
  return fetch(`http://${hostname}:${port}/register`, {
    method: 'post',
    body: JSON.stringify(serviceInfos),
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

const generateServicesAPI = interfaces => {
  return {}
}

const pingOrHandle = (glob, handler, request) => (uuid) => {
  const { url, body } = request
  if (url.pathname === '/heartbeat') {
    if (body !== glob.interfaces) {
      console.log(body);
      console.log(glob.interfaces);
      glob.interfaces = body
      glob.services = generateServicesAPI(JSON.parse(glob.interfaces))
    }
    return pingResponse(uuid)
  } else {
    const services = glob.services
    const newRequest = { ...request, services }
    return handler(newRequest)
  }
}

const responseError = (error) => {
  console.error(error)
  return {
    statusCode: 500,
    body: 'Unable to register to Registry.'
  }
}

const responsePingOrHandle = (registering) => {
  const glob = {
    interfaces: {},
    services: {},
  }
  return (handler) => (request) => {
    return registering
      .then(pingOrHandle(glob, handler, request))
      .catch(responseError)
  }
}

const register = (options) => {
  const registering = registerService(options)
  return responsePingOrHandle(registering)
}

module.exports = {
  register
}
