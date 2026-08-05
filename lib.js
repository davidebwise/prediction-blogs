function deleteKeys(obj, paths) {
  for (const path of paths) {
    const keys = path.split(".");
    const lastKey = keys.pop();

    let current = obj;

    for (const key of keys) {
      if (
        current === null ||
        typeof current !== "object" ||
        !(key in current)
      ) {
        current = null;
        break;
      }

      current = current[key];
    }

    if (current && lastKey) {
      delete current[lastKey];
    }
  }

  return obj;
}

module.exports = { deleteKeys };
