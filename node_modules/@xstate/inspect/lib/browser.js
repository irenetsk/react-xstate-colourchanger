'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var _tslib = require('./_virtual/_tslib.js');
var xstate = require('xstate');
var utils$1 = require('xstate/lib/utils');
var utils = require('./utils.js');
var inspectMachine = require('./inspectMachine.js');

var serviceMap = new Map();
function createDevTools() {
    var services = new Set();
    var serviceListeners = new Set();
    return {
        services: services,
        register: function (service) {
            services.add(service);
            serviceMap.set(service.sessionId, service);
            serviceListeners.forEach(function (listener) { return listener(service); });
            service.onStop(function () {
                services.delete(service);
                serviceMap.delete(service.sessionId);
            });
        },
        unregister: function (service) {
            services.delete(service);
            serviceMap.delete(service.sessionId);
        },
        onRegister: function (listener) {
            serviceListeners.add(listener);
            services.forEach(function (service) { return listener(service); });
            return {
                unsubscribe: function () {
                    serviceListeners.delete(listener);
                }
            };
        }
    };
}
var defaultInspectorOptions = {
    url: 'https://statecharts.io/inspect',
    iframe: function () {
        return document.querySelector('iframe[data-xstate]');
    },
    devTools: function () {
        var devTools = createDevTools();
        globalThis.__xstate__ = devTools;
        return devTools;
    }
};
function inspect(options) {
    var _a = _tslib.__assign(_tslib.__assign({}, defaultInspectorOptions), options), iframe = _a.iframe, url = _a.url, devTools = _a.devTools;
    var resolvedIframe = utils.getLazy(iframe);
    if (resolvedIframe === null) {
        console.warn('No suitable <iframe> found to embed the inspector. Please pass an <iframe> element to `inspect(iframe)` or create an <iframe data-xstate></iframe> element.');
        return undefined;
    }
    var resolvedDevTools = utils.getLazy(devTools);
    var inspectMachine$1 = inspectMachine.createInspectMachine(resolvedDevTools);
    var inspectService = xstate.interpret(inspectMachine$1).start();
    var listeners = new Set();
    var sub = inspectService.subscribe(function (state) {
        listeners.forEach(function (listener) { return listener.next(state); });
    });
    var targetWindow;
    var client;
    var messageHandler = function (event) {
        if (typeof event.data === 'object' &&
            event.data !== null &&
            'type' in event.data) {
            if (resolvedIframe && !targetWindow) {
                targetWindow = resolvedIframe.contentWindow;
            }
            if (!client) {
                client = {
                    send: function (e) {
                        targetWindow.postMessage(e, url);
                    }
                };
            }
            inspectService.send(_tslib.__assign(_tslib.__assign({}, event.data), { client: client }));
        }
    };
    window.addEventListener('message', messageHandler);
    window.addEventListener('unload', function () {
        inspectService.send({ type: 'unload' });
    });
    if (resolvedIframe === false) {
        targetWindow = window.open(url, 'xstateinspector');
    }
    resolvedDevTools.onRegister(function (service) {
        var _a;
        inspectService.send({
            type: 'service.register',
            machine: utils.stringify(service.machine),
            state: utils.stringify(service.state || service.initialState),
            sessionId: service.sessionId,
            id: service.id,
            parent: (_a = service.parent) === null || _a === void 0 ? void 0 : _a.sessionId
        });
        inspectService.send({
            type: 'service.event',
            event: utils.stringify((service.state || service.initialState)._event),
            sessionId: service.sessionId
        });
        // monkey-patch service.send so that we know when an event was sent
        // to a service *before* it is processed, since other events might occur
        // while the sent one is being processed, which throws the order off
        var originalSend = service.send.bind(service);
        service.send = function inspectSend(event, payload) {
            inspectService.send({
                type: 'service.event',
                event: utils.stringify(utils$1.toSCXMLEvent(utils$1.toEventObject(event, payload))),
                sessionId: service.sessionId
            });
            return originalSend(event, payload);
        };
        service.subscribe(function (state) {
            inspectService.send({
                type: 'service.state',
                state: utils.stringify(state),
                sessionId: service.sessionId
            });
        });
        service.onStop(function () {
            inspectService.send({
                type: 'service.stop',
                sessionId: service.sessionId
            });
        });
    });
    if (resolvedIframe) {
        resolvedIframe.addEventListener('load', function () {
            targetWindow = resolvedIframe.contentWindow;
        });
        resolvedIframe.setAttribute('src', url);
    }
    return {
        send: function (event) {
            inspectService.send(event);
        },
        subscribe: function (next, onError, onComplete) {
            var observer = utils$1.toObserver(next, onError, onComplete);
            listeners.add(observer);
            return {
                unsubscribe: function () {
                    listeners.delete(observer);
                }
            };
        },
        disconnect: function () {
            inspectService.send('disconnect');
            window.removeEventListener('message', messageHandler);
            sub.unsubscribe();
        }
    };
}
function createWindowReceiver(options) {
    var _a = options || {}, _b = _a.window, ownWindow = _b === void 0 ? window : _b, _c = _a.targetWindow, targetWindow = _c === void 0 ? window.self === window.top ? window.opener : window.parent : _c;
    var observers = new Set();
    var handler = function (event) {
        var data = event.data;
        if (utils.isReceiverEvent(data)) {
            observers.forEach(function (listener) { return listener.next(utils.parseReceiverEvent(data)); });
        }
    };
    ownWindow.addEventListener('message', handler);
    var actorRef = {
        id: 'xstate.windowReceiver',
        send: function (event) {
            if (!targetWindow) {
                return;
            }
            targetWindow.postMessage(event, '*');
        },
        subscribe: function (next, onError, onComplete) {
            var observer = utils$1.toObserver(next, onError, onComplete);
            observers.add(observer);
            return {
                unsubscribe: function () {
                    observers.delete(observer);
                }
            };
        },
        stop: function () {
            observers.clear();
            ownWindow.removeEventListener('message', handler);
        }
    };
    actorRef.send({
        type: 'xstate.inspecting'
    });
    return actorRef;
}
function createWebSocketReceiver(options) {
    var _a = options.protocol, protocol = _a === void 0 ? 'ws' : _a;
    var ws = new WebSocket(protocol + "://" + options.server);
    var observers = new Set();
    var actorRef = {
        id: 'xstate.webSocketReceiver',
        send: function (event) {
            ws.send(JSON.stringify(event));
        },
        subscribe: function (next, onError, onComplete) {
            var observer = utils$1.toObserver(next, onError, onComplete);
            observers.add(observer);
            return {
                unsubscribe: function () {
                    observers.delete(observer);
                }
            };
        }
    };
    ws.onopen = function () {
        actorRef.send({
            type: 'xstate.inspecting'
        });
    };
    ws.onmessage = function (event) {
        if (typeof event.data !== 'string') {
            return;
        }
        try {
            var eventObject_1 = JSON.parse(event.data);
            if (utils.isReceiverEvent(eventObject_1)) {
                observers.forEach(function (observer) {
                    observer.next(utils.parseReceiverEvent(eventObject_1));
                });
            }
        }
        catch (e) {
            console.error(e);
        }
    };
    ws.onerror = function (err) {
        observers.forEach(function (observer) {
            var _a;
            (_a = observer.error) === null || _a === void 0 ? void 0 : _a.call(observer, err);
        });
    };
    return actorRef;
}

exports.createDevTools = createDevTools;
exports.createWebSocketReceiver = createWebSocketReceiver;
exports.createWindowReceiver = createWindowReceiver;
exports.inspect = inspect;
exports.serviceMap = serviceMap;
