// JSON script elements are parsed as HTML before JSON.parse sees their contents.
export function serializeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
