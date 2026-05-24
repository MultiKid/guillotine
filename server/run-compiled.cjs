const path = require("node:path");
const Module = require("node:module");

const projectRoot = path.resolve(__dirname, "..");
const serverBuildRoot = path.join(projectRoot, ".server-build");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithProjectAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(serverBuildRoot, request.slice(2)),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require(path.join(serverBuildRoot, "server", "index.js"));
