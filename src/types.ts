import { Interface, Service } from '@frenchpastries/bakery'
import type { Router } from '@frenchpastries/assemble'

export type ServiceInfos = Omit<Service, 'uuid' | 'name' | 'version' | 'state' | 'address'> & {
  name?: string
  version?: string
  address?: string
}

export type Options = {
  bakery?: { hostname?: string; port?: number }
  version?: string
  name?: string
  address?: string
  port?: number
  interface?: Interface
  router?: Router
}
