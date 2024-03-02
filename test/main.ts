import * as millefeuille from '@frenchpastries/millefeuille'
import { response } from '@frenchpastries/millefeuille/response'
import * as assemble from '@frenchpastries/assemble'
// @ts-ignore
import { register } from '../src'
import * as os from 'os'

const port = 12345

const allRoutes = assemble.routes([
  assemble.context('/test1/:testee', [
    assemble.get('/', async () => response('OKK')),
    assemble.get('/test2', async () => response('OK')),
    assemble.post('/test3', async () => response('OK')),
    assemble.any('/ttttt', async () => response('OKKKKKKK')),
  ]),
  assemble.post('/', async () => response('OK')),
  assemble.get('/', async () => response('OK')),
  assemble.post('/t', async () => response('OK')),
  assemble.post('/test1/:testee', async () => ({ statusCode: 200 })),
  assemble.get('/test3', async () => ({ statusCode: 200, body: 'OK' })),
  assemble.get('/test3/test-test', async () => response('OK')),
  assemble.get('/test3/testtest/testtest', async () => response('OK')),
  assemble.notFound(async () => ({ statusCode: 404 })),
])

const serviceInfos = {
  address: `${os.networkInterfaces().en0![1].address}:${port}`,
  interface: {
    type: 'REST',
    value: allRoutes.export(),
  },
} as const

const bakery = register({
  hostname: 'localhost',
  port: 8080,
  serviceInfos,
})

millefeuille.create(
  bakery((request: any) => {
    console.log('services: ', request.services)
    return allRoutes(request)
  }),
  {
    port,
  }
)

setInterval(() => {
  fetch('http://localhost:12345')
    .then(() => {
      console.log('ok')
    })
    .catch(console.log)
}, 5000)

console.log(`-----> Server started on port ${port}.`)
