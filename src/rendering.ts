/// <reference path="glhelper.ts" />
/// <reference path="shaderprogram.ts" />

declare var gl: WebGLRenderingContext;

class Rendering {
    private renderShader: ShaderProgram;

    constructor() {
        this.renderShader = new ShaderProgram("screentri-vs", "render-fs");
    }

    dispose() {
        this.renderShader.dispose();
    }

    render(velocityTexture: WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocityTexture);

        gl.useProgram(this.renderShader.program);
        gl.uniform1i(gl.getUniformLocation(this.renderShader.program, "VelocitySampler"), 0);

        ScreenAlignedTriangle.draw();

        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}