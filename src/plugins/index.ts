import { registry } from '../engine/registry'
import { classicPlugin } from './classic'

export function registerBuiltins(): void {
  if (!registry.has(classicPlugin.id)) registry.register(classicPlugin)
}
