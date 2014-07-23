declare var gl: WebGLRenderingContext;

// Checks if everything is alright with the currently bound framebuffer. Throws an error message otherwise.
function checkFramebuffer(): void {
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

// Static class for drawing a screen aligned triangle.
class ScreenAlignedTriangle {

    private static vertexBuffer: WebGLBuffer;

    static draw() {
        if (!ScreenAlignedTriangle.vertexBuffer)
            ScreenAlignedTriangle.init();
        else
            gl.bindBuffer(gl.ARRAY_BUFFER, ScreenAlignedTriangle.vertexBuffer);

        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }


    private static init() {
        var coordinates: Float32Array = new Float32Array([-1.0, -1.0,
                                                           3.0, -1.0,
                                                          -1.0,  3.0]);
        ScreenAlignedTriangle.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ScreenAlignedTriangle.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, coordinates, gl.STATIC_DRAW);
    }
}