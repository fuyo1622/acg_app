// jsdom 24 lacks Blob.arrayBuffer() and Blob.text(), which every browser the app supports
// has. These read through FileReader, which jsdom does provide.
function readBlob(blob, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader[method](blob);
  });
}

if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined') {
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      return readBlob(this, 'readAsArrayBuffer');
    };
  }
  if (!Blob.prototype.text) {
    Blob.prototype.text = function text() {
      return readBlob(this, 'readAsText');
    };
  }
}
