
SOURCES = $(sort $(wildcard lib/*.js))

TARGETS += dist/protocolloadfallbackhandler.js
TARGETS += dist/protocolloadfallbackhandler.min.js
#TARGETS += dist/protocolloadfallbackhandler.js

all: $(TARGETS)

dist/protocolloadfallbackhandler.js: $(SOURCES)
	mkdir -p dist
	cat $^ > $@

dist/protocolloadfallbackhandler.min.js: dist/protocolloadfallbackhandler.js
	./node_modules/uglify-es/bin/uglifyjs --mangle --compress -o dist/protocolloadfallbackhandler.min.js -- dist/protocolloadfallbackhandler.js

clean:
	rm -f dist/protocolloadfallbackhandler.js
