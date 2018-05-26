# protocolloadfallbackhandler.js

Currently, when adding an &lt;img> or &lt;video> to a webpage or when doing a fetch() in js,
most browsers will only support http and https URLs. Specify a magnet uri as image source, for example,
and it probably just won't work at all. The idea behind protocolloadfallbackhandler.js is
to first give the browser a chance to load the resource, and if it fails, check if a protocol
handler for that protocol has been specified, and if there is one, use it to load the resource.
Changing what happens when such URIs are opened, however, is out of scope of this project and
can already be changed by other means.

# APIs

## Protocol Handlers

Protocol handlers are used as a fallback if the browser fails to load a resource from a URI depending on the URI scheme.
A protocol handler needs at least the fetch or the makeVirtualURI API. The fetch API is preferred, since a resource can
sometimes be used before it is fully loaded, but can be tricky to get right, while makeVirtualURI is easier to implement.

You can register a resource handler using the ```protocolLoadFallbackHandler.setHandler("scheme",your_handler)```.

| Method | Description |
| ------ | ----------- |
| fetch | Must be a full implementation of the fetch Interface that can handle the scheme it was registered for |
| makeVirtualURI(uri) | Make an URL from the URI the browser can understand |
| renderTo(element,uri) | Use the URI as source for an element in a unknown special way. |

## Globals
| Name | What | Default | Purpose |
| ---- | ---- | ------- | ------- |
| protocolLoadFallbackHandler | ProtocolLoadFallbackHandler | | The only instance of the ProtocolLoadFallbackHandler class. |
| sourceIntercepter | SourceIntercepter | | Only instance of the SourceIntercepter class. |
| ProtocolLoadFallbackHandlerError (message,soft) | class | | For creating errors originating from protocol handlers. The soft parameter indicates if the proxy url should be tried as a fallback if possible. |
| nodeTypes | Map | | A Node type name -> Node type map. |
| replaceFetch | Boolean | true | Specifies wether fetch should be replaced so it can handle registered protocols. |
| nativeFetch | Function | | A reference to the browsers own fetch function |
| serviceWorkerDoesHandleLoadFallbackHandlers | Boolean | false | Wether a service worker shall handle registered protocols. |
| serviceWorkerPrefix | string | ```location.origin + "/proxy/"``` | If there is a service worker capable of handling registered protocols, requests it shall handle will be passed to it as an url of the form ```serviceWorkerPrefix + btoa(URI)```. |
| fallbackProxyAvailable | Boolean | false | Wether there is a proxy for handling requests the registered protocol handlers couldn't handle. |
| proxybase | string | ```location.origin + "/proxy/"``` | The url of a proxy for handling failed requests. Such requests will be passed to it as an url of the form ```proxybase + btoa(URI)```. |


## ProtocolLoadFallbackHandler

This class detects if loading a resource failed, and tries to use the registered protocol handlers if that is the case.
It's also used to register protocol handlers. By itself, it only gets errors from nodes attached to the document body.
It can be informed of errors from other sources using the onerror(event) method.

| Method | Description |
| ------ | ----------- |
| getHandler(scheme) | Returns the protocol handler for the given scheme using a promise. |
| setHandler(scheme,handler) | Set a protocol handler for a specific URI scheme |
| removeHandler(scheme) | Remove a protocol handler |
| renderTo(element,uri) | Try to apply the URI to an element. This allows the usage of the MediaSource API and similar stuff. |
| fetch | Same as a browsers fetch method, except that it tries to use the registered protocol handlers as a fallback |
| makeVirtualURI(uri) | Try to create a URL from an URI that the Browser actually supports. Consider using renderTo or fetch instead whenever possible. |


## SourceIntercepter

Intercepts the src and href properties of every Node instance, and renames the original ones to nativeSrc/nativeHref.
This allows the ProtocolLoadFallbackHandler to set a blob url or something similar for the browser to load the resource
from while not changing the uri where the resurece was actually loaded from. When setting a source using one of these
Attributes, it will also register an error handler to inform the ProtocolLoadFallbackHandler when loading one of the
resources fails. This is necessary because an element may not been attached to the document in some cases, like when
loading images to draw in a canvas for example.

It also sets the class "loading", "ready", "loaded", "loaderror" or none when the loadState property of an element is set to one of them. The SourceIntercepter and ProtocolLoadFallbackHandler also try to set that property as accurately as possible, but since there is no unified way to figure out if a resource is loaded, loaded, or the loading failed, and sometimes there is none at all, it's not perfectly accurate and sometimes not set at all.

The SourceIntercepter also defines the property $sourcelock as a boolean for every html element. It's a workaround to only change the source of an element to load when changing the src or href properties, but not the values they return, which is necessary if a fallback protocol handler sets it using an independent library function that doesn't use this library to set the source. The ProtocolLoadFallbackHandler usually takes care of setting this property when necessary.

| Method | Description |
| ------ | ----------- |
| getNativeURI(element) | Get the URI the browser actually used to get the resource from |
| setNativeURI(element,uri) | Set the URL to load, but don't modify the true URI of the resource or what getSource returns. |

## Events

While the ProtocolLoadFallbackHandler tries to stop the propagation of error events if a fallback is available and creates one if an unrecoverable error occures, it's not reliable. Because of this, if all fallbacks fail, it will also create a custom "loaderror" event, which is an instance of ErrorEvent. The "loaderror" event is cancellable. The ProtocolLoadFallbackHandler only sets the loadState property of an element to "loaderror" if the "loaderror" event wasn't cancelled. Other events indicating the start, end, etc. of resource loading should work as expected.
