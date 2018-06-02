
SOURCES = $(sort $(wildcard lib/*.js))

TARGETS += dist/protocolloadfallbackhandler.js
TARGETS += dist/protocolloadfallbackhandler.min.js
TARGETS += dist/protocolloadfallbackhandler.min.js.map

all: $(TARGETS)

dist/protocolloadfallbackhandler.js: $(SOURCES)
	mkdir -p dist
	printf '"use strict";\n\n' > $@
	printf 'console.warn(' >> $@
	printf   '"'"protocolloadfallbackhandler.js is depracted, since the browsers debugger won't show the original files and linenumbers.\\\\n" >> $@
	printf   'Use protocolloadfallbackhandler.min.js and protocolloadfallbackhandler.min.js.map instead."' >> $@
	printf ');\n\n' >> $@
	cat $^ >> $@

dist/protocolloadfallbackhandler.min.js dist/protocolloadfallbackhandler.min.js.map: $(SOURCES)
	cd dist && echo '"use strict";' | ../node_modules/uglify-es/bin/uglifyjs \
          --mangle --compress -o protocolloadfallbackhandler.min.js \
          --source-map url=protocolloadfallbackhandler.min.js.map -- /dev/stdin $(addprefix ../,$^)

clean:
	rm -f $(TARGETS)
