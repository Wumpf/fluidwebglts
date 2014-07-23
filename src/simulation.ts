/// <reference path="glhelper.ts" />
/// <reference path="shaderprogram.ts" />

declare var gl: WebGLRenderingContext;
var NUM_JACOBI_ITERATIONS = 128;

class Simulation {
    // Used for double buffering framebuffer
    ping: number = 0;

    velocityTexture: WebGLTexture[] = [null, null]; // xy: Velocity, z: nothing -.-
    velocityFBO: WebGLFramebuffer[] = [null, null];

    pressureTexture: WebGLTexture[] = [null, null];
    pressureFBO: WebGLFramebuffer[] = [null, null];

    divergenceTexture: WebGLTexture;
    divergenceFBO: WebGLFramebuffer;

    advectionShader: ShaderProgram;
    divergenceShader: ShaderProgram;
    jacobiIterationShader: ShaderProgram;
    subtractPressureGradient: ShaderProgram;

    gridWidth: number;
    gridHeight: number;

    constructor(gridWidth: number, gridHeight: number) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;

        // There are several problems with these textures:
        // - OES_float_texture must be supported
        // - float textures must be valid rendertargets.
        //      (This means essentially that a bug in the WebGL implenetation is required since the specification does not imply that this is supported!)
        // - For REASON IE does not support single channel float textures as rendertarget. This is why I fall back to RGBA/RG here :/ 
        //      (which is a ridicilous waste of memory)

        var veloTexType = gl.getExtension("EXT_texture_rg") ? 0x8227 : gl.RGBA;  // RG_EXT or gl.RGB;
        var singleChannelTexType = gl.LUMINANCE;

        // Only way to check if this really works:
        var testTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, testTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, singleChannelTexType, 32, 32, 0, singleChannelTexType, gl.FLOAT, null);
        var testFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, testFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.velocityTexture[i], 0);
        try {
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


        // Load shader
        this.advectionShader = new ShaderProgram("screentri-vs", "advect"); 
        this.divergenceShader = new ShaderProgram("screentri-vs", "divergence");
        this.jacobiIterationShader = new ShaderProgram("screentri-vs", "jacobiIteration");
        this.subtractPressureGradient = new ShaderProgram("screentri-vs", "subtractPressureGradient");
    }

    dispose() {
        for (var i = 0; i < 2; ++i) {
            gl.deleteTexture(this.velocityTexture[i]);
            gl.deleteFramebuffer(this.velocityFBO[i]);

            gl.deleteTexture(this.pressureTexture[i]);
            gl.deleteFramebuffer(this.pressureFBO[i]);
        }

        gl.deleteTexture(this.divergenceTexture);
        gl.deleteFramebuffer(this.divergenceFBO);
    }

    getVelocityTexture(): WebGLTexture {
        return this.velocityTexture[this.ping];
    }
    getPressureTexture(): WebGLTexture {
        return this.pressureTexture[this.ping];
    }

    update(timeDelta: number) {

        gl.viewport(0, 0, this.gridWidth, this.gridHeight);

        // Advect velocity
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityFBO[this.ping]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture[1 - this.ping]);
        gl.useProgram(this.advectionShader.program);
        gl.uniform1i(gl.getUniformLocation(this.advectionShader.program, "OldVelocity"), 0);
        gl.uniform2f(gl.getUniformLocation(this.advectionShader.program, "InverseGridSize"), 1.0 / this.gridWidth, 1.0 / this.gridHeight);
        gl.uniform1f(gl.getUniformLocation(this.advectionShader.program, "DeltaT"), timeDelta);
        ScreenAlignedTriangle.draw();
        this.ping = 1 - this.ping;

        // Compute divergence of advected velocity
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTexture[1 - this.ping]);
        gl.useProgram(this.divergenceShader.program);
        gl.uniform1i(gl.getUniformLocation(this.divergenceShader.program, "Velocity"), 0);
        gl.uniform2f(gl.getUniformLocation(this.divergenceShader.program, "InverseGridSize"), 1.0 / this.gridWidth, 1.0 / this.gridHeight);
        ScreenAlignedTriangle.draw();

        // Now we need to enforce the incompressability of the fluid!
        // To do this the current pressure needs to be computed.
        // This is done by several jacobi iterations.

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

        // Now that we have an approximate pressure value, we can subtract the gradient of the pressure from the velocity field to make it divergence free 
        // ...and thus sustain the incompressibility!
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
    }
}