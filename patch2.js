const originalParse = JSON.parse;
JSON.parse = function(text, reviver) {
  if (text === undefined || text === "undefined") {
    throw new Error("JSON.parse called with undefined! Stack trace: " + new Error().stack);
  }
  return originalParse.apply(this, arguments);
};
