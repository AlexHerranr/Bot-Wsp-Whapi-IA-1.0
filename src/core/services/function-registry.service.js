"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionRegistryService = void 0;
// src/core/services/function-registry.service.ts
const tsyringe_1 = require("tsyringe");
let FunctionRegistryService = (() => {
    let _classDecorators = [(0, tsyringe_1.singleton)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var FunctionRegistryService = _classThis = class {
        constructor() {
            this.functions = new Map();
            this.registrationHistory = [];
        }
        register(name, func, source) {
            if (this.functions.has(name)) {
                console.warn(`Function ${name} is being overridden. Previous registration will be replaced.`);
            }
            this.functions.set(name, func);
            this.registrationHistory.push({
                name,
                timestamp: new Date(),
                source: source || 'unknown'
            });
            // Solo log en consola, el log técnico lo maneja el plugin
            console.log(`✅ ${name} registered`);
        }
        async execute(name, args, context) {
            const func = this.functions.get(name);
            if (!func) {
                const availableFunctions = this.list();
                throw new Error(`Function '${name}' not found. Available functions: ${availableFunctions.join(', ')}`);
            }
            try {
                console.log(`🔧 Executing function: ${name}`);
                const startTime = Date.now();
                // Log detallado de function args/result si variable de entorno está activa
                if (process.env.DETAILED_FUNCTION_LOGS === 'true') {
                    console.log(`🔍 Function ${name} args:`, JSON.stringify(args, null, 2));
                }
                const result = await func(args, context);
                const executionTime = Date.now() - startTime;
                console.log(`✅ Function ${name} completed in ${executionTime}ms`);
                // Log detallado del resultado si variable de entorno está activa
                if (process.env.DETAILED_FUNCTION_LOGS === 'true') {
                    console.log(`🔍 Function ${name} result:`, JSON.stringify(result, null, 2));
                }
                return result;
            }
            catch (error) {
                console.error(`❌ Function ${name} failed:`, error.message);
                throw new Error(`Function execution failed: ${error.message}`);
            }
        }
        has(name) {
            return this.functions.has(name);
        }
        list() {
            return Array.from(this.functions.keys()).sort();
        }
        getRegistrationHistory() {
            return [...this.registrationHistory];
        }
        getStats() {
            return {
                totalFunctions: this.functions.size,
                registrationHistory: this.registrationHistory.length,
                availableFunctions: this.list()
            };
        }
        clear() {
            this.functions.clear();
            this.registrationHistory = [];
            console.log('🧹 Function registry cleared');
        }
        unregister(name) {
            const existed = this.functions.delete(name);
            if (existed) {
                console.log(`🗑️ Function unregistered: ${name}`);
            }
            return existed;
        }
        // Nuevo método para Responses API
        getFunction(name) {
            const func = this.functions.get(name);
            if (!func)
                return undefined;
            return {
                handler: func,
                name: name,
                description: `Function ${name}`, // Esto debería venir de metadata
                parameters: {} // Esto debería venir de metadata
            };
        }
        // Nuevo método para obtener todas las funciones con metadata
        getAllFunctions() {
            const result = [];
            for (const [name, func] of this.functions) {
                result.push({
                    name,
                    handler: func,
                    description: `Function ${name}`, // Por defecto
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                });
            }
            return result;
        }
    };
    __setFunctionName(_classThis, "FunctionRegistryService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        FunctionRegistryService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return FunctionRegistryService = _classThis;
})();
exports.FunctionRegistryService = FunctionRegistryService;
