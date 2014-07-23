function checkFramebuffer() {
    var valid = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    switch (valid) {
        case gl.FRAMEBUFFER_UNSUPPORTED:
            throw 'Framebuffer is unsupported';
        case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
            throw 'Framebuffer incomplete attachment';
        case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
            throw 'Framebuffer incomplete dimensions';
        case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
            throw 'Framebuffer incomplete missing attachment';
    }
}

var ScreenAlignedTriangle = (function () {
    function ScreenAlignedTriangle() {
    }
    ScreenAlignedTriangle.draw = function () {
        if (!ScreenAlignedTriangle.vertexBuffer)
            ScreenAlignedTriangle.init();
        else
            gl.bindBuffer(gl.ARRAY_BUFFER, ScreenAlignedTriangle.vertexBuffer);

        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    ScreenAlignedTriangle.init = function () {
        var coordinates = new Float32Array([
            -1.0, -1.0,
            3.0, -1.0,
            -1.0, 3.0]);
        ScreenAlignedTriangle.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ScreenAlignedTriangle.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, coordinates, gl.STATIC_DRAW);
    };
    return ScreenAlignedTriangle;
})();
var ShaderProgram = (function () {
    function ShaderProgram(vertexShaderID, fragmentShaderID) {
        this.vertexShader = this.getShaderFromDOM(vertexShaderID);
        this.fragmentShader = this.getShaderFromDOM(fragmentShaderID);

        this.program = gl.createProgram();
        gl.attachShader(this.program, this.vertexShader);
        gl.attachShader(this.program, this.fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw "Error linking shader (vs:" + vertexShaderID + " ps: " + fragmentShaderID + "): " + gl.getProgramInfoLog(this.program);
        }
    }
    ShaderProgram.prototype.dispose = function () {
        gl.deleteShader(this.vertexShader);
        this.vertexShader = null;
        gl.deleteShader(this.fragmentShader);
        this.fragmentShader = null;
        gl.deleteProgram(this.program);
        this.program = null;
    };

    ShaderProgram.prototype.getShaderFromDOM = function (id) {
        var shaderScript = document.getElementById(id);
        if (!shaderScript) {
            throw "Couldn't get shader script from document! (" + id + ")";
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3)
                str += k.textContent;
            k = k.nextSibling;
        }

        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            throw "Unkown shader type: " + shaderScript.type;
        }

        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw "Error compiling shader (" + id + "): " + gl.getShaderInfoLog(shader);
        }

        return shader;
    };
    return ShaderProgram;
})();

var Rendering = (function () {
    function Rendering() {
        this.renderShader = new ShaderProgram("screentri-vs", "render-fs");
    }
    Rendering.prototype.dispose = function () {
        this.renderShader.dispose();
    };

    Rendering.prototype.render = function (velocityTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocityTexture);

        gl.useProgram(this.renderShader.program);
        gl.uniform1i(gl.getUniformLocation(this.renderShader.program, "VelocitySampler"), 0);

        ScreenAlignedTriangle.draw();

        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    return Rendering;
})();
var NUM_JACOBI_ITERATIONS = 128;

var Simulation = (function () {
    function Simulation(gridWidth, gridHeight) {
        this.ping = 0;
        this.velocityTexture = [null, null];
        this.velocityFBO = [null, null];
        this.pressureTexture = [null, null];
        this.pressureFBO = [null, null];
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;

        var veloTexType = gl.getExtension("EXT_texture_rg") ? 0x8227 : gl.RGBA;
        var singleChannelTexType = gl.LUMINANCE;

        var testTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, testTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, singleChannelTexType, 32, 32, 0, singleChannelTexType, gl.FLOAT, null);
        var testFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, testFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.velocityTexture[i], 0);
        try  {
            checkFramebuffer();
        } catch (e) {
            singleChannelTexType = veloTexType;
        }
        gl.deleteTexture(testTex);
        gl.deleteFramebuffer(testFBO);

        for (var i = 0; i < 2; ++i) {
            this.velocityTexture[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture[i]);
            gl.texImage2D(gl.TEXTURE_2D, 0, veloTexType, gridWidth, gridHeight, 0, veloTexType, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

            this.velocityFBO[i] = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityFBO[i]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.velocityTexture[i], 0);

            checkFramebuffer();
            gl.clear(gl.COLOR_BUFFER_BIT);

            this.pressureTexture[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.pressureTexture[i]);
            gl.texImage2D(gl.TEXTURE_2D, 0, singleChannelTexType, gridWidth, gridHeight, 0, singleChannelTexType, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

            this.pressureFBO[i] = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressureFBO[i]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pressureTexture[i], 0);

            checkFramebuffer();
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        this.divergenceTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.divergenceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, singleChannelTexType, gridWidth, gridHeight, 0, singleChannelTexType, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        this.divergenceFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.divergenceTexture, 0);

        checkFramebuffer();
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.advectionShader = new ShaderProgram("screentri-vs", "advect");
        this.divergenceShader = new ShaderProgram("screentri-vs", "divergence");
        this.jacobiIterationShader = new ShaderProgram("screentri-vs", "jacobiIteration");
        this.subtractPressureGradient = new ShaderProgram("screentri-vs", "subtractPressureGradient");
    }
    Simulation.prototype.dispose = function () {
        for (var i = 0; i < 2; ++i) {
            gl.deleteTexture(this.velocityTexture[i]);
            gl.deleteFramebuffer(this.velocityFBO[i]);

            gl.deleteTexture(this.pressureTexture[i]);
            gl.deleteFramebuffer(this.pressureFBO[i]);
        }

        gl.deleteTexture(this.divergenceTexture);
        gl.deleteFramebuffer(this.divergenceFBO);
    };

    Simulation.prototype.getVelocityTexture = function () {
        return this.velocityTexture[this.ping];
    };
    Simulation.prototype.getPressureTexture = function () {
        return this.pressureTexture[this.ping];
    };

    Simulation.prototype.update = function (timeDelta) {
        gl.viewport(0, 0, this.gridWidth, this.gridHeight);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityFBO[this.ping]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture[1 - this.ping]);
        gl.useProgram(this.advectionShader.program);
        gl.uniform1i(gl.getUniformLocation(this.advectionShader.program, "OldVelocity"), 0);
        gl.uniform2f(gl.getUniformLocation(this.advectionShader.program, "InverseGridSize"), 1.0 / this.gridWidth, 1.0 / this.gridHeight);
        gl.uniform1f(gl.getUniformLocation(this.advectionShader.program, "DeltaT"), timeDelta);
        ScreenAlignedTriangle.draw();
        this.ping = 1 - this.ping;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture[1 - this.ping]);
        gl.useProgram(this.divergenceShader.program);
        gl.uniform1i(gl.getUniformLocation(this.divergenceShader.program, "Velocity"), 0);
        gl.uniform2f(gl.getUniformLocation(this.divergenceShader.program, "InverseGridSize"), 1.0 / this.gridWidth, 1.0 / this.gridHeight);
        ScreenAlignedTriangle.draw();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressureFBO[0]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressureFBO[1]);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.divergenceTexture);
        gl.useProgram(this.jacobiIterationShader.program);
        gl.uniform1i(gl.getUniformLocation(this.jacobiIterationShader.program, "Divergence"), 0);
        gl.uniform1i(gl.getUniformLocation(this.jacobiIterationShader.program, "OldPressure"), 1);
        gl.uniform2f(gl.getUniformLocation(this.jacobiIterationShader.program, "InverseGridSize"), 1.0 / this.gridWidth, 1.0 / this.gridHeight);
        gl.activeTexture(gl.TEXTURE1);

        var targetPressureTex = 0;
        for (var i = 0; i < NUM_JACOBI_ITERATIONS; ++i) {
            targetPressureTex = 1 - targetPressureTex;
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressureFBO[targetPressureTex]);
            gl.bindTexture(gl.TEXTURE_2D, this.pressureTexture[1 - targetPressureTex]);
            ScreenAlignedTriangle.draw();
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityFBO[this.ping]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture[1 - this.ping]);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.pressureTexture[targetPressureTex]);
        gl.useProgram(this.subtractPressureGradient.program);
        gl.uniform1i(gl.getUniformLocation(this.subtractPressureGradient.program, "OldVelocity"), 0);
        gl.uniform1i(gl.getUniformLocation(this.subtractPressureGradient.program, "Pressure"), 1);
        gl.uniform2f(gl.getUniformLocation(this.subtractPressureGradient.program, "InverseGridSize"), 1.0 / this.gridWidth, 1.0 / this.gridHeight);
        ScreenAlignedTriangle.draw();
        this.ping = 1 - this.ping;

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    return Simulation;
})();
var gl;
var TARGET_FRAMETIME = 1 / 60;

var Application = (function () {
    function Application() {
        if (!window.performance || !window.performance.now)
            this.getTimestamp = function () {
                return new Date().getTime();
            };

        this.canvas = document.getElementById("canvas");

        gl = this.canvas.getContext("experimental-webgl");

        if (gl.getExtension("OES_texture_float") == null) {
            throw "Float textures are not supported! (OES_texture_float support missing)";
        }
        if (gl.getExtension("OES_texture_float_linear") == null) {
            throw "Float textures are not supported! (OES_texture_float_linear support missing)";
        }

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.TEXTURE);

        this.lastFrameTime = 0;

        this.renderModule = new Rendering();
        this.simulationModule = new Simulation(this.canvas.width, this.canvas.height);
    }
    Application.prototype.dispose = function () {
        this.renderModule.dispose();
        this.simulationModule.dispose();
        gl.canvas.width = 1;
        gl.canvas.height = 1;
    };

    Application.prototype.run = function () {
        var _this = this;
        var now = this.getTimestamp();
        var timeSinceLastFrame = (now - this.lastFrameTime) / 1000;

        if (timeSinceLastFrame > TARGET_FRAMETIME) {
            this.simulationModule.update(TARGET_FRAMETIME);

            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            this.renderModule.render(this.simulationModule.getVelocityTexture());

            this.lastFrameTime = now;
        }

        requestAnimationFrame(function () {
            return _this.run();
        });
    };

    Application.prototype.getTimestamp = function () {
        return window.performance.now();
    };
    return Application;
})();

var application;

window.onload = function () {
    application = new Application();
    requestAnimationFrame(function () {
        return application.run();
    });
};

window.onunload = function () {
    application.dispose();
    application = null;
};
