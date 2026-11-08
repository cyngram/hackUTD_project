// Fetch JSON from our Express API and throw a readable error if it fails
export async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`Request failed: ${path} (${res.status})`);
  return res.json();
}
