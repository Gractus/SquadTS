// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(target: Record<any, any>, source: Record<any, any>) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], value)
    } else if (Array.isArray(value)) {
      target[key] = Array.isArray(target[key])
        ? [...target[key], ...value]
        : [...value]
    } else {
      if (target[key] === undefined) target[key] = value
    }
  }
  return target
}
