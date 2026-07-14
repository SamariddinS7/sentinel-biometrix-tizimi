const originalParse = JSON.parse;
JSON.parse = function(text, reviver) {
  if (text === undefined || text === "undefined") {
    console.error("JSON.parse called with undefined! Stack trace:");
    console.error(new Error().stack);
  }
  return originalParse.apply(this, arguments);
};
