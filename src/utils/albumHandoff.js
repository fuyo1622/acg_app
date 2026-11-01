// Files chosen on a list page reach the album import page in memory. A file picker only
// opens from a tap, so it opens on the list page, and browser history cannot carry File
// objects in every browser.
let pendingFiles = [];

export function handOffAlbumFiles(files) {
  pendingFiles = Array.from(files ?? []);
}

export function takeAlbumFiles() {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}
