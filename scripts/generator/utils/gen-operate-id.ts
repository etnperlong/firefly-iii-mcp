/**
 * Convert a string to title case
 *
 * @param str String to convert
 * @returns Title case string
 */
export function titleCase(str: string): string {
  // Converts snake_case, kebab-case, or path/parts to TitleCase
  return str
    .toLowerCase()
    .replace(/[-_\/](.)/g, (_, char) => char.toUpperCase()) // Handle separators
    .replace(/^{/, '') // Remove leading { from path params
    .replace(/}$/, '') // Remove trailing } from path params
    .replace(/^./, (char) => char.toUpperCase()); // Capitalize first letter
}

/**
 * Generates an operation ID from method and path
 *
 * @param method HTTP method
 * @param path API path
 * @returns Generated operation ID
 */
export function generateOperationId(method: string, path: string): string {
  // Generator: get /users/{userId}/posts -> GetUsersPostsByUserId
  const parts = path.split('/').filter((p) => p); // Split and remove empty parts

  let name = method.toLowerCase(); // Start with method name

  parts.forEach((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      // Append 'By' + ParamName only for the *last* path parameter segment
      if (index === parts.length - 1) {
        name += 'By' + titleCase(part);
      }
      // Potentially include non-terminal params differently if needed, e.g.:
      // else { name += 'With' + titleCase(part); }
    } else {
      // Append the static path part in TitleCase
      name += titleCase(part);
    }
  });

  // Simple fallback if name is just the method (e.g., GET /)
  if (name === method.toLowerCase()) {
    name += 'Root';
  }

  // Ensure first letter is uppercase after potential lowercase method start
  name = name.charAt(0).toUpperCase() + name.slice(1);

  return name;
}