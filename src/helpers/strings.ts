export const camelize = (text: string) => {
  return text.replace(/^([A-Z])|[\s-_]+(\w)/g, function (match, p1, p2) {
    if (p2) return p2.toUpperCase()
    return p1.toLowerCase()
  })
}
