const fetch = require('node-fetch')

const registerService = ({ hostname, port, serviceInfos }) => {
  return fetch(`http://${hostname}:${port}/register`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(serviceInfos),
  }).then(res => res.json())
}

const pingResponse = (uuid) => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(uuid)
})

const generateServiceAPIHelp = value => {
  return Object.entries(value).reduce((acc, [ verb, paths ]) => {
    return paths.reduce((acc, path) => {
      return acc
    }, acc)
  }, {})
}

const generateServiceAPI = ({ type, value }) => {
  switch(type) {
    case 'REST': return generateServiceAPIHelp(value)
    case 'GraphQL': return {}
    default: return {}
  }
}

const generateServicesAPI = interfaces => {
  return Object.entries(interfaces).reduce((acc, [ serviceName, interf ]) => {
    return {
      ...acc,
      [serviceName]: generateServiceAPI(interf),
    }
  }, {})
}

const pingOrHandle = (glob, handler, request) => (uuid) => {
  const { url, body } = request
  if (url.pathname === '/heartbeat') {
    if (body !== glob.interfaces) {
      glob.interfaces = body
      glob.services = glob.interfaces // generateServicesAPI(JSON.parse(glob.interfaces))
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
