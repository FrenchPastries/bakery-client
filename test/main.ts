import * as millefeuille from '@frenchpastries/millefeuille'
import { response } from '@frenchpastries/millefeuille/response'
import * as assemble from '@frenchpastries/assemble'
import * as customer from '../src/customer'

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
  assemble.del('/', async () => response('OK')),
  assemble.notFound(async () => ({ statusCode: 404 })),
])

const customer_ = customer.register({ router: allRoutes })

millefeuille.create(
  customer_.middleware(async (request: any) => {
    return allRoutes(request)
  }),
  { port }
)

setInterval(async () => {
  fetch('http://localhost:12345')
    .then(() => console.log('Fetch success'))
    .catch(console.log)
  await customer_.ready()
  const response = await customer_.services.customer.get()
  console.log('Customer', await response.text())
}, 5000)

console.log(`-----> Server started on port ${port}.`)
