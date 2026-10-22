function isArrayIndex(key, length) {
  if (!/^(?:0|[1-9]\d*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index < length;
}

/**
 * Return the first structural difference between two JSON-shaped values.
 * Arrays are walked by index without materializing their potentially large key lists.
 */
function describeDifference(pathSegments, reason) {
  const path = pathSegments.reduce((result, segment) =>
    typeof segment === "number" ? `${result}[${segment}]` : `${result}.${segment}`, "$"
  );
  return `${path} (${reason})`;
}

export function findJsonDifference(expected, actual, pathSegments = [], depth = 0) {
  if (Object.is(expected, actual)) return null;
  if (depth > 256) return describeDifference(pathSegments, "maximum JSON nesting depth exceeded");

  const expectedArray = Array.isArray(expected);
  const actualArray = Array.isArray(actual);
  if (expectedArray || actualArray) {
    if (!expectedArray || !actualArray) return describeDifference(pathSegments, "array/object type differs");
    if (expected.length !== actual.length) return describeDifference([...pathSegments, "length"], "value differs");

    for (const key in expected) {
      if (Object.prototype.hasOwnProperty.call(expected, key) && !isArrayIndex(key, expected.length)) {
        return describeDifference([...pathSegments, key], "unexpected array property");
      }
    }
    for (const key in actual) {
      if (Object.prototype.hasOwnProperty.call(actual, key) && !isArrayIndex(key, actual.length)) {
        return describeDifference([...pathSegments, key], "unexpected array property");
      }
    }

    for (let index = 0; index < expected.length; index += 1) {
      const hasExpected = Object.prototype.hasOwnProperty.call(expected, index);
      const hasActual = Object.prototype.hasOwnProperty.call(actual, index);
      if (hasExpected !== hasActual) return describeDifference([...pathSegments, index], "array hole differs");
      pathSegments.push(index);
      const difference = findJsonDifference(expected[index], actual[index], pathSegments, depth + 1);
      pathSegments.pop();
      if (difference) return difference;
    }
    return null;
  }

  const expectedObject = expected !== null && typeof expected === "object";
  const actualObject = actual !== null && typeof actual === "object";
  if (!expectedObject || !actualObject) return describeDifference(pathSegments, "value differs");
  if (Object.getPrototypeOf(expected) !== Object.getPrototypeOf(actual)) return describeDifference(pathSegments, "object prototype differs");

  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  if (expectedKeys.length !== actualKeys.length) return describeDifference(pathSegments, "object key count differs");
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) return describeDifference([...pathSegments, key], "missing key");
    pathSegments.push(key);
    const difference = findJsonDifference(expected[key], actual[key], pathSegments, depth + 1);
    pathSegments.pop();
    if (difference) return difference;
  }
  return null;
}
