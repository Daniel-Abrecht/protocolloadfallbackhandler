#!/usr/bin/env node

var uglify = require("uglify-es");

process.chdir(__dirname+"/../dist");

var FastSourcemapConcat = require("fast-sourcemap-concat");
var fastSourcemapConcat = new FastSourcemapConcat({
  outputFile: "protocolloadfallbackhandler.js"
});

var dir = '../lib/';

var fs = require('fs');
var files = fs.readdirSync(dir).filter(x=>/\.js/.test(x)).sort();
for( let file of files )
  fastSourcemapConcat.addFile(dir+file);

fastSourcemapConcat.end().then(()=>{
  var result = uglify.minify({
    "protocolloadfallbackhandler.js": fs.readFileSync("protocolloadfallbackhandler.js", "utf8")
  }, {
    sourceMap: {
      content: fs.readFileSync("protocolloadfallbackhandler.map", "utf8"),
      filename: "protocolloadfallbackhandler.min.js",
      url: "protocolloadfallbackhandler.min.map"
    }
  });
  fs.writeFileSync("protocolloadfallbackhandler.min.js",result.code);
  fs.writeFileSync("protocolloadfallbackhandler.min.map",result.map);
});
